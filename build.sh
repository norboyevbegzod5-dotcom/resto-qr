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
npx prisma migrate deploy
npx tsc -p tsconfig.json
echo "=== Build Complete ==="
