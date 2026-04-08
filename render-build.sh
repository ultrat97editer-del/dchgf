#!/bin/bash
set -e

echo "Installing dependencies..."
npm ci

echo "Building Vite frontend..."
npm run build

echo "Building and obfuscating server..."
node scripts/obfuscate.js

echo "Build complete!"
