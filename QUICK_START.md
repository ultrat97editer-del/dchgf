# 🎯 Quick Start - Payment API với PayOS

## ✅ Đã Setup

- ✅ Tạo `/api` folder với Payment API server
- ✅ PayOS keys được cấu hình trong `api/.env`
- ✅ Proxy server (`server.ts`) sẵn sàng
- ✅ All endpoints ready

## 🚀 Chạy Hệ Thống

### Option 1: Chạy 2 terminals riêng (Recommended)

**Terminal 1: Main Server (Port 3000)**
```bash
npm run dev
```

**Terminal 2: Payment API Server (Port 3001)**
```bash
cd api && npm run dev
```

### Option 2: Chạy cùng lúc (Sau khi install xong)
```bash
npm run dev:all
```

## 🧪 Test Payment Flow

### 1. Create Payment Link
```bash
curl -X POST http://localhost:3000/api/create-payment-link \
  -H "Content-Type: application/json" \
  -d '{
    "orderCode": 123456,
    "amount": 10000,
    "description": "Test Payment"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "orderCode": 123456,
    "amount": 10000,
    "qrCode": "00020101021238...",
    "checkoutUrl": "https://pay.payos.vn/..."
  }
}
```

### 2. Check Order (Polling)
```bash
curl http://localhost:3001/api/check-order/123456
```

Response:
```json
{
  "success": true,
  "orderCode": 123456,
  "status": "pending",
  "amount": 10000,
  "createdAt": "2024-04-09T..."
}
```

### 3. Test Webhook
```bash
curl -X POST http://localhost:3001/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "orderCode": 123456,
      "status": "PAID",
      "amount": 10000
    }
  }'
```

### 4. Verify Status Changed
```bash
curl http://localhost:3001/api/check-order/123456
```

Status should now be `paid`

## 📝 Configuration

### Environment Variables

**Main Server (.env)**
```
VITE_BACKEND_URL=http://localhost:3000
PAYMENT_BACKEND_URL=http://localhost:3001
NODE_ENV=development
```

**API Server (api/.env)** - Already configured with:
```
PAYOS_CLIENT_ID=55bfd518-54df-4ee0-9a46-52479e60b8ac
PAYOS_API_KEY=70e01ab3-d65f-4299-9b1d-eafa6eb8341b
PAYOS_CHECKSUM_KEY=d7e36c73dcd2073925e623e3df43132bd73462a4cbd82dfa7b625ca185d5316e
PORT=3001
```

## 🌐 Payment Flow

```
React App
    ↓
User clicks "Thanh toán" button
    ↓
POST /api/create-payment-link (port 3000)
    ↓ Proxy to
POST /api/create-payment-link (port 3001)
    ↓
Call PayOS API with your credentials
    ↓
Get QR Code + Checkout URL
    ↓
Display QR to user
    ↓
User scans/clicks → PayOS payment
    ↓
PayOS callback → /api/webhook
    ↓
Order status → "paid"
    ↓
Frontend polls → detects payment
    ↓
Save to Firebase + Show success
```

## 🐛 Troubleshooting

### Port 3000/3001 already in use?
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### API server not starting?
```bash
# Check syntax
cd api && node -c index.ts

# Check dependencies
npm install

# Try with tsx directly
tsx index.ts
```

### Payment not detecting?
1. Check browser console for polling logs
2. Verify API server is running: `curl http://localhost:3001/health`
3. Test webhook manually (see above)
4. Check Firebase rules and auth

### Webhook format unclear?
Check `api/index.ts` webhook handler - supports:
- `data.orderCode` or `orderCode`
- `data.status` or `status`
- Status values: PAID, SUCCESS, COMPLETED

## 📚 Architecture

```
locket.io.vn (Frontend + Main Server)
    ↓
server.ts (Port 3000)
    - /api/create-payment-link → proxies to port 3001
    - /api/check-order/:code → proxies to port 3001
    - /api/webhook/payos → proxies to port 3001
    ↓
api/index.ts (Port 3001)
    - Raw PayOS API integration
    - Webhook reception
    - Order state management
    ↓
PayOS API (HTTPS)
    - Payment processing
    - Webhook callbacks
```

## 📋 Files Changes

- ✨ **New**: `/api/` - Payment API server
- ✨ **New**: `/setup.sh` - Automated setup
- ✨ **New**: `/API_SETUP.md` - Full documentation
- ✨ **New**: `/api/.env` - PayOS configuration
- 📝 **Updated**: `server.ts` - Proxy logic
- 📝 **Updated**: `package.json` - New scripts

## ✅ Next Steps

1. Make sure both servers are running
2. Open http://localhost:3000
3. Test full payment flow
4. Monitor logs in both terminals
5. Verify webhook format matches

---
**Setup Complete!** 🎉 Your PayOS integration is ready to go!
