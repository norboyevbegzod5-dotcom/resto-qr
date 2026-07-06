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
npx prisma migrate resolve --rolled-back "20260706120000_switch_to_resto_restaurantbot" 2>/dev/null || true
npx prisma migrate deploy
npx tsc -p tsconfig.json
echo "=== Build Complete ==="
