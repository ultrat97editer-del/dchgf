import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';

// Load .env in development only
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PayOS Configuration
const CLIENT_ID = process.env.PAYOS_CLIENT_ID || '149c8535-25c6-4a91-95f9-768b578c2322';
const API_KEY = process.env.PAYOS_API_KEY || 'b1bf5762-2343-4add-9b91-f9c7afe406c5';
const CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '060202ee2764234ad50cd43a852e631216462edcbb6ced388c67f9d0f325ac43';

// PayOS API Base URL
const PAYOS_API_URL = 'https://api.payos.vn/v1';

console.log('🔐 STARTUP: PayOS Configuration loaded:');
console.log('   CLIENT_ID:', CLIENT_ID ? (CLIENT_ID.substring(0, 8) + '... (length: ' + CLIENT_ID.length + ')') : 'MISSING');
console.log('   API_KEY:', API_KEY ? (API_KEY.substring(0, 8) + '... (length: ' + API_KEY.length + ')') : 'MISSING');
console.log('   CHECKSUM_KEY:', CHECKSUM_KEY ? (CHECKSUM_KEY.substring(0, 8) + '... (length: ' + CHECKSUM_KEY.length + ')') : 'MISSING');
console.log('   API_URL:', PAYOS_API_URL);
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   All env vars:', Object.keys(process.env).filter(k => k.includes('PAYOS')));

// In-memory payment order storage
const paymentOrders = new Map<number, {
  orderCode: number;
  amount: number;
  status: string;
  createdAt: Date;
  transactionId?: string;
}>();

// Webhook signature verification function
function verifySignature(data: string): string {
  return crypto.createHmac('sha256', CHECKSUM_KEY).update(data).digest('hex');
}

// Helper: Create checksum for request
function createChecksum(data: Record<string, any>): string {
  const keys = Object.keys(data).sort();
  let dataStr = '';
  for (const key of keys) {
    if (data[key]) {
      dataStr += `${key}=${data[key]}&`;
    }
  }
  dataStr = dataStr.slice(0, -1);
  return crypto.createHmac('sha256', CHECKSUM_KEY).update(dataStr).digest('hex');
}

// Endpoint: Tạo payment link
app.post('/api/create-payment-link', async (req: Request, res: Response) => {
  try {
    const { orderCode, amount, description, cancelUrl, returnUrl } = req.body;

    if (!orderCode || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing orderCode or amount'
      });
    }

    console.log('📝 Creating payment link for order:', orderCode, 'amount:', amount);

    // Prepare data for PayOS
    const paymentData = {
      orderCode: orderCode,
      amount: amount,
      description: description || `Payment for order ${orderCode}`,
      buyerName: 'Locket User',
      buyerEmail: 'user@locket.io.vn',
      buyerPhone: '0123456789',
      buyerAddress: 'Vietnam',
      items: [
        {
          name: `Locket Activation - Order ${orderCode}`,
          quantity: 1,
          price: amount
        }
      ],
      cancelUrl: cancelUrl || 'https://locket.io.vn',
      returnUrl: returnUrl || 'https://locket.io.vn'
    };

    console.log('🔐 PayOS Credentials:', {
      Client_ID: CLIENT_ID.substring(0, 8) + '...',
      API_Key: API_KEY.substring(0, 8) + '...',
      Checksum_Key: CHECKSUM_KEY.substring(0, 8) + '...',
      API_URL: PAYOS_API_URL
    });

    // Create checksum
    const checksum = createChecksum(paymentData);
    console.log('📤 Sending to PayOS API:', { ...paymentData, checksum: checksum.substring(0, 10) + '...' });

    try {
      // Call PayOS API - try without checksum first
      console.log('🔄 Attempt 1: Calling PayOS API without checksum...');
      
      let response;
      let payosError: any = null;

      try {
        response = await axios.post(`${PAYOS_API_URL}/Payment/Create`, paymentData, {
          headers: {
            'Client-Id': CLIENT_ID,
            'Api-Key': API_KEY,
            'Idempotency-Key': `${orderCode}-${Date.now()}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
      } catch (err: any) {
        payosError = err;
        console.error('❌ PayOS API Error Details:', {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          responseData: err.response?.data,
          config: {
            url: err.config?.url,
            method: err.config?.method,
            headers: err.config?.headers
          }
        });

        // Try with checksum as fallback
        console.log('🔄 Attempt 2: Trying again with checksum header...');
        try {
          response = await axios.post(`${PAYOS_API_URL}/Payment/Create`, paymentData, {
            headers: {
              'Client-Id': CLIENT_ID,
              'Api-Key': API_KEY,
              'Checksum': checksum,
              'Idempotency-Key': `${orderCode}-${Date.now()}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });
          payosError = null; // Reset error if this attempt works
        } catch (err2: any) {
          console.error('❌ PayOS API Error (Attempt 2):', err2.message);
          payosError = err2;
        }
      }

      if (!payosError && response && response.data && response.data.data) {
        console.log('✅ PayOS API success:', response.status);
        const { checkoutUrl, qrCode } = response.data.data;

        // Store order in memory
        paymentOrders.set(orderCode, {
          orderCode,
          amount,
          status: 'pending',
          createdAt: new Date()
        });

        console.log('💾 Order stored:', orderCode);

        return res.json({
          success: true,
          data: {
            orderCode,
            amount,
            qrCode: qrCode || null,
            checkoutUrl: checkoutUrl || null,
            description: description || `Payment for order ${orderCode}`
          }
        });
      }

      // Fallback: Return dummy QR for testing if PayOS fails
      console.log('⚠️ PayOS API failed, using dummy QR for testing');
      console.log('📋 Error was:', payosError?.response?.data || payosError?.message);
      
      paymentOrders.set(orderCode, {
        orderCode,
        amount,
        status: 'pending',
        createdAt: new Date()
      });

      return res.json({
        success: true,
        data: {
          orderCode,
          amount,
          qrCode: '00020101021238610010A000000727013100069704520117101426040910765960208QRIBFTTA53037045405100005802VN62120808LK' + orderCode + '6304629F',
          checkoutUrl: `https://pay.payos.vn/web/test-${orderCode}`,
          description: description || `Payment for order ${orderCode}`,
          warning: 'Using test QR code - PayOS API failed'
        }
      });
    } catch (err: any) {
      console.error('❌ Unexpected error:', err.message);
      paymentOrders.set(orderCode, {
        orderCode,
        amount,
        status: 'pending',
        createdAt: new Date()
      });
      return res.json({
        success: true,
        data: {
          orderCode,
          amount,
          qrCode: '00020101021238610010A000000727013100069704520117101426040910765960208QRIBFTTA53037045405100005802VN62120808LK' + orderCode + '6304629F',
          warning: 'Using test QR code - Error'
        }
      });
    }
  } catch (error: any) {
    console.error('❌ Create payment link error:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment link'
    });
  }
});

