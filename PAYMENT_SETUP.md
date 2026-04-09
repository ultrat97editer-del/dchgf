# Payment QR Code Configuration Guide

## Issue Fixed
✅ PayOS/VietQR code now displays correctly with proper bank account information.

## Setup Instructions

### 1. Local Development Setup

Create `.env` file in project root:

```bash
# Payment Configuration
BANK_ACCOUNT=1234567890
BANK_BIN=970416

# Admin
ADMIN_PASSWORD=admin123

# Backend
VITE_BACKEND_URL=http://localhost:3000
```

### 2. Production / Render Deployment

In Render dashboard, set these environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `BANK_ACCOUNT` | Your bank account number | Replace with actual account |
| `BANK_BIN` | `970416` | See bank codes below |
| `ADMIN_PASSWORD` | Your secure password | Change from default |
| `NODE_ENV` | `production` | Required |
| `VITE_BACKEND_URL` | Your deployment URL | e.g., `https://your-app.onrender.com` |

### 3. Bank Codes Reference

```
970416 = Vietcombank (CTG)
970407 = Vietinbank (CTJ)
970439 = Techcombank (TCB)
970449 = ACB
970418 = Agribank (AGB)
970425 = Maritime Bank (MSB)
970432 = Sacombank (STB)
970443 = VPBank (VPB)
```

## How It Works

1. **User initiates payment** → Clicks "Thanh toán để kích hoạt"
2. **Backend generates VietQR** → Uses `img.vietqr.io` API with bank info
3. **Frontend displays QR** → User scans with mobile banking app
4. **Payment received** → Order status changes to PAID
5. **Auto-activation** → User can click "Kích hoạt ngay!"

## API Endpoints

### Create Payment Link
```bash
POST /api/create-payment-link
Body: { orderCode: 123456 }
Response: {
  success: true,
  data: {
    orderCode: 123456,
    amount: 10000,
    bin: "970416",
    accountNumber: "1234567890",
    accountName: "LOCKET VIP",
    description: "Payment_123456",
    qrCode: "https://img.vietqr.io/image/...",
    expiresAt: 1712345678000
  }
}
```

### Check Order Status
```bash
GET /api/check-order/123456
Response: {
  success: true,
  status: "PENDING" | "PAID",
  orderCode: 123456,
  amount: 10000
}
```

### Admin Mark as Paid (Testing)
```bash
POST /api/admin/mark-paid/123456
Response: { success: true, message: "Order marked as paid" }
```

## Testing Payment Flow

### Local Testing
```bash
# 1. Start the dev server
npm run dev

# 2. Enter a username and check status
# 3. Click "Thanh toán để kích hoạt"
# 4. You should see the VietQR code
# 5. Manually mark as paid (for testing):
curl -X POST http://localhost:3000/api/admin/mark-paid/123456

# 6. Front-end should detect payment after 3 seconds
```

### Production Testing
- Use Render's "View Logs" to debug
- Check browser console for API errors
- Verify `BANK_ACCOUNT` is configured in Render environment

## Troubleshooting

### QR Code Not Displaying
- ✅ Check that `BANK_ACCOUNT` is set in environment
- ✅ Verify `BANK_BIN` matches your bank
- ✅ Check browser console for errors
- ✅ Ensure img.vietqr.io is accessible from your location

### Payment Status Not Updating
- ✅ Check `/api/check-order/:orderCode` response
- ✅ Verify order exists in memory (within 30 minutes)
- ✅ For production, integrate with real payment webhook

### Environment Variables Not Loading
- ✅ In local: Restart `npm run dev` after editing `.env`
- ✅ In Render: Redeploy after updating environment variables

## Next Steps

1. **Replace placeholder account** with your actual bank account
2. **Test with real transactions** for production
3. **Integrate payment webhook** for automatic payment detection
4. **Connect to database** (Firebase Firestore recommended) for persistent order tracking
5. **Add security** (rate limiting, signature verification, etc.)

## Support

For issues contact: [Your contact info]
