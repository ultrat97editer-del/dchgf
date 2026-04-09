#!/bin/bash

# Setup script for Locket Payment API

echo "🚀 Locket Payment API Setup"
echo "============================"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Setup API server
echo "📦 Setting up API server..."
cd api

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating api/.env with PayOS credentials..."
    cat > .env << 'EOF'
PAYOS_CLIENT_ID=55bfd518-54df-4ee0-9a46-52479e60b8ac
PAYOS_API_KEY=70e01ab3-d65f-4299-9b1d-eafa6eb8341b
PAYOS_CHECKSUM_KEY=d7e36c73dcd2073925e623e3df43132bd73462a4cbd82dfa7b625ca185d5316e

PORT=3001
NODE_ENV=development
WEBHOOK_URL=https://locket.io.vn/api/webhook
EOF
    echo "✅ Created api/.env"
else
    echo "✅ api/.env already exists"
fi

echo ""
echo "📦 Installing API server dependencies..."
npm install

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Run: npm run dev:all"
echo "   2. Open: http://localhost:3000"
echo "   3. Test payment flow"
echo ""
echo "🧪 Or run servers separately:"
echo "   Terminal 1: npm run dev"
echo "   Terminal 2: npm run dev:api"
echo ""
