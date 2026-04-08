#!/bin/bash
set -e

echo "Installing dependencies..."
npm ci

echo "Building Vite frontend..."
npm run build

echo "Building server..."
npm run build:server

echo "Build complete!"
