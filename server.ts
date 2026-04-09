import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { TOKEN_SETS, NEXTDNS_KEY } from './src/server/tokens';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// --- Payment API Endpoints (PayOS Integration) ---

app.post('/api/create-payment-link', async (req, res) => {
    try {
        const { orderCode } = req.body;
        
        if (!orderCode) {
            return res.status(400).json({ success: false, error: 'Order code is required' });
        }

        const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '149c8535-25c6-4a91-95f9-768b578c2322';
        const PAYOS_API_KEY = process.env.PAYOS_API_KEY || 'b1bf5762-2343-4add-9b91-f9c7afe406c5';
        const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '060202ee2764234ad50cd43a852e631216462edcbb6ced388c67f9d0f325ac43';
        
        const amount = 10000; // 10,000 VND
        const description = `Locket Gold Activation - Order ${orderCode}`;
        const returnUrl = `${process.env.VITE_BACKEND_URL || 'http://localhost:3000'}/payment-success`;
        const cancelUrl = `${process.env.VITE_BACKEND_URL || 'http://localhost:3000'}/payment-cancel`;

        // Store order in memory
        paymentOrders.set(orderCode, {
            orderCode,
            amount,
            status: 'pending',
            createdAt: Date.now()
        });

        // Create PayOS payment request
        const paymentData = {
            orderCode: orderCode.toString(),
            amount: amount,
            description: description,
            buyerName: 'Locket User',
            buyerEmail: 'user@locket.vn',
            buyerPhone: '0000000000',
            buyerAddress: 'Vietnam',
            items: [
                {
                    name: 'Locket Gold 1 Month',
                    quantity: 1,
                    price: amount
                }
            ],
            expiredAt: Math.floor((Date.now() + 15 * 60 * 1000) / 1000), // 15 minutes expiry
            returnUrl: returnUrl,
            cancelUrl: cancelUrl,
            signature: generatePayOSSignature(orderCode, amount, description, PAYOS_CHECKSUM_KEY)
        };

        try {
            // Call PayOS API to create payment link
            const payosResponse = await axios.post(
                'https://api-merchant.payos.vn/api/payment-requests',
                paymentData,
                {
                    headers: {
                        'x-client-id': PAYOS_CLIENT_ID,
                        'x-api-key': PAYOS_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (payosResponse.data.success) {
                return res.json({
                    success: true,
                    data: {
                        orderCode: orderCode,
                        amount: amount,
                        qrCode: payosResponse.data.data.qrCode,
                        checkoutUrl: payosResponse.data.data.checkoutUrl,
                        paymentLink: payosResponse.data.data.paymentLink || payosResponse.data.data.checkoutUrl,
                        expiresAt: Date.now() + 15 * 60 * 1000
                    }
                });
            } else {
                throw new Error(payosResponse.data.message || 'PayOS API error');
            }
        } catch (payosError: any) {
            console.error('PayOS API Error:', payosError.response?.data || payosError.message);
            
            // Fallback: Return mock data for development
            if (process.env.NODE_ENV !== 'production') {
                return res.json({
                    success: true,
                    data: {
                        orderCode: orderCode,
                        amount: amount,
                        qrCode: `https://img.vietqr.io/image/970416-1234567890-compact2.png?amount=${amount}&addInfo=Locket`,
                        checkoutUrl: `https://checkout.payos.vn/web/${PAYOS_CLIENT_ID}`,
                        paymentLink: `https://checkout.payos.vn/web/${PAYOS_CLIENT_ID}`,
                        expiresAt: Date.now() + 15 * 60 * 1000,
                        isDev: true
                    }
                });
            }
            
            throw payosError;
        }

        // Clean up old orders
        const now = Date.now();
        for (const [code, order] of paymentOrders.entries()) {
            if (now - order.createdAt > 30 * 60 * 1000) {
                paymentOrders.delete(code);
            }
        }
    } catch (error: any) {
        console.error('Payment creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data?.message || 'Failed to create payment link' 
        });
    }
});

app.get('/api/check-order/:orderCode', async (req, res) => {
    try {
        const { orderCode } = req.params;
        const code = parseInt(orderCode);

        const order = paymentOrders.get(code);
        
        if (!order) {
            return res.json({ 
                success: false, 
                status: 'NOT_FOUND',
                message: 'Order not found'
            });
        }

        // Check if order has expired
        if (Date.now() - order.createdAt > 30 * 60 * 1000) {
            paymentOrders.delete(code);
            return res.json({ 
                success: false, 
                status: 'EXPIRED',
                message: 'Order expired'
            });
        }

        res.json({
            success: true,
            status: order.status === 'paid' ? 'PAID' : 'PENDING',
            orderCode: code,
            amount: order.amount
        });

    } catch (error: any) {
        console.error('Check order error:', error);
        res.status(500).json({ success: false, error: 'Failed to check order' });
    }
});

app.post('/api/webhook/payos', async (req, res) => {
    try {
        const { orderCode, status, amount } = req.body;
        
        if (status === 'PAID') {
            const order = paymentOrders.get(parseInt(orderCode));
            if (order) {
                order.status = 'paid';
            }
        }
        
        res.json({ success: true, message: 'Webhook received' });
    } catch (error: any) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
});

// Helper function to generate PayOS signature
function generatePayOSSignature(orderCode: number, amount: number, description: string, checksumKey: string): string {
    const data = `${orderCode}${amount}${description}`;
    return crypto
        .createHmac('sha256', checksumKey)
        .update(data)
        .digest('hex');
}

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
