# Locket Activator - Deployment Fixes & Setup Guide

## Problems Fixed ❌→✅

### 1. **Error 521: Web server is down**
   - **Problem**: `app.get('*all', ...)` typo prevented proper SPA routing
   - **Fix**: Changed to `app.get('*', ...)` 
   - **Impact**: Now properly serves static files and falls back to index.html

### 2. **Static Files Not Served**
   - **Problem**: Missing cache headers and improper static serving
   - **Fix**: Added `app.use(express.static(distPath, { maxAge: '1h' }))`
   - **Impact**: Better performance and reliability

### 3. **Build Process Issues**
   - **Problem**: No clear build script for Render
   - **Fix**: Created `render-build.sh` that ensures proper build order
   - **Impact**: Consistent builds across environments

### 4. **Hardcoded Backend URL**
   - **Problem**: Frontend API URL hardcoded to `backend-locket.vercel.app`
   - **Fix**: Added environment variable support with fallback
   - **Impact**: Can deploy on Render and still route to external backend

---

## Deploy on Render

### Step 1: Prepare repository

```bash
# Make render-build.sh executable
chmod +x render-build.sh

# Commit all changes
git add .
git commit -m "Fix: Render deployment configuration"
git push origin main
```

### Step 2: Create Render service

1. Go to **https://render.com/dashboard**
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (`dchgf`)
4. Configure:

   | Setting | Value |
   |---------|-------|
   | **Name** | `locket-activator` |
   | **Environment** | `Node` |
   | **Build Command** | `bash render-build.sh` |
   | **Start Command** | `node server.obfuscated.js` |

5. Set **Environment Variables**:

   ```
   NODE_ENV=production
   PORT=3000
   VITE_BACKEND_URL=https://backend-locket.vercel.app
   ```

   > ⚠️ If you have payment API on same server, update to match your Render URL

6. Click **"Create Web Service"** and wait for deployment

---

## After Deployment

### Verify working:
```bash
# Check your deployed URL (e.g., https://locket-activator.onrender.com)
curl https://locket-activator.onrender.com
```

### Update Cloudflare DNS (if using):
- Set your domain's CNAME to point to Render URL
- Allow 5-10 minutes for DNS propagation
- Check that:
  - ✅ Frontend loads
  - ✅ API calls work (`/api/status`, etc.)
  - ✅ No 521 errors

---

## Testing Locally Before Deploy

```bash
# Install dependencies
npm install

# Build everything
npm run build
bash render-build.sh

# Start server
npm start
```

Then visit **http://localhost:3000** and verify:
- ✅ Page loads
- ✅ SPA routing works (try different tabs)
- ✅ API calls respond
- ✅ Static files load (CSS, images, etc.)

---

## Troubleshooting

### Still getting 521 error?

1. **Check Render logs**:
   - Go to Render dashboard
   - Click your service
   - Check "Logs" tab for errors

2. **Common issues**:
   - ❌ `ENOENT: cannot find dist/index.html` 
     → Build script failed, check `npm run build` locally
   
   - ❌ `Cannot find module 'express'`
     → Dependencies not installed, check `package.json`
   
   - ❌ `Port already in use`
     → Render assigns PORT via env var, ensure code uses `process.env.PORT`

3. **Force rebuild**:
   - In Render dashboard, click "Clear Build Cache" and redeploy

### Backend API calls failing?

If you're seeing API errors, check:
- Is `backend-locket.vercel.app` still running?
- Does CORS allow requests from your Render domain?
- Check Admin auth endpoint: `/api/admin-auth`

---

## Files Modified

- ✅ `server.ts` - Fixed routing pattern (*all → *)
- ✅ `src/App.tsx` - Added environment variable for backend URL
- ✅ `render.yaml` - Render deployment configuration
- ✅ `render-build.sh` - Build script
- ✅ `.node-version` - Node.js version specification
- ✅ `.env.example` - Environment variables template

---

## Next Steps (Optional Improvements)

- [ ] Move payment APIs to Express server (avoid external API dependency)
- [ ] Add error logging/monitoring
- [ ] Setup database for invoice history (already using Firebase)
- [ ] Add rate limiting to API endpoints
- [ ] Setup CI/CD for automatic deployments

---

**Questions?** Check Render docs: https://render.com/docs
