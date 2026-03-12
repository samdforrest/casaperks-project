# CasaPerks Rewards Dashboard

A points-based rewards dashboard for property management residents. Users can log in, view their points balance, browse a gift card catalog, and redeem points for gift cards.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Express + TypeScript |
| Frontend | React + TypeScript + Vite |
| Auth | JWT (JSON Web Tokens) |
| Validation | Zod |
| Data Store | Flat JSON files (in-memory at runtime) |

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd casaperks-project

# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

> **Windows/Git Bash users:** If `npm` produces no output, use `npm.cmd` instead.

### Running the App

```bash
# Start both backend and frontend (from project root)
npm run dev
```

This starts:
- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:5173

### Test Credentials

```
Email:    sam.rivera@casaperks.com
Password: password123
```

---

## Project Structure

```
casaperks-project/
├── server.ts                 # Express backend (single file)
├── package.json              # Root dependencies + scripts
├── data/                     # JSON data files
│   ├── residents.json
│   ├── balances.json
│   ├── transactions.json
│   └── giftcards.json
├── client/                   # React frontend (Vite)
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── main.tsx          # Entry point
│       ├── App.tsx           # Auth-based routing
│       ├── types/index.ts    # TypeScript interfaces
│       ├── context/
│       │   └── AuthContext.tsx
│       ├── api/
│       │   └── client.ts     # API hooks
│       └── components/
│           ├── LoginPage.tsx
│           ├── Dashboard.tsx
│           ├── ResidentPanel.tsx
│           ├── PointsPanel.tsx
│           ├── GiftCardPanel.tsx
│           └── TransactionPanel.tsx
└── CLAUDE.md                 # Project specification
```

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/login` | No | Returns `{ token, residentId }` |
| GET | `/residents/:id` | JWT | Returns resident profile |
| GET | `/balances/:id` | JWT | Returns points balance |
| GET | `/transactions/:id` | JWT | Returns transaction history |
| GET | `/gift-cards/eligible/:id` | JWT | Returns catalog with `eligible` flag |
| POST | `/redeem` | JWT | Redeems a gift card (rate limited: 5/min) |

### Example: Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sam.rivera@casaperks.com","password":"password123"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "residentId": "resident_001"
}
```

### Example: Authenticated Request

```bash
curl http://localhost:3001/balances/resident_001 \
  -H "Authorization: Bearer <token>"
```

---

## Features

### Dashboard Panels

| Panel | Description |
|-------|-------------|
| Resident Info | Displays name, email, ID |
| Points Balance | Shows current points (`null` displays as "Unavailable") |
| Gift Cards | Grid of redeemable cards with eligibility status |
| Transactions | History table (empty state: "No transactions yet") |

### Redemption Flow

1. User clicks "Redeem" on an eligible gift card
2. Button shows loading state, panel is disabled
3. Server validates eligibility, deducts points, creates transaction
4. Frontend re-fetches balance, gift cards, and transactions
5. If re-fetch fails: shows "Balance may be outdated" warning

---

## Security Features

| Feature | Implementation |
|---------|----------------|
| **JWT Authentication** | All protected routes require valid Bearer token |
| **Input Validation** | Zod schema validation on `/redeem` endpoint |
| **Rate Limiting** | 5 requests/minute per IP on `/redeem` |
| **Server-side Eligibility** | Server re-validates before any mutation |
| **Token Storage** | In-memory only (not localStorage) |

### Dual-Layer Validation

- **Frontend:** Disables buttons, validates form inputs (UX protection)
- **Backend:** Re-validates everything before mutations (security protection)

The server never trusts the client. Even if a user bypasses the UI, the server rejects invalid requests.

---

## Data Persistence

Data is loaded from JSON files into memory at server startup. All mutations update in-memory arrays only.

**Important:** Restarting the server resets all data to the original JSON files.

| Tradeoff | Reason | Production Alternative |
|----------|--------|------------------------|
| In-memory storage | Zero infrastructure | PostgreSQL / MongoDB |
| No disk writes | Simplicity | Write-through to database |
| Hardcoded password | Dev convenience | bcrypt + hashed passwords |

---

## Development Notes

### React StrictMode

In development, you may see duplicate API requests on mount. This is intentional — React StrictMode double-fires effects to help catch bugs. This won't happen in production.

### Request Logging

The server logs all requests to the console:

```
POST /auth/login
GET /residents/resident_001
GET /balances/resident_001
POST /redeem
```

---

## Scripts

```bash
# Start development servers (backend + frontend)
npm run dev

# Start production (same as dev for this project)
npm start
```
