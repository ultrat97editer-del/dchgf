# Render deployment guide

## Deploy on Render

1. Go to https://render.com/dashboard
2. Create new "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `bash render-build.sh`
   - **Start Command**: `node server.obfuscated.js`
   - **Environment**: Select "Node"
   - **Node Version**: 20 or higher

5. Add these Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   ```

6. Deploy!

## Troubleshooting 521 Error

The 521 error means the web server is down. This is usually fixed by:

1. ✅ Fixed: `app.get('*all', ...)` → `app.get('*', ...)`
   - This allows proper SPA routing and static file fallback

2. ✅ Added: Proper static file serving with cache headers
   - `app.use(express.static(distPath, { maxAge: '1h' }))`

3. ✅ Added: render.yaml for Render deployment configuration

4. ✅ Added: render-build.sh script for proper build order

## Local Testing

```bash
npm run build
bash render-build.sh
npm start
```

Then visit http://localhost:3000

## Notes

- Server starts on port 3000 (configurable via PORT env var)
- Listens on all interfaces (0.0.0.0)
- Falls back to index.html for all unknown routes (SPA)
- Static files served from dist/ with 1h cache
