import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { PayOS } from '@payos/node';
import { TOKEN_SETS, NEXTDNS_KEY } from './src/server/tokens';

const app = express();
const PORT = process.env.PORT || 3000;

// PayOS Configuration
const PAYOS_CLIENT_ID = '149c8535-25c6-4a91-95f9-768b578c2322';
const PAYOS_API_KEY = 'b1bf5762-2343-4add-9b91-f9c7afe406c5';
const PAYOS_CHECKSUM_KEY = '060202ee2764234ad50cd43a852e631216462edcbb6ced388c67f9d0f325ac43';

const payos = new PayOS({
  clientId: PAYOS_CLIENT_ID,
  apiKey: PAYOS_API_KEY,
  checksumKey: PAYOS_CHECKSUM_KEY,
});

app.use(cors());
app.use(express.json());

// Log ALL API requests for debugging
app.use('/api/', (req, res, next) => {
  console.log(`\n📨 [API REQUEST] ${req.method} ${req.path}`);
  console.log('   Body:', JSON.stringify(req.body).substring(0, 200));
  next();
});

// In-memory payment orders storage
const paymentOrders = new Map<number, { orderCode: number; amount: number; status: 'pending' | 'paid'; createdAt: number; }>();

const HEADERS: Record<string, string> = {
    'Host': 'api.revenuecat.com',
    'Authorization': 'Bearer appl_JngFETzdodyLmCREOlwTUtXdQik',
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'X-Platform': 'iOS',
    'X-Platform-Version': 'Version 26.2 (Build 23C55)',
    'X-Platform-Device': 'iPhone15,3',
    'X-Platform-Flavor': 'native',
    'X-Version': '5.41.0',
    'X-Client-Version': '2.32.2',
    'X-Client-Bundle-ID': 'com.locket.Locket',
    'X-Client-Build-Version': '3',
    'X-StoreKit2-Enabled': 'true',
    'X-StoreKit-Version': '2',
    'X-Observer-Mode-Enabled': 'false',
    'X-Storefront': 'VNM',
    'X-Apple-Device-Identifier': '39A73C25-1E05-4350-ADA7-5CD3FE1079E8',
    'X-Preferred-Locales': 'vi_KR,ko_KR,en_KR',
    'X-Nonce': 'w0Mlb6+AmV4WYuVv',
    'X-Is-Backgrounded': 'false',
    'X-Retry-Count': '0',
    'X-Is-Debug-Build': 'false',
    'User-Agent': 'Locket/3 CFNetwork/3860.300.31 Darwin/25.2.0',
    'Accept-Language': 'vi-VN,vi;q=0.9',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'X-RevenueCat-ETag': ''
};

// --- API Routes ---

