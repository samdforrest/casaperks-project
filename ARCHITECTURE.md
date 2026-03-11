# CasaPerks Rewards Dashboard — Architecture & Implementation Guide
## For Claude Code

---

## Project Summary

A points-based rewards dashboard for property management residents. A resident logs in, views their points balance and transaction history, browses a gift card catalog, and redeems points for gift cards.

**Stack:** Express + TypeScript (backend), React + TypeScript + Vite (frontend), flat JSON files (data store), JWT auth, Zod validation, express-rate-limit.

**Run command:** `npm run dev` from project root starts both servers via `concurrently`.

---

## Folder Structure

```
project-root/
├── package.json              ← root: concurrently, start script
├── tsconfig.json             ← root TypeScript config for server.ts
├── server.ts                 ← entire Express backend lives here
├── AI_WORKFLOW.md            ← AI usage documentation (required for submission)
├── README.md
│
├── data/                     ← mock JSON flat files, in-memory data store
│   ├── residents.json
│   ├── balances.json
│   ├── transactions.json
│   └── giftcards.json
│
└── client/                   ← Vite React app, self-contained
    ├── package.json
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── context/
        │   └── AuthContext.tsx
        ├── api/
        │   └── client.ts
        ├── components/
        │   ├── LoginPage.tsx
        │   ├── Dashboard.tsx
        │   ├── ResidentPanel.tsx
        │   ├── PointsPanel.tsx
        │   ├── GiftCardPanel.tsx
        │   └── TransactionPanel.tsx
        └── types/
            └── index.ts
```

---

## Root `package.json`

```json
{
  "name": "casaperks-rewards",
  "scripts": {
    "dev": "concurrently \"npx ts-node server.ts\" \"npm run dev --prefix client\"",
    "start": "concurrently \"npx ts-node server.ts\" \"npm run dev --prefix client\""
  },
  "dependencies": {
    "express": "^4.18.0",
    "jsonwebtoken": "^9.0.0",
    "zod": "^3.22.0",
    "express-rate-limit": "^7.0.0",
    "cors": "^2.8.5",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0",
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/cors": "^2.8.0",
    "concurrently": "^8.0.0"
  }
}
```

---

## TypeScript Types (shared reference)

Define these in `client/src/types/index.ts`. The backend uses inline types in `server.ts`.

```typescript
export interface Resident {
  id: string;
  name: string;
  email: string;
}

export interface Balance {
  residentId: string;
  points: number | null;   // null = unavailable (not the same as 0)
}

export interface Transaction {
  id: string;
  residentId: string;
  type: 'earn' | 'redeem';
  points: number;           // positive for earn, negative for redeem
  description: string;
  createdAt: string;        // ISO 8601
}

export interface GiftCard {
  id: string;
  name: string;
  brand: string;
  pointsCost: number;
  category: string;
}

// Response shape from GET /gift-cards/eligible/:id
// eligible is computed at API layer — NOT stored in giftcards.json
export interface GiftCardResponse extends GiftCard {
  eligible: boolean;
}

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

## Backend: `server.ts`

Single file. All routes, middleware, and data loading live here.

### Structure

```typescript
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'casaperks-secret-dev';  // hardcoded for dev only

app.use(cors());
app.use(express.json());

// ── DATA LOADING ──────────────────────────────────────────────────────────────
// Load JSON files into memory at startup. Mutations update these arrays directly.
// No file re-reads after startup — all state lives in memory.

const residents   = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/residents.json'), 'utf-8'));
const balances    = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/balances.json'), 'utf-8'));
const transactions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/transactions.json'), 'utf-8'));
const giftcards   = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/giftcards.json'), 'utf-8'));
```

### JWT Middleware

```typescript
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { residentId: string };
    req.residentId = payload.residentId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### Rate Limiter

```typescript
const redeemLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 5,
  message: { error: 'Too many redemption attempts. Please wait.' }
});
```

### Route: POST `/auth/login`

```typescript
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const resident = residents.find(r => r.email === email);
  if (!resident || password !== 'password123') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ residentId: resident.id }, JWT_SECRET);
  return res.json({ token, residentId: resident.id });
});
```

### Route: GET `/residents/:id`

```typescript
app.get('/residents/:id', authMiddleware, (req, res) => {
  const resident = residents.find(r => r.id === req.params.id);
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  return res.json(resident);
});
```

### Route: GET `/balances/:id`

```typescript
app.get('/balances/:id', authMiddleware, (req, res) => {
  const balance = balances.find(b => b.residentId === req.params.id);
  if (!balance) return res.status(404).json({ error: 'Balance not found' });
  return res.json(balance);
});
```

### Route: GET `/transactions/:id`

```typescript
app.get('/transactions/:id', authMiddleware, (req, res) => {
  const result = transactions
    .filter(t => t.residentId === req.params.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(result);  // empty array is valid, not a 404
});
```

### Route: GET `/gift-cards/eligible/:id`

```typescript
app.get('/gift-cards/eligible/:id', authMiddleware, (req, res) => {
  const balance = balances.find(b => b.residentId === req.params.id);
  if (!balance) return res.status(404).json({ error: 'Balance not found' });

  const result = giftcards.map(card => ({
    ...card,
    eligible: card.pointsCost <= balance.points
  }));
  return res.json(result);
});
```

