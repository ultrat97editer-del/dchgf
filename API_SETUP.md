# 🚀 Setup API Server with PayOS Integration

> **Thay thế backend-locket.vercel.app cũ bằng API server local**

## 📦 Cấu Trúc Mới

```
locket-payment/
├── server.ts               # Main server (proxy tới API)
├── api/
│   ├── index.ts           # Payment API server
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example       # Template environment
│   └── .gitignore
├── src/
│   └── App.tsx            # React app (không thay đổi)
└── ...
```

## 🔧 Setup Steps

### 1. **Setup PayOS Credentials**

Tạo file `api/.env` (KHÔNG push lên GitHub):

```bash
cp api/.env.example api/.env
```

Edit `api/.env` và điền PayOS keys của bạn:

```env
PAYOS_CLIENT_ID=55bfd518-54df-4ee0-9a46-52479e60b8ac
PAYOS_API_KEY=70e01ab3-d65f-4299-9b1d-eafa6eb8341b
PAYOS_CHECKSUM_KEY=d7e36c73dcd2073925e623e3df43132bd73462a4cbd82dfa7b625ca185d5316e

PORT=3001
NODE_ENV=development
WEBHOOK_URL=https://locket.io.vn/api/webhook
```

### 2. **Chạy API Server**

**Cách 1: Chạy API Server riêng lẻ**
```bash
npm run dev:api
```

**Cách 2: Chạy cả hai servers (Main + API)**
```bash
npm run dev:all
```

**Cách 3: Manual - Terminal 1**
```bash
cd api
npm install
npm run dev
```

**Cách 3: Manual - Terminal 2**
```bash
npm run dev
```

## 📡 Server Ports

| Server | Port | Purpose |
|--------|------|---------|
| Main Server | 3000 | React app + proxy |
| API Server | 3001 | PayOS payment API |

## 🌐 API Endpoints

### Create Payment Link
```bash
POST /api/create-payment-link
Content-Type: application/json

{
  "orderCode": 123456,
  "amount": 10000,
  "description": "Locket Activation"
}

Response:
{
  "success": true,
  "data": {
    "orderCode": 123456,
    "amount": 10000,
    "qrCode": "00020101021238...",
    "checkoutUrl": "https://pay.payos.vn/web/..."
  }
}
```

### Check Order Status
```bash
GET /api/check-order/123456

Response:
{
  "success": true,
  "orderCode": 123456,
  "amount": 10000,
  "status": "pending" | "paid",
  "createdAt": "2024-04-09T...",
  "transactionId": "abc123"
}
```

### Webhook (PayOS → Server)
```bash
POST /api/webhook

{
  "data": {
    "orderCode": 123456,
    "transactionId": "trans123",
    "status": "PAID",
    "amount": 10000,
    "paidAt": "2024-04-09T..."
  },
  "signature": "..."
}
```

## 🔄 Flow

```
React App (localhost:3000)
        ↓
Create Payment → Main Server (server.ts)
        ↓
Proxy to API Server (localhost:3001)
        ↓
PayOS API
        ↓
QR Code + Checkout URL returned
        ↓
Frontend displays QR or checkout link
        ↓
User completes payment in PayOS
        ↓
PayOS calls webhook → API Server
        ↓
API Server updates order status to "paid"
        ↓
Frontend polls check-order endpoint
        ↓
Gets "paid" status → shows success alert
        ↓
Saves invoice to Firebase
```

## 🧪 Test Webhook Locally

```bash
# Terminal 1: Start API server
npm run dev:api

# Terminal 2: Test webhook
curl -X POST http://localhost:3001/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "orderCode": 123456,
      "status": "PAID",
      "amount": 10000
    }
  }'

# Terminal 1: Should see logs:
# 📲 Raw webhook body: {...}
# 📲 Parsed webhook: {...}
# ✅ Order marked as PAID: 123456
```

## 📋 To Do

- [ ] Create `api/.env` with PayOS keys
- [ ] Run `npm run dev:all` to start both servers
- [ ] Test payment flow end-to-end
- [ ] Deploy API server to Vercel/Render
- [ ] Update PAYMENT_BACKEND_URL in deployment env

## 🚨 Troubleshooting

### "Cannot find module 'express'" in API
```bash
cd api && npm install
```

### Webhook not working
1. Check API server logs (should see "📲 Raw webhook body:")
2. Verify order exists in memory (check orderCode)
3. Verify status value matches PAID/SUCCESS/COMPLETED

### Payment not detected on frontend
1. Check browser console for polling logs
2. Verify API server is running on port 3001
3. Check `check-order` endpoint returns correct status
4. Check Firebase permissions if saving fails

## 📚 Related Files

- [API Server Code](./api/index.ts)
- [Main Server Proxy](./server.ts)
- [Frontend (no changes)](./src/App.tsx)

---

**Created**: 2024-04-09
**Updated**: With PayOS integration