app.post('/api/resolve', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    try {
        const url = `https://locket.cam/${username}`;
        const response = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "Accept": "text/html" },
            maxRedirects: 5
        });

        const html = response.data;
        const redirectUrl = response.request.res.responseUrl || url;

        const extract = (text: string) => {
            if (!text) return null;
            const m = text.match(/\/invites\/([A-Za-z0-9]{28})/);
            if (m) return m[1];
            const lp = text.match(/link=([^\s"'>]+)/);
            if (lp) {
                try {
                    const d = lp[1].replace(/%3A/g, ':').replace(/%2F/g, '/');
                    const dm = d.match(/\/invites\/([A-Za-z0-9]{28})/);
                    if (dm) return dm[1];
                } catch (e) {}
            }
            return null;
        };

        const uid = extract(redirectUrl) || extract(html);
        if (uid) {
            res.json({ uid });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error("Resolve error:", error);
        res.status(500).json({ error: 'Failed to resolve UID' });
    }
});

app.get('/api/status/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
        const url = `https://api.revenuecat.com/v1/subscribers/${uid}`;
        const response = await axios.get(url, { headers: HEADERS });
        
        if (response.status >= 200 && response.status < 300) {
            const entitlements = response.data?.subscriber?.entitlements?.Gold;
            if (entitlements) {
                return res.json({ active: true, expires: entitlements.expires_date });
            }
        }
        res.json({ active: false });
    } catch (error) {
        console.error("Status check error:", error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

app.post('/api/activate', async (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID is required' });

    try {
        // 1. Inject Gold
        const token_config = TOKEN_SETS[Math.floor(Math.random() * TOKEN_SETS.length)];
        const url = "https://api.revenuecat.com/v1/receipts";
        const body = {
            "product_id": "locket_199_1m", 
            "fetch_token": token_config['fetch_token'], 
            "app_transaction": token_config['app_transaction'], 
            "app_user_id": uid, 
            "is_restore": true, 
            "store_country": "VNM", 
            "currency": "USD",
            "price": "1.99", 
            "normal_duration": "P1M", 
            "subscription_group_id": "21419447",
            "observer_mode": false, 
            "initiation_source": "restore", 
            "offers": [],
            "attributes": {"$attConsentStatus": {"updated_at_ms": Date.now(), "value": "notDetermined"}}
        };

        const current_headers = { ...HEADERS };
        current_headers['Content-Length'] = JSON.stringify(body).length.toString();
        if (token_config['hash_params']) current_headers['X-Post-Params-Hash'] = token_config['hash_params'];
        if (token_config['hash_headers']) current_headers['X-Headers-Hash'] = token_config['hash_headers'];
        current_headers['X-Is-Sandbox'] = token_config['is_sandbox'].toString();

        let success = false;
        let msgResult = "Failed";

        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const response = await axios.post(url, body, { headers: current_headers, validateStatus: () => true });
                if (response.status === 200) {
                    // Check status
                    const statusRes = await axios.get(`https://api.revenuecat.com/v1/subscribers/${uid}`, { headers: HEADERS });
                    if (statusRes.data?.subscriber?.entitlements?.Gold) {
                        success = true;
                        msgResult = "SUCCESS";
                        break;
                    }
                    await new Promise(r => setTimeout(r, 2000));
                    const statusRes2 = await axios.get(`https://api.revenuecat.com/v1/subscribers/${uid}`, { headers: HEADERS });
                    if (statusRes2.data?.subscriber?.entitlements?.Gold) {
                        success = true;
                        msgResult = "SUCCESS";
                        break;
                    }
                    msgResult = "Accepted but NO Gold (Expired?)";
                    break;
                } else if (response.status === 529) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                } else {
                    msgResult = `Rejected: ${response.data?.message || response.status}`;
                    break;
                }
            } catch (e: any) {
                if (attempt === 4) msgResult = `Request Error: ${e.message}`;
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (!success) {
            return res.status(400).json({ error: msgResult });
        }

        // 2. Create NextDNS Profile
        const dnsHeaders = { "X-Api-Key": NEXTDNS_KEY, "Content-Type": "application/json" };
        const todayStr = new Date().toISOString().split('T')[0];
        const profileName = `LocketVIP-${todayStr}`;
        
        let pid = null;
        let link = null;

        try {
            const profilesRes = await axios.get("https://api.nextdns.io/profiles", { headers: dnsHeaders, validateStatus: () => true });
            if (profilesRes.status === 200) {
                const existing = profilesRes.data?.data?.find((p: any) => p.name === profileName);
                if (existing) {
                    pid = existing.id;
                    link = `https://apple.nextdns.io/?profile=${pid}`;
                    try {
                        await axios.post(`https://api.nextdns.io/profiles/${pid}/denylist`, { id: "revenuecat.com", active: true }, { headers: dnsHeaders });
                    } catch (e) {}
                }
            }

            if (!pid) {
                const createRes = await axios.post("https://api.nextdns.io/profiles", { name: profileName }, { headers: dnsHeaders, validateStatus: () => true });
                if (createRes.status === 200) {
                    pid = createRes.data?.data?.id;
                    link = `https://apple.nextdns.io/?profile=${pid}`;
                    try {
                        await axios.post(`https://api.nextdns.io/profiles/${pid}/denylist`, { id: "revenuecat.com", active: true }, { headers: dnsHeaders });
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error("NextDNS error:", e);
        }

        res.json({ success: true, pid, link });

    } catch (error) {
        console.error("Activate error:", error);
        res.status(500).json({ error: 'Failed to activate' });
    }
});

// --- Payment API Endpoints (Direct PayOS Integration) ---

app.post('/api/create-payment-link', async (req, res) => {
    try {
        const { orderCode, amount, description, cancelUrl, returnUrl } = req.body;
        
        if (!orderCode || !amount) {
            return res.status(400).json({ success: false, error: 'Order code and amount are required' });
        }

        console.log('📝 Creating payment link for order:', orderCode, 'amount:', amount);

        try {
            // Use PayOS SDK directly (handles all signature/headers internally)
            const paymentLink = await payos.paymentRequests.create({
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
            });

            console.log('✅ PayOS payment link created successfully!');

            // Store order in memory
            paymentOrders.set(orderCode, {
                orderCode,
                amount,
                status: 'pending',
                createdAt: Date.now()
            });

            return res.json({
                success: true,
                data: {
                    orderCode,
                    amount,
                    qrCode: paymentLink.qrCode,
                    checkoutUrl: paymentLink.checkoutUrl,
                    accountNumber: paymentLink.accountNumber,
                    accountName: paymentLink.accountName,
                    bin: paymentLink.bin,
                    description: paymentLink.description
                }
            });
        } catch (payosError: any) {
            console.error('❌ PayOS SDK Error:', {
                message: payosError.message,
                code: payosError.code,
                status: payosError.status
            });

            // Handle duplicate order (code 231) - order already created
            if (payosError.code === '231' || payosError.message?.includes('231')) {
                console.log('⚠️ Order already exists, returning stored order');
                // Store order as processed
                paymentOrders.set(orderCode, {
                    orderCode,
                    amount,
                    status: 'pending',
                    createdAt: Date.now()
                });
                
                return res.json({
                    success: true,
                    data: {
                        orderCode,
                        amount,
                        qrCode: 'duplicate',
                        checkoutUrl: `https://pay.payos.vn/web/${orderCode}`,
                        description: description || `Payment for order ${orderCode}`,
                        message: 'Order already exists in PayOS'
                    }
                });
            }

            return res.status(500).json({
                success: false,
                error: 'Failed to create payment link: ' + payosError.message
            });
        }
    } catch (error: any) {
        console.error('❌ Create payment request error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to process payment request' });
    }
});

app.get('/api/check-order/:orderCode', async (req, res) => {
    try {
        const { orderCode } = req.params;
        const code = parseInt(orderCode);
        
        console.log(`\n🔍 [check-order] Looking up orderCode: ${code}`);
        console.log(`📊 Current orders in memory:`, Array.from(paymentOrders.entries()));

        const order = paymentOrders.get(code);
        
        console.log(`📝 Found order:`, order);
        
        if (order) {
            // Order found in local memory
            if (Date.now() - order.createdAt > 30 * 60 * 1000) {
                paymentOrders.delete(code);
                console.log('⏰ Order expired');
                return res.json({ 
                    success: false, 
                    status: 'EXPIRED',
                    message: 'Order expired'
                });
            }

            const status = order.status === 'paid' ? 'PAID' : 'PENDING';
            console.log(`✅ Returning status: ${status}`);
            
            res.json({
                success: true,
                status: status,
                orderCode: code,
                amount: order.amount
            });
        } else {
            // Order not found locally
            console.log('❌ Order not found in local memory:', orderCode);
            console.log('⚠️ This could mean:');
            console.log('   1. Webhook callback hasnt been received yet from PayOS');
            console.log('   2. Payment order has expired (>30 min old)');
            console.log('   3. Browser session was refreshed, losing order context');
            
            return res.json({ 
                success: false, 
                status: 'UNKNOWN',
                message: 'Order not found - waiting for webhook callback from PayOS'
            });
            }
        }

    } catch (error: any) {
        console.error('Check order error:', error);
        res.status(500).json({ success: false, error: 'Failed to check order' });
    }
});

// TEST ENDPOINT: Mark order as paid (testing only)
app.post('/api/mark-paid/:orderCode', async (req, res) => {
    try {
        const { orderCode } = req.params;
        const code = parseInt(orderCode);

        console.log('🧪 TEST: Marking order as paid:', code);

        // Try local memory first
        const order = paymentOrders.get(code);
        if (order) {
            order.status = 'paid';
            console.log('✅ Updated local order:', code);
            return res.json({
                success: true,
                message: 'Order marked as paid (local)',
                orderCode: code,
                status: 'PAID'
            });
        }

        // Try API server
        try {
            const apiResponse = await axios.post(
                `${PAYMENT_BACKEND_URL}/api/mark-paid/${orderCode}`,
                {},
                { timeout: 5000 }
            );
            console.log('✅ API server marked order as paid:', apiResponse.data);
            return res.json(apiResponse.data);
        } catch (apiError: any) {
            console.warn('⚠️ Could not reach API server:', apiError.message);
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

    } catch (error: any) {
        console.error('Mark paid error:', error);
        res.status(500).json({ success: false, error: 'Failed to mark order as paid' });
    }
});

app.post('/api/webhook/payos', async (req, res) => {
    try {
        console.log('📲 Raw webhook body:', JSON.stringify(req.body));
        
        const { orderCode, status, amount, data } = req.body;
        
        // Extract order code từ nhiều format khác nhau
        const realOrderCode = orderCode || data?.orderCode || req.body.order?.code;
        const realStatus = (status || data?.status)?.toString().toUpperCase();
        
        console.log('📲 Parsed webhook:', { realOrderCode, realStatus, amount });
        
        // Kiểm tra status PAID
        if (realOrderCode && (realStatus === 'PAID' || realStatus === 'SUCCESS' || realStatus === 'COMPLETED')) {
            const order = paymentOrders.get(parseInt(realOrderCode));
            if (order) {
                order.status = 'paid';
                console.log('✅ Order marked as paid:', realOrderCode);
            } else {
                console.warn('⚠️ Order not found in memory:', realOrderCode);
            }
        }
        
        return res.json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
        console.error('❌ Webhook error:', error);
        return res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
});

// Main webhook endpoint (PayOS calls /api/webhook)
app.post('/api/webhook', async (req, res) => {
    try {
        console.log('\n🔔 ============ WEBHOOK RECEIVED ============');
        console.log('📲 [/api/webhook] Raw webhook body:', JSON.stringify(req.body, null, 2));
        console.log('📲 [/api/webhook] Headers:', JSON.stringify(req.headers, null, 2));
        
        const { code, success, data } = req.body;
        
        console.log('📲 Extracted:', { code, success, data });
        
        // PayOS format: success flag or code '00' means success
        if (success === true || code === '00' || code === 0) {
            const realOrderCode = data?.orderCode;
            const realStatus = data?.status?.toString().toUpperCase();
            
            console.log('✅ PayOS Success! Parsed:', { realOrderCode, realStatus });
            
            // Mark order as PAID
            if (realOrderCode && (realStatus === 'PAID' || realStatus === 'SUCCESS' || realStatus === 'COMPLETED')) {
                const orderCode = parseInt(realOrderCode);
                const order = paymentOrders.get(orderCode);
                console.log(`🔍 Looking for order ${orderCode} in memory:`, order);
                
                if (order) {
                    order.status = 'paid';
                    console.log('✅ [/api/webhook] Order marked as PAID:', realOrderCode);
                } else {
                    console.warn('⚠️ [/api/webhook] Order not found in memory, creating new entry');
                    // Still mark it as processed for webhook callback
                    paymentOrders.set(orderCode, {
                        orderCode,
                        amount: data?.amount,
                        status: 'paid',
                        createdAt: Date.now()
                    });
                    console.log('✅ Created new order entry as PAID:', orderCode);
                }
                console.log('📊 All orders in memory:', Array.from(paymentOrders.entries()));
            }
        } else {
            console.log('⚠️ Webhook received but status was not success. Code:', code, 'Success:', success);
        }
        
        console.log('✅ Webhook response sent\n🔔 ============ END WEBHOOK ============\n');
        return res.json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
        console.error('❌ [/api/webhook] Error:', error);
        return res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
});

// Alternative webhook endpoint for backend-locket compatibility
app.post('/api/payos-webhook', async (req, res) => {
    try {
        console.log('📲 Raw payos-webhook body:', JSON.stringify(req.body));
        
        const { orderCode, status, amount, data, code, message } = req.body;
        
        // Extract order code from múltiple formats
        const realOrderCode = orderCode || data?.orderCode || req.body.order?.code;
        const realStatus = (status || data?.status || code)?.toString().toUpperCase();
        
        console.log('📲 Parsed payos-webhook:', { realOrderCode, realStatus, amount });
        
        // Handle different success indicators
        const isSuccess = realStatus === 'PAID' || 
                         realStatus === 'SUCCESS' || 
                         realStatus === 'COMPLETED' ||
                         code === '00' ||
                         message?.includes('thành công');
        
        if (realOrderCode && isSuccess) {
            const order = paymentOrders.get(parseInt(realOrderCode));
            if (order) {
                order.status = 'paid';
                console.log('✅ Order marked as paid via payos-webhook:', realOrderCode);
            } else {
                console.warn('⚠️ Order not found in memory:', realOrderCode);
            }
        }
        
        return res.json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
        console.error('❌ PayOS webhook error:', error);
        return res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
});

app.post('/api/admin/mark-paid/:orderCode', async (req, res) => {
    try {
        const { orderCode } = req.params;
        const code = parseInt(orderCode);

        const order = paymentOrders.get(code);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        order.status = 'paid';
        res.json({ success: true, message: 'Order marked as paid' });

    } catch (error: any) {
        console.error("Admin mark paid error:", error);
        res.status(500).json({ success: false, error: 'Failed to mark order as paid' });
    }
});

// Admin authentication endpoint
app.post('/api/admin-auth', async (req, res) => {
    try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Use env variable or default
        
        if (password === adminPassword) {
            res.json({ success: true, message: 'Admin authenticated' });
        } else {
            res.status(401).json({ success: false, error: 'Invalid password' });
        }
    } catch (error: any) {
        console.error("Admin auth error:", error);
        res.status(500).json({ success: false, error: 'Admin authentication failed' });
    }
});

// --- Vite Middleware ---
async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath, { maxAge: '1h' }));
        // Fallback to index.html for SPA routing
        app.use((req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