### Route: POST `/residents/:id/redeem`

```typescript
const redeemSchema = z.object({
  giftCardId: z.string()
});

app.post('/residents/:id/redeem', authMiddleware, redeemLimiter, (req, res) => {
  // 1. Validate body
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request body' });

  const { giftCardId } = parsed.data;
  const residentId = req.params.id;

  // 2. Look up gift card
  const card = giftcards.find(g => g.id === giftCardId);
  if (!card) return res.status(404).json({ error: 'Gift card not found' });

  // 3. Look up balance
  const balanceEntry = balances.find(b => b.residentId === residentId);
  if (!balanceEntry) return res.status(404).json({ error: 'Balance not found' });

  // 4. Server-side balance check (dual-gate — UI also checks, but this is the enforced gate)
  if (balanceEntry.points < card.pointsCost) {
    return res.status(400).json({ error: 'Insufficient points' });
  }

  // 5. Mutation 1: deduct balance (in-memory)
  balanceEntry.points -= card.pointsCost;

  // 6. Mutation 2: append transaction (in-memory)
  const newTransaction = {
    id: `txn_${Date.now()}`,
    residentId,
    type: 'redeem',
    points: -card.pointsCost,
    description: `Redeemed: ${card.brand} ${card.name}`,
    createdAt: new Date().toISOString()
  };
  transactions.push(newTransaction);

  // 7. Respond
  return res.json({ newBalance: balanceEntry.points, transaction: newTransaction });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

> **Known tradeoff:** Two sequential in-memory mutations with no rollback. If the process crashes between them, the state is inconsistent. In production, wrap in a DB transaction. This is documented in TRADEOFFS.md.

---

## Frontend: Auth Layer

### `client/src/context/AuthContext.tsx`

```typescript
import { createContext, useContext, useState } from 'react';
import { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState<string | null>(null);
  const [residentId, setResidentId] = useState<string | null>(null);

  const login = (token: string, residentId: string) => {
    setToken(token);
    setResidentId(residentId);
  };

  const logout = () => {
    setToken(null);
    setResidentId(null);
  };

  return (
    <AuthContext.Provider value={{ token, residentId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

> Token is stored in-memory only — never localStorage. Cleared on logout. Nothing persists between sessions.

---

## Frontend: API Layer

### `client/src/api/client.ts`

```typescript
import { Resident, Balance, Transaction, GiftCardResponse, RedeemResponse } from '../types';

const BASE_URL = 'http://localhost:3001';

let _token: string | null = null;
let _logout: (() => void) | null = null;

export function setApiAuth(token: string, logout: () => void) {
  _token = token;
  _logout = logout;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': 'application/json'
    }
  });
  if (res.status === 401) { _logout?.(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.status === 401) { _logout?.(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Typed fetch functions ────────────────────────────────────────────────────
export const getResident      = (id: string) => get<Resident>(`/residents/${id}`);
export const getBalance       = (id: string) => get<Balance>(`/balances/${id}`);
export const getTransactions  = (id: string) => get<Transaction[]>(`/transactions/${id}`);
export const getEligibleCards = (id: string) => get<GiftCardResponse[]>(`/gift-cards/eligible/${id}`);
export const redeemCard       = (residentId: string, giftCardId: string) =>
  post<RedeemResponse>(`/residents/${residentId}/redeem`, { giftCardId });

export const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json() as Promise<{ token: string; residentId: string }>;
};
```

---

## Frontend: Dashboard Data Flow

### On Mount — 4 Parallel GETs

```typescript
// Inside Dashboard.tsx
const { residentId } = useAuth();

const [resident, setResident]     = useState<Resident | null>(null);
const [balance, setBalance]       = useState<Balance | null>(null);
const [cards, setCards]           = useState<GiftCardResponse[]>([]);
const [transactions, setTxs]      = useState<Transaction[]>([]);

// Per-panel status
const [residentStatus, setResidentStatus] = useState<FetchStatus>('idle');
const [balanceStatus, setBalanceStatus]   = useState<FetchStatus>('idle');
const [cardsStatus, setCardsStatus]       = useState<FetchStatus>('idle');
const [txStatus, setTxStatus]             = useState<FetchStatus>('idle');

// Stale data warning flag
const [showStaleWarning, setShowStaleWarning] = useState(false);

useEffect(() => {
  if (!residentId) return;

  // Set all panels to loading independently
  setResidentStatus('loading');
  setBalanceStatus('loading');
  setCardsStatus('loading');
  setTxStatus('loading');

  // Fire all four in parallel — each settles independently
  getResident(residentId)
    .then(data => { setResident(data); setResidentStatus('success'); })
    .catch(() => setResidentStatus('error'));

  getBalance(residentId)
    .then(data => { setBalance(data); setBalanceStatus('success'); })
    .catch(() => setBalanceStatus('error'));

  getEligibleCards(residentId)
    .then(data => { setCards(data); setCardsStatus('success'); })
    .catch(() => setCardsStatus('error'));

  getTransactions(residentId)
    .then(data => { setTxs(data); setTxStatus('success'); })
    .catch(() => setTxStatus('error'));
}, [residentId]);
```

### On Redeem — POST + 3 Selective Re-fetches

```typescript
// Inside GiftCardPanel.tsx
const [panelDisabled, setPanelDisabled] = useState(false);
const [cardError, setCardError]         = useState<{ cardId: string; message: string } | null>(null);

async function handleRedeem(giftCardId: string) {
  setPanelDisabled(true);    // prevent double-submit
  setCardError(null);

  try {
    await redeemCard(residentId, giftCardId);

    // Success — re-fetch only the three changed endpoints
    const results = await Promise.allSettled([
      getBalance(residentId),
      getEligibleCards(residentId),
      getTransactions(residentId)
    ]);

    // Apply results or show stale warning per failed re-fetch
    const [balResult, cardsResult, txResult] = results;
    let anyFailed = false;

    if (balResult.status === 'fulfilled') onBalanceUpdate(balResult.value);
    else anyFailed = true;

    if (cardsResult.status === 'fulfilled') onCardsUpdate(cardsResult.value);
    else anyFailed = true;

    if (txResult.status === 'fulfilled') onTxUpdate(txResult.value);
    else anyFailed = true;

    if (anyFailed) onShowStaleWarning();   // "Balance may be outdated, refresh to update"

  } catch (err: any) {
    // 400 / 429 — show inline error on the specific card
    setCardError({ cardId: giftCardId, message: err.message || 'Redemption failed.' });
  } finally {
    setPanelDisabled(false);
  }
}
```

> Use `Promise.allSettled` (not `Promise.all`) so a single re-fetch failure doesn't prevent the others from updating.

---

## Frontend: Component Rendering Rules

### Per-Panel State Pattern

Every panel follows the same three-state render pattern:

```typescript
// Generic pattern — apply to all four panels
if (status === 'loading') return <p>Loading...</p>;
if (status === 'error')   return <ErrorPanel onRetry={retry} />;
return <DataView data={data} />;
```

### ResidentPanel — Special Case

If resident is null (404), do not render other panels:

```typescript
if (residentStatus === 'error') {
  return <div>Resident not found. Please contact support.</div>;
  // Dashboard should NOT render PointsPanel, GiftCardPanel, or TransactionPanel
}
```

### PointsPanel

```typescript
// null balance = "Unavailable", not "0"
// 0 balance = render normally (all cards will be ineligible)
<span>{balance?.points != null ? balance.points.toLocaleString() : 'Unavailable'}</span>
```

### GiftCardPanel

```typescript
// Two separate disabled states — do not conflate
// 1. eligible: false → individual card grayed out
// 2. panelDisabled (POST in-flight) → entire panel non-interactive

cards.map(card => (
  <GiftCard
    key={card.id}
    card={card}
    disabled={!card.eligible || panelDisabled}
    error={cardError?.cardId === card.id ? cardError.message : null}
    onRedeem={() => handleRedeem(card.id)}
  />
))
```

### TransactionPanel

```typescript
// Sort newest-first (server should already sort, but defend client-side too)
// Render partial rows — missing fields as "—"
// Empty array is valid: "No transactions yet"
transactions.map(tx => (
  <tr key={tx.id}>
    <td>{tx.description || '—'}</td>
    <td>{tx.type === 'earn' ? `+${tx.points}` : `${tx.points}`}</td>
    <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '—'}</td>
  </tr>
))
```

---

## Stale Data Warning Banner

Displayed at the dashboard level when a post-redeem re-fetch fails. The redeem succeeded on the server — we must not suggest otherwise.

```typescript
{showStaleWarning && (
  <div role="alert">
    Balance may be outdated. Refresh to update.
    <button onClick={handleFullRefresh}>Refresh</button>
  </div>
)}
```

---

## `App.tsx` Routing

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

## Security Summary

| Layer | Mechanism | Where |
|-------|-----------|-------|
| Authentication | JWT middleware | All routes except `/auth/login` |
| Input validation | Zod schema | `POST /residents/:id/redeem` body |
| Rate limiting | express-rate-limit (5/min) | `POST /residents/:id/redeem` |
| UX gate | Disabled button + greyed card | GiftCardPanel (`eligible: false`) |
| Identity anchor | URL param only for `residentId` | Redeem handler — never from body |

---

## Known Tradeoffs (for presentation)

| Tradeoff | Decision | Production alternative |
|----------|----------|------------------------|
| Flat JSON vs database | Flat files — no infra overhead | PostgreSQL with transactions |
| Balance separate from resident | Isolated writes, clearer debugging | Same separation, enforced by DB schema |
| No atomic mutations on redeem | Two sequential writes, no rollback | DB transaction with rollback |
| Full catalog vs filtered | Return all with `eligible` flag | Same approach — filtering is a UX concern, not a security concern |
| Hardcoded password | `"password123"` for mock | bcrypt + real auth service |

---

## Test Credentials

```
Email:    sam.rivera@casaperks.com
Password: password123
```

---

*This document is the single source of truth for implementation. Build against it exactly.*
