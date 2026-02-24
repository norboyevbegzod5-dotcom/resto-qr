#!/bin/bash
set -e

echo "=== Building Admin Panel ==="
cd admin
npm install
npm run build
cd ..

echo "=== Building Backend ==="
cd backend
npm install
npx prisma generate
echo "Running tsc..."
npx tsc -p tsconfig.json || { echo "TSC FAILED"; exit 1; }
echo "=== Checking dist ==="
ls -la dist/ || { echo "dist/ not found!"; exit 1; }
ls -la dist/main.js || { echo "dist/main.js not found!"; exit 1; }
echo "=== Build Complete ==="
