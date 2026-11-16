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

Copy `server/.env.example` to `server/.env` for local development. The backend loads this file directly, including when started from the repository root. Leaving `MONGODB_URI` blank uses a temporary in-memory database and demo accounts; local data is discarded when the server stops.

### Production database

Create a MongoDB Atlas cluster (or use another managed MongoDB service), then create a database user limited to `readWrite` access on the FoodLoop database. In the provider's network-access settings, allow the backend host's outbound IP addresses; avoid opening database access to every IP. Keep the database URI and all other secrets in the hosting provider's environment settings, never in source control.

Set these variables for the backend deployment:

```text
NODE_ENV=production
MONGODB_URI=mongodb+srv://<db-user>:<encoded-password>@<cluster-host>/<database>?retryWrites=true&w=majority
JWT_SECRET=<random-secret-at-least-32-characters-long>
CLIENT_ORIGIN=https://<your-frontend-host>
PORT=<provided-by-hosting-platform>
```

URL-encode reserved characters in the database username or password. Production startup fails if `MONGODB_URI` is missing or the database cannot be reached; it never falls back to temporary storage and does not create demo accounts. The backend can be started with `npm start`. Verify deployment with `GET /api/health`, which should report `"database":"connected"`.

The frontend calls `/api` and `/uploads` on its own origin. Configure the hosting platform or reverse proxy to route those paths to the backend. Uploaded images currently live on the backend filesystem, so use a persistent disk or move uploads to object storage before deploying to a host with ephemeral filesystems.

## API

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/donations`, `POST /api/donations`
- `PATCH /api/donations/:id/claim`, `PATCH /api/donations/:id/verify-pickup`
- `GET /api/admin/stats`, `GET /api/admin/users`
- `POST /api/reports`