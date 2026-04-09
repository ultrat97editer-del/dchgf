import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PayOS Configuration
const CLIENT_ID = process.env.PAYOS_CLIENT_ID || '55bfd518-54df-4ee0-9a46-52479e60b8ac';
const API_KEY = process.env.PAYOS_API_KEY || '70e01ab3-d65f-4299-9b1d-eafa6eb8341b';
const CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || 'd7e36c73dcd2073925e623e3df43132bd73462a4cbd82dfa7b625ca185d5316e';

// PayOS API Base URL
const PAYOS_API_URL = 'https://api.payos.vn/v1';

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

    console.log('📝 Creating payment link for order:', orderCode);

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

    // Create checksum
    const checksum = createChecksum(paymentData);

    console.log('📤 Sending to PayOS API:', { ...paymentData, checksum: checksum.substring(0, 10) + '...' });

    // Call PayOS API
    const response = await axios.post(`${PAYOS_API_URL}/Payment/Create`, paymentData, {
      headers: {
        'Client-Id': CLIENT_ID,
        'Api-Key': API_KEY,
        'Idempotency-Key': `${orderCode}-${Date.now()}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ PayOS response:', response.status);

    if (response.data && response.data.data) {
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

    return res.status(400).json({
      success: false,
      error: 'Failed to create payment link'
    });
  } catch (error: any) {
    console.error('❌ Create payment link error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Failed to create payment link'
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

    const { data, signature } = req.body;

    // Verify signature nếu PayOS gửi
    if (signature && data) {
      const computedSignature = verifySignature(JSON.stringify(data));
      if (computedSignature !== signature) {
        console.warn('⚠️ Invalid signature');
        // Continue anyway, không fail
      }
    }

    // Extract payment info from webhook
    const {
      orderCode,
      transactionId,
      status,
      amount,
      paymentMethod,
      paidAt
    } = data || req.body;

    console.log('📲 Parsed webhook:', { orderCode, status, amount });

    // Update order status
    if (orderCode) {
      const order = paymentOrders.get(parseInt(orderCode));
      if (order) {
        // Normalize status
        const normalizedStatus = status?.toString().toUpperCase();
        if (normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED') {
          order.status = 'paid';
          order.transactionId = transactionId;
          console.log('✅ Order marked as PAID:', orderCode);
        }
      } else {
        console.warn('⚠️ Order not found in memory:', orderCode);
      }
    }

    // Acknowledge webhook
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

// Health check
app.get('/health', (req: Request, res: Response) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

export default app;
