# Resto QR — Voucher Lottery System

Restaurant voucher lottery system with admin panel and Telegram bot integration.

## Architecture

- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL
- **Admin Panel**: React + TypeScript + Vite + Tailwind CSS
- **Telegram Bot**: Telegraf (integrated into backend)

## Quick Start

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your settings (database URL, bot token, JWT secret)
npm install
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run start:dev
```

### 3. Admin Panel Setup

```bash
cd admin
npm install
npm run dev
```

### 4. Access

- **Admin Panel**: http://localhost:5173
- **API Docs (Swagger)**: http://localhost:3000/api/docs
- **Default login**: admin / admin123

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts             # Seed data
├── src/
│   ├── common/             # Prisma service, guards
│   ├── modules/
│   │   ├── auth/           # JWT authentication
│   │   ├── users/          # User management
│   │   ├── brands/         # Brand CRUD
│   │   ├── campaigns/      # Campaign CRUD
│   │   ├── vouchers/       # Voucher management & generation
│   │   ├── bot/            # Telegram bot integration
│   │   └── admin/          # Admin API endpoints
│   ├── app.module.ts
│   └── main.ts

admin/
├── src/
│   ├── api/                # API client & endpoints
│   ├── components/         # Layout, shared components
│   ├── pages/              # Dashboard, Users, Brands, Campaigns, Vouchers, Lottery
│   ├── App.tsx
│   └── main.tsx
```

## Key Features

- **Voucher Generation**: Generate unique codes per campaign & brand
- **Telegram Bot**: Deep-link activation via QR codes, user statistics
- **Lottery Check**: Real-time code verification for draw day
- **CSV Export**: Export voucher data for printing
- **Eligibility Engine**: Configurable min vouchers & min brands per campaign

## API Endpoints

### Auth
- `POST /api/auth/login` — Admin login

### Bot
- `POST /api/bot/activate-code` — Activate a voucher code
- `GET /api/bot/status?chatId=...` — Get user stats

### Admin (JWT protected)
- `GET /api/admin/stats` — Dashboard statistics
- `GET /api/admin/users` — List users with eligibility
- `GET/POST /api/admin/brands` — Brand management
- `GET/POST/PUT/DELETE /api/admin/campaigns` — Campaign management
- `GET /api/admin/vouchers` — List vouchers with filters
- `POST /api/admin/vouchers/generate` — Generate voucher codes
- `GET /api/admin/vouchers/export` — CSV export
- `POST /api/admin/check-code` — Lottery code check
- `POST /api/admin/mark-winner` — Mark winner

## Telegram Bot

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` in `.env`.

QR codes on vouchers should link to:
```
https://t.me/<bot_username>?start=CODE_XXXXXXX
```

The bot supports:
- Language selection (RU/UZ)
- Phone number collection
- Deep-link code activation
- "My codes" command with stats
