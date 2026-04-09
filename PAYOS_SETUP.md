# PayOS Integration Setup

## Your PayOS Account Credentials

```
Client ID: 149c8535-25c6-4a91-95f9-768b578c2322
API Key: b1bf5762-2343-4add-9b91-f9c7afe406c5
Checksum Key: 060202ee2764234ad50cd43a852e631216462edcbb6ced388c67f9d0f325ac43
Backend: https://backend-locket.vercel.app
```

## Quick Start

### 1. Local Development Setup

Create `.env` file:

```bash
# PayOS Configuration
PAYOS_CLIENT_ID=149c8535-25c6-4a91-95f9-768b578c2322
PAYOS_API_KEY=b1bf5762-2343-4add-9b91-f9c7afe406c5
PAYOS_CHECKSUM_KEY=060202ee2764234ad50cd43a852e631216462edcbb6ced388c67f9d0f325ac43

# URLs
VITE_BACKEND_URL=https://backend-locket.vercel.app
NODE_ENV=development
ADMIN_PASSWORD=admin123
```

Then start the dev server:
```bash
npm run dev
```

### 2. Render Production Deployment

In Render Dashboard → Environment Variables, add:

```
PAYOS_CLIENT_ID=149c8535-25c6-4a91-95f9-768b578c2322
PAYOS_API_KEY=b1bf5762-2343-4add-9b91-f9c7afe406c5
PAYOS_CHECKSUM_KEY=060202ee2764234ad50cd43a852e631216462edcbb6ced388c67f9d0f325ac43
VITE_BACKEND_URL=https://backend-locket.vercel.app
NODE_ENV=production
```

Then redeploy the service.

## How It Works

```
User enters username
    ↓
Clicks "Thanh toán để kích hoạt" (10.000đ)
    ↓
Backend generates PayOS payment request with signature
    ↓
PayOS returns QR code + checkout URL
    ↓
Frontend displays PayOS QR for scanning
    ↓
User scans & pays with mobile banking
    ↓
Frontend polls /api/check-order every 3 seconds
    ↓
When payment detected, shows "Kích hoạt ngay!" button
    ↓
User clicks to complete activation
```

## Frontend Payment Flow

When user clicks "Thanh toán":

1. **Generate random orderCode** (6 digits)
2. **Call** `POST /api/create-payment-link { orderCode: 123456 }`
3. **Receive PayOS QR code** from backend
4. **Display QR code** - user scans with mobile banking
5. **Poll /api/check-order/123456** every 3 seconds
6. **When status=PAID**, activate button becomes available
7. **User clicks "Kích hoạt ngay!"** to complete

## API Responses

### Create Payment
```json
{
  "success": true,
  "data": {
    "orderCode": 123456,
    "amount": 10000,
    "qrCode": "https://...qr-code-image...",
    "checkoutUrl": "https://checkout.payos.vn/web/...",
    "expiresAt": 1712345678000
  }
}
```

### Check Status
```json
{
  "success": true,
  "status": "PAID",
  "orderCode": 123456,
  "amount": 10000
}
```

## Testing Locally

### Test with Real Payment (QR Scan)
```bash
# 1. Start server
npm run dev

# 2. In browser: http://localhost:3000
# 3. Enter username, check status
# 4. Click "Thanh toán"
# 5. Scan PayOS QR with your phone's banking app
# 6. Complete payment
# 7. See "Kích hoạt ngay!" button auto-enable after 3 seconds
```

### Test with Manual Payment (Admin)
```bash
# Mark order as paid (for testing without real payment)
curl -X POST http://localhost:3000/api/admin/mark-paid/123456

# Then refresh browser - should show paid status
```

## Frontend Display

When user is in payment step, they see:
- ✅ PayOS QR code image
- ✅ Order code and amount
- ✅ "Thanh toán trên PayOS" link (to checkout page)
- ✅ Loading spinner with "Đang chờ thanh toán..." message

## Backend Details

### Signature Generation
```typescript
signature = HMAC-SHA256(
  data: `${orderCode}${amount}${description}`,
  key: PAYOS_CHECKSUM_KEY
)
```

### PayOS API Endpoint
```
POST https://api-merchant.payos.vn/api/payment-requests
Headers:
  x-client-id: PAYOS_CLIENT_ID
  x-api-key: PAYOS_API_KEY
  Content-Type: application/json
```

### Order Expiry
- Orders auto-expire after 30 minutes
- QR codes valid for 15 minutes
- User can request new payment link

## Troubleshooting

### "QR Code Not Displaying - Check Console"
```javascript
// Check Network tab in DevTools
// Look for: POST /api/create-payment-link
// 
// If error: 
// 1. Verify credentials in .env
// 2. Check environment variables in Render
// 3. Look at server logs for PayOS API error
```

### "Payment Not Detecting After Scan"
```bash
# Check if order exists
curl -X GET http://localhost:3000/api/check-order/123456

# If status still PENDING but you did pay:
# 1. Wait 10 seconds (polling delay)
# 2. Check PayOS dashboard for payment confirmation
# 3. Manually test with: curl -X POST .../api/admin/mark-paid/123456
```

### "Signature Error from PayOS"
```
Error: Signature validation failed
Solution:
1. Copy CHECKSUM_KEY again (very carefully!)
2. No spaces before/after
3. Restart dev server: npm run dev
4. Try again
```

### "Cannot Connect to PayOS API"
```
Error: ECONNREFUSED or timeout
Solution:
1. Check internet connection
2. Verify PayOS API is up: curl https://api-merchant.payos.vn/api/ping
3. Check Render logs if production
4. Firewall might be blocking (contact hosting provider)
```

## Production Checklist

- ✅ All 3 PayOS credentials in Render environment variables
- ✅ `VITE_BACKEND_URL` set to `https://backend-locket.vercel.app`
- ✅ `NODE_ENV` set to `production`
- ✅ Redeployed after changing environment variables
- ✅ Tested payment flow end-to-end
- ✅ Monitored logs for errors during first transactions
- ✅ Users see PayOS branding on QR display

## Support

- **PayOS Docs**: https://docs.payos.vn
- **PayOS Support**: https://payos.vn/support
- **Check Logs**: Render Dashboard → Select Service → View Logs
- **Test Credentials**: Available at https://dashboard.payos.vn

## Security

⚠️ **DO NOT commit credentials to GitHub!**
- Never share credentials via email/chat
- Use environment variables only
- Rotate if accidentally exposed
- Keep backups of checksum key

If credentials leaked:
1. Go to PayOS dashboard
2. Regenerate API Key and Checksum Key
3. Update environment variables
4. Redeploy
