# 🎉 Backend API Setup Complete!

> Bỏ backend-locket.vercel.app cũ, tạo Payment API server mới với PayOS keys của bạn

## 🔄 Thay Đổi

### ✨ Tạo mới
- **`/api/`** - Payment API Backend
  - `index.ts` - Express server với PayOS integration
  - `package.json` - Dependencies
  - `tsconfig.json` - TypeScript config
  - `.env` - PayOS credentials (đã setup)
  - `.gitignore` - Không track .env

### 📝 Cập nhật
- **`server.ts`** - Proxy tới API server (port 3001)
- **`package.json`** - Thêm scripts: `dev:api`, `dev:all`
- **`.env.example`** - Hướng dẫn config

### 📚 Documentation
- **`API_SETUP.md`** - Hướng dẫn chi tiết
- **`QUICK_START.md`** - Bắt đầu nhanh
- **`setup.sh`** - Automated setup script

## 🚀 Bắt Đầu Ngay

```bash
# Terminal 1: Main server
npm run dev

# Terminal 2: API server
cd api && npm run dev
```

Hoặc một lệnh:
```bash
npm run dev:all
```

## 🌐 Endpoints Available

### Main Server (Port 3000)
- `POST /api/create-payment-link` - Tạo payment link
- `GET /api/check-order/:orderCode` - Check status
- `POST /api/webhook/payos` - Receive webhook

### API Server (Port 3001)
- Same endpoints but direct to PayOS

## 🔑 PayOS Configuration

Keys đã được setup trong `api/.env`:
```
PAYOS_CLIENT_ID=55bfd518-54df-4ee0-9a46-52479e60b8ac
PAYOS_API_KEY=70e01ab3-d65f-4299-9b1d-eafa6eb8341b
PAYOS_CHECKSUM_KEY=d7e36c73dcd2073925e623e3df43132bd73462a4cbd82dfa7b625ca185d5316e
```

## 📖 Documentation

- **[API_SETUP.md](./API_SETUP.md)** - Detailed setup guide
- **[QUICK_START.md](./QUICK_START.md)** - Quick reference
- **[api/index.ts](./api/index.ts)** - Source code với comments

## 🧪 Test Commands

```bash
# Test payment creation
curl -X POST http://localhost:3000/api/create-payment-link \
  -H "Content-Type: application/json" \
  -d '{"orderCode": 123456, "amount": 10000}'

# Test webhook
curl -X POST http://localhost:3001/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"data": {"orderCode": 123456, "status": "PAID"}}'

# Check status
curl http://localhost:3001/api/check-order/123456
```

## 🎯 Next Steps

1. ✅ **Setup Complete** - PayOS keys configured
2. **Run Servers** - `npm run dev` + `npm run dev:api`
3. **Test Payment** - Create payment link, scan QR
4. **Monitor Logs** - Check both terminal outputs
5. **Deploy** - Push to Render/Vercel when ready

## 🔗 Architecture

```
Frontend (React)
    ↓
Main Server (Port 3000)
    ↓
API Server (Port 3001) ← Your new backend
    ↓
PayOS API (HTTPS)
```

**Removed**: `https://backend-locket.vercel.app` dependency  
**Added**: Local PayOS integration with your credentials

---

**Ready to go!** 🚀 Run your servers and test the payment flow!
