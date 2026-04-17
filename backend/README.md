# Hotel Pramod Backend (Node/Express + PostgreSQL)

SRS-aligned backend for Hotel Pramod Sales CRM + CRS.

## Prerequisites
- Node.js 18+
- PostgreSQL 14+

## Setup
1. Create a database (example: `hotel_pramod`)
2. Copy env

```bash
cd backend
copy .env.example .env
```

3. Update `DATABASE_URL` in `.env` to match your local Postgres credentials.

3. Install deps

```bash
npm install
```

4. Apply schema + seed

```bash
npm run db:init
npm run db:seed
```

5. Run API

```bash
npm run dev
```

Health check: `GET /health`

## Default seed login
- Email: `admin@hotelpramod.local`
- Password: `Admin@123`

## Main API groups
- `POST /api/auth/login`
- `GET /api/auth/me`
- CRS: `/api/crs/*`
- CRM: `/api/crm/*`
- Banquet: `/api/banquet/*`
- Corporate: `/api/corporate/*`
- Finance: `/api/finance/*`
- Reports: `/api/reports/*`

