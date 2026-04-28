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
PAYOS_CLIENT_ID=fc23ad6f-597d-452e-bbe7-c8e0d52f60cc
PAYOS_API_KEY=dc5d00d1-7e92-4c04-8dee-cdce05c815db
PAYOS_CHECKSUM_KEY=db72150847118c7c81f06d3cf8db2245d77d69f02a8a38b9807dd7b635a9c4f9

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