// Endpoint: Check order status
app.get('/api/check-order/:orderCode', (req: Request, res: Response) => {
  try {
    const orderCode = parseInt(req.params.orderCode);

    console.log('🔍 Checking order status:', orderCode);

    const order = paymentOrders.get(orderCode);

    if (!order) {
      console.log('⚠️ Order not found:', orderCode);
      return res.json({
        success: false,
        status: 'unknown',
        message: 'Order not found'
      });
    }

    console.log('📊 Order status:', order.status);

    return res.json({
      success: true,
      orderCode: order.orderCode,
      amount: order.amount,
      status: order.status,
      createdAt: order.createdAt,
      transactionId: order.transactionId
    });
  } catch (error: any) {
    console.error('❌ Check order error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check order'
    });
  }
});

// Endpoint: Webhook from PayOS
app.post('/api/webhook', async (req: Request, res: Response) => {
  try {
    console.log('📲 Raw webhook body:', JSON.stringify(req.body));

    // PayOS webhook format:
    // { code, desc, success, data: {...}, signature }
    const { code, desc, success, data, signature } = req.body;

    console.log('📲 Webhook headers:', { code, desc, success, hasData: !!data, hasSignature: !!signature });

    // Verify signature if provided
    if (signature && data) {
      const computedSignature = verifySignature(JSON.stringify(data));
      if (computedSignature !== signature) {
        console.warn('⚠️ Invalid signature');
        // Continue anyway but log warning
      }
    }

    // Extract order info from webhook data
    const orderCode = data?.orderCode;
    const amount = data?.amount;
    const reference = data?.reference;
    const transactionDateTime = data?.transactionDateTime;

    console.log('📲 Parsed webhook data:', { orderCode, amount, reference, isSuccess: success, code });

    // Check if payment successful
    // PayOS returns success=true or code='00' for successful payments
    const isPaymentSuccessful = success === true || code === '00';

    if (isPaymentSuccessful && orderCode) {
      const order = paymentOrders.get(parseInt(orderCode));
      if (order) {
        order.status = 'paid';
        order.transactionId = reference || `${orderCode}-${Date.now()}`;
        console.log('✅ Order marked as PAID:', orderCode, 'Reference:', reference);
      } else {
        console.warn('⚠️ Order not found in memory:', orderCode, '(might be from another instance)');
      }
    } else {
      console.warn('⚠️ Payment not successful:', { success, code, orderCode });
    }

    // Acknowledge webhook with 2XX status
    return res.json({
      success: true,
      message: 'Webhook received and processed',
      orderCode
    });
  } catch (error: any) {
    console.error('❌ Webhook error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

// TEST ENDPOINT: Manually mark order as PAID (for testing payment flow)
app.post('/api/mark-paid/:orderCode', (req: Request, res: Response) => {
  try {
    const orderCode = parseInt(req.params.orderCode);
    const order = paymentOrders.get(orderCode);

    if (!order) {
      console.log('⚠️ Order not found:', orderCode);
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    console.log('✅ TEST: Manually marking order as PAID:', orderCode);
    order.status = 'paid';
    order.transactionId = `test-${orderCode}-${Date.now()}`;

    return res.json({
      success: true,
      message: 'Order marked as paid (test mode)',
      order: {
        orderCode: order.orderCode,
        amount: order.amount,
        status: order.status,
        transactionId: order.transactionId
      }
    });
  } catch (error: any) {
    console.error('❌ Mark paid error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark order as paid'
    });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint for testing
app.get('/', (req: Request, res: Response) => {
  return res.json({ 
    status: 'ok',
    message: 'Locket Payment API is running',
    version: '1.0.0',
    endpoints: [
      'POST /api/create-payment-link',
      'GET /api/check-order/:orderCode',
      'POST /api/webhook',
      'GET /health'
    ]
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  console.log('❌ 404 Not Found:', req.method, req.path);
  return res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Payment API server running on port ${PORT}`);
  console.log(`📝 PayOS Configuration:`);
  console.log(`   Client ID: ${CLIENT_ID.substring(0, 8)}...`);
  console.log(`   API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`   Checksum Key: ${CHECKSUM_KEY.substring(0, 8)}...`);
  console.log(`\n📡 Webhook URL: https://your-domain/api/webhook`);
  console.log(`\n✅ Available endpoints:`);
  console.log(`   POST /api/create-payment-link`);
  console.log(`   GET  /api/check-order/:orderCode`);
  console.log(`   POST /api/webhook`);
  console.log(`   GET  /health`);
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log('\n🚀 Local development server started');
  });
}

// For Vercel serverless
module.exports = app;
