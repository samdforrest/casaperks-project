# CLAUDE.md — CasaPerks Rewards Dashboard

## Project Overview

CasaPerks is a points-based rewards dashboard for property management residents. Users log in, view their points balance and transaction history, browse a gift card catalog, and redeem points for gift cards.

**Stack:** Express + TypeScript (backend), React + TypeScript + Vite (frontend), flat JSON files (data store), JWT auth, Zod validation, express-rate-limit.

**Run command:** `npm run dev` from project root (starts both servers via concurrently)

---

## Project Structure

```
project-root/
├── server.ts                 ← entire Express backend (single file)
├── data/                     ← JSON flat files (in-memory at runtime)
│   ├── residents.json
│   ├── balances.json
│   ├── transactions.json
│   └── giftcards.json
└── client/                   ← Vite React app
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── context/AuthContext.tsx
        ├── api/client.ts
        ├── components/
        │   ├── LoginPage.tsx
        │   ├── Dashboard.tsx
        │   ├── ResidentPanel.tsx
        │   ├── PointsPanel.tsx
        │   ├── GiftCardPanel.tsx
        │   └── TransactionPanel.tsx
        └── types/index.ts
```

---

## Backend Rules

### Single-File Backend
All backend code lives in `server.ts`. Do not split into multiple files.

### Data Loading
- JSON files are loaded into memory at startup
- All mutations update in-memory arrays directly
- No file re-reads after startup

### API Endpoints

| Method | Route | Auth | Rate Limit | Description |
|--------|-------|------|------------|-------------|
| POST | `/auth/login` | No | No | Returns `{ token, residentId }` |
| GET | `/residents/:id` | JWT | No | Returns resident profile |
| GET | `/balances/:id` | JWT | No | Returns points balance |
| GET | `/transactions/:id` | JWT | No | Returns transaction history (empty array is valid) |
| GET | `/gift-cards/eligible/:id` | JWT | No | Returns full catalog with `eligible` flag |
| POST | `/redeem` | JWT | 5/min | Deducts points, creates transaction (residentId from JWT) |

### Backend Data Schemas (in giftcards.json)
```typescript
// Server-side GiftCard includes quantity
interface GiftCard {
  id: string;
  name: string;
  brand: string;
  pointsCost: number;
  category: string;
  quantity: number;  // decremented on redeem, checked for eligibility
}
```

### Security Layers
1. **JWT middleware** on all routes except `/auth/login`
2. **Zod validation** on `/redeem` body
3. **Rate limiting** (5 req/min per IP) on `/redeem`
4. **Server-side eligibility check** before any mutation: `balance >= pointsCost AND quantity > 0`

### Redeem Handler Logic (`POST /redeem`)
1. JWT middleware validates token and attaches payload to request
2. Extract `residentId` from JWT payload (no `:id` in URL, no residentId in body)
3. Validate body with Zod: `{ giftCardId: z.string() }`
3. Look up gift card by `giftCardId`
4. Look up balance by `residentId`
5. Check eligibility: `balance.points >= giftCard.pointsCost AND giftCard.quantity > 0`
6. Mutation 1: Deduct points from balance
7. Mutation 2: Decrement gift card quantity
8. Mutation 3: Append transaction record
9. Return `{ newBalance, transaction }`

---

## Frontend Rules

### Auth Layer
- JWT token stored in AuthContext (in-memory only, never localStorage)
- Token cleared on logout, nothing persists between sessions
- API client intercepts 401 and triggers logout

### Data Flow — On Mount
Four parallel GETs fire independently:
```
residentId → GET /residents/:id           → ResidentPanel
           → GET /balances/:id            → PointsPanel
           → GET /gift-cards/eligible/:id → GiftCardPanel
           → GET /transactions/:id        → TransactionPanel
```

Each panel manages its own `FetchStatus: 'idle' | 'loading' | 'success' | 'error'`.

### Data Flow — On Redemption
1. Show loading state on the clicked card's redeem button
2. Disable panel to prevent double-submit
3. POST `/redeem` with `{ giftCardId }` (residentId extracted from JWT)
4. On 200: Re-fetch balance, cards, transactions (NOT resident)
5. On 400/429: Show inline error state on the specific card, no re-fetch
6. On re-fetch failure: Retain stale data, show warning banner
7. Re-enable panel

Use `Promise.allSettled` for re-fetches so one failure doesn't block others.

### Panel Rendering Rules

**All panels:**
```typescript
if (status === 'loading') return <p>Loading...</p>;
if (status === 'error')   return <ErrorPanel onRetry={retry} />;
return <DataView data={data} />;
```

**ResidentPanel:** If 404/null, render page-level error and hide all other panels.

**PointsPanel:** `null` balance displays "Unavailable" (not "0"). `0` balance renders normally.

**GiftCardPanel:**
- `eligible: false` → card grayed out, button disabled (eligibility computed server-side)
- Redemption in-flight → button shows loading state
- Redemption failed → inline error state on that specific card (not modal or toast)
- Panel disabled during POST to prevent double-submit

**TransactionPanel:**
- Empty array → "No transactions yet"
- Missing fields → render row with "—" placeholder

### Stale Data Warning
If POST succeeds but re-fetch fails:
```
"Balance may be outdated. Refresh to update."
```
The redemption succeeded — never suggest otherwise.

---

## TypeScript Types

Define in `client/src/types/index.ts`:

```typescript
export interface Resident {
  id: string;
  name: string;
  email: string;
}

export interface Balance {
  residentId: string;
  points: number | null;   // null = unavailable, not zero
}

export interface Transaction {
  id: string;
  residentId: string;
  type: 'earn' | 'redeem';
  points: number;           // positive for earn, negative for redeem
  description: string;
  createdAt: string;        // ISO 8601
}

export interface GiftCardResponse {
  id: string;
  name: string;
  brand: string;
  pointsCost: number;
  category: string;
  eligible: boolean;        // computed server-side, frontend just reads it
}
// Note: quantity exists on server only — frontend does not need it

export interface RedeemResponse {
  newBalance: number;
  transaction: Transaction;
}

export interface AuthContextType {
  token: string | null;
  residentId: string | null;
  login: (token: string, residentId: string) => void;
  logout: () => void;
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';
```

---

## Known Tradeoffs (Intentional)

| Tradeoff | Why | Production Alternative |
|----------|-----|------------------------|
| Flat JSON files | Zero infra setup | PostgreSQL |
| No atomic transactions on redeem | Scope-appropriate risk | DB transaction with rollback |
| Balance separate from resident | Isolates write-heavy operations | Same, enforced by DB schema |
| Full catalog with `eligible` flag | Better UX than filtered list | Same approach |
| Hardcoded `password123` | Dev convenience | bcrypt + real auth |

---

## Test Credentials

```
Email:    sam.rivera@casaperks.com
Password: password123
```

---

## Implementation Guidelines

1. **Do not split `server.ts`** — keep all backend code in one file
2. **Panels are independent** — each has its own loading/error state
3. **Server is source of truth** — UI gates are for UX, server gates are for security
4. **Use pessimistic UI** for redemptions — button shows loading, then success/error inline
5. **Empty arrays are valid** — transactions `[]` is not a 404
6. **`null` is not zero** — null balance means unavailable, not broke
7. **residentId sources differ by endpoint** — GET endpoints use URL param (`:id`), POST `/redeem` uses JWT payload (no URL param, no body field)
8. **Eligibility is backend-only** — server computes `eligible` flag, frontend just reads it
9. **No caching** — single-user app, always fetch fresh data
