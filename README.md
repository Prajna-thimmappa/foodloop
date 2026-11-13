# FoodLoop

FoodLoop connects local food donors with NGOs and volunteers to make surplus food easier to redistribute.

## Run locally

Requirements: Node.js 18+ and npm. MongoDB is optional for the client demo; configure it to persist API data.

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`). The Express API runs on `http://localhost:5000`.

## Environment

Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and `JWT_SECRET` to enable database-backed accounts and donations. Without a MongoDB connection, the API reports a clear unavailable status while the client remains usable with browser-local demo data.

## API

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/donations`, `POST /api/donations`
- `PATCH /api/donations/:id/claim`, `PATCH /api/donations/:id/verify-pickup`
- `GET /api/admin/stats`, `GET /api/admin/users`
- `POST /api/reports`