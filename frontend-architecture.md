# Frontend Architecture Documentation
## CasaPerks Rewards Dashboard — React + TypeScript

---

## 1. Overview

The frontend is a React + TypeScript single-page application that consumes a flat REST API. All UI state derives from server responses. The application has no local state that represents authoritative data — the server is always the source of truth.

The architecture has four distinct layers:

```
┌─────────────────────────────────────────┐
│              Auth Layer                 │  JWT token, AuthContext, ProtectedRoute
├─────────────────────────────────────────┤
│              API Layer                  │  apiClient, typed fetch wrappers
├─────────────────────────────────────────┤
│           Component Layer               │  Independent panels per entity
├─────────────────────────────────────────┤
│            Data Layer (server)          │  residents / balances / transactions / giftcards
└─────────────────────────────────────────┘
```

Each layer has a single responsibility and communicates only with the layer directly adjacent to it.

---

## 2. Auth Layer

### 2.1 Login Flow

```
POST /auth/login  { email, password }
  → 200 OK: { token: "eyJ...", residentId: "resident_001" }
  → token stored in AuthContext (in-memory, NOT localStorage)
  → residentId stored directly from login response
  → user redirected to /dashboard
```

The JWT payload contains the identity anchor for all subsequent requests:

```json
{
  "residentId": "resident_001"
}
```

> **Critical:** The token carries identity, not data. `residentId` is the key used to fetch all entity data. Balance, transactions, and gift cards are never stored in the token — they are always fetched fresh from the API.

### 2.2 AuthContext Shape

```typescript
interface AuthContextType {
  token: string | null;
  residentId: string | null;
  login: (token: string, residentId: string) => void;
  logout: () => void;
}
```

`AuthContext` is the single source of identity for the entire application. Every API call derives its ID parameters from `residentId` stored here.

### 2.3 Token Expiry

When a token expires, the server returns `401 Unauthorized`. The API client intercepts this response, calls `logout()` on AuthContext, and redirects to `/login`. The user must re-authenticate to re-establish identity.

The `residentId` and all entity data are cleared from memory on logout. Nothing persists between sessions.

### 2.4 Protected Route

Every feature route is wrapped in a `ProtectedRoute` component:

```typescript
// ProtectedRoute checks AuthContext before rendering children
// If no token → redirect to /login
// If token present → render the route

<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

---

## 3. API Layer

### 3.1 apiClient Abstraction

A single `apiClient` wraps all fetch calls. It handles:
- Attaching the `Authorization: Bearer <token>` header on every request
- Intercepting `401` responses and triggering logout
- Returning typed responses

```typescript
const apiClient = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401) {
      logout();         // clear AuthContext
      redirect('/login');
      return;
    }

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as T;
  },

  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (res.status === 401) { logout(); redirect('/login'); return; }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as T;
  }
};
```

> **Why this matters:** Auth logic lives in one place. No individual component handles tokens or 401s. If the auth mechanism changes, only `apiClient` needs to change.

### 3.2 Entity Fetch Functions

Each entity has a typed fetch function that calls `apiClient`:

```typescript
const getResident      = (id: string) => apiClient.get<Resident>(`/residents/${id}`);
const getBalance       = (id: string) => apiClient.get<Balance>(`/balances/${id}`);
const getTransactions  = (id: string) => apiClient.get<Transaction[]>(`/transactions/${id}`);
const getEligibleCards = (id: string) => apiClient.get<GiftCardResponse[]>(`/gift-cards/eligible/${id}`);
const redeemCard       = (residentId: string, giftCardId: string) =>
  apiClient.post<RedeemResponse>(`/residents/${residentId}/redeem`, { giftCardId });
```

---

## 4. Data Flow — On Mount

When the dashboard loads, four GET requests fire in parallel using `Promise.all`. Each targets a separate entity and populates an independent panel.

```
AuthContext.residentId
        │
        ├──→ GET /residents/:id           → ResidentPanel
        ├──→ GET /balances/:id            → PointsPanel
        ├──→ GET /gift-cards/eligible/:id → GiftCardPanel
        └──→ GET /transactions/:id        → TransactionPanel
```

These fire simultaneously — no panel waits on another. Each panel manages its own loading and error state independently.

```typescript
// Dashboard mount
const { residentId } = useAuth();

useEffect(() => {
  Promise.all([
    fetchResident(residentId),
    fetchBalance(residentId),
    fetchEligibleCards(residentId),
    fetchTransactions(residentId)
  ]);
}, [residentId]);
```

---

## 5. Data Flow — On Redemption

A redemption mutates two things on the server: balance (debit) and transactions (new record). Gift card eligibility is re-evaluated as a result. Resident profile data is untouched.

```
User clicks "Redeem" on a GiftCard
        │
        ↓
[Disable entire GiftCard panel — prevent double-submit]
        │
        ↓
POST /residents/:id/redeem  { giftCardId }
        │
        ├── 200 OK → re-fetch THREE endpoints only:
        │     ├── GET /balances/:id            (balance changed)
        │     ├── GET /gift-cards/eligible/:id  (eligibility re-evaluated)
        │     └── GET /transactions/:id         (new record added)
        │     // Resident profile NOT re-fetched — it did not change
        │
        ├── 400 Error → display inline error message on the card
        │     → no re-fetch required
        │
        └── Re-fetch failure (200 POST, but a subsequent GET fails)
              → retain stale data in the affected panel
              → display warning banner: "Balance may be outdated, refresh to update"
```

### 5.1 Why Pessimistic UI

The redeem action uses pessimistic UI — the interface waits for server confirmation before updating. This is deliberate:

- Points deduction is financially consequential
- The server re-validates balance before mutating (defense in depth)
- A failed redemption should surface clearly, not silently roll back

### 5.2 The 400 Response

A `400` on redemption means the server rejected the request after re-checking balance. This can happen if a race condition occurs (e.g., the page was open for a long time and balance changed server-side). The inline error is displayed directly on the gift card component that was clicked:

```
"Insufficient points."
```

No re-fetch is triggered on a 400 — the user's current data is still accurate since no mutation occurred.

### 5.3 Stale Data Warning

If the POST /redeem succeeds (200) but one or more of the three follow-up GETs fails, the redemption is confirmed on the server but the UI cannot reflect the updated state. In this case:

- The panel retains its last known data (stale)
- A warning banner is displayed: **"Balance may be outdated, refresh to update"**
- No rollback is attempted — the server transaction succeeded

---

## 6. Entity Types

All entities use TypeScript interfaces that match the flat JSON file schemas exactly. `null` and `undefined` are handled distinctly — a `null` balance is not the same as a `0` balance.

```typescript
interface Resident {
  id: string;
  name: string;
  email: string;
}

interface Balance {
  residentId: string;
  points: number | null;   // null = unavailable, not zero
}

interface GiftCard {
  id: string;
  name: string;
  brand: string;
  pointsCost: number;
  category: string;
}

// Response shape from GET /gift-cards/eligible/:id
// eligible flag is computed at the API layer, not stored in giftcards.json
interface GiftCardResponse extends GiftCard {
  eligible: boolean;
}

interface Transaction {
  id: string;
  residentId: string;
  type: 'earn' | 'redeem';
  points: number;           // positive for earn, negative for redeem
  description: string;
  createdAt: string;        // ISO 8601 timestamp
}

interface RedeemResponse {
  newBalance: number;
  transaction: Transaction;
}
```

---

## 7. Per-Entity Loading & Error States

Each panel tracks its own status independently. A failed transaction fetch does not affect the resident panel or gift card panel.

```typescript
type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

// Each panel has its own status
const [residentStatus, setResidentStatus] = useState<FetchStatus>('idle');
const [balanceStatus, setBalanceStatus]   = useState<FetchStatus>('idle');
const [cardsStatus, setCardsStatus]       = useState<FetchStatus>('idle');
const [txStatus, setTxStatus]             = useState<FetchStatus>('idle');
```

### Status rendering rules per panel:

| Status | Render |
|--------|--------|
| `idle` | Nothing (pre-mount) |
| `loading` | Simple spinner / "Loading..." text scoped to that panel |
| `success` | Entity data |
| `error` | Inline error message with retry button, scoped to that panel |

---

## 8. Missing Data Handling

### 8.1 Resident Missing

- **Full absence (null / 404):** Render a page-level "Resident not found" state. Do not render other panels — they are contextually meaningless without a resident anchor.
- **Partial data (fields missing):** Render the panel with `—` placeholders for missing fields. Never hide fields silently — absence of data is information.

### 8.2 Balance Missing

- `null` balance: Display "Unavailable" — not "0". This distinction matters for eligibility logic — a null balance must not be treated as zero when computing `eligible` flags.
- `0` balance: Render normally. All gift cards will appear ineligible (grayed out, redeem button disabled).

### 8.3 Gift Cards Missing

- Empty array `[]`: Render empty state panel — "No gift cards available."
- Fetch error: Render inline error within the panel only. Retry button scoped to this panel.
- Individual card with missing fields: Render the card, mask missing fields with `—`. Do not drop the card from the list.

### 8.4 Transactions Missing

- Empty array `[]`: "No transactions yet."
- Fetch error: Inline error + retry within the transaction panel only. Does not affect other panels.
- Individual transaction with missing fields: Render the row with `—` for the missing field. Do not drop the row — partial records are still valid history entries.

---

## 9. Gift Card Panel — Disabled States

A gift card can be non-interactive for two distinct reasons. Both must be handled separately:

| Reason | Behavior |
|--------|----------|
| `pointsCost > balance.points` | Card grayed out, redeem button disabled |
| Redemption POST in-flight | Entire panel disabled, all cards non-interactive |

These are different states and must not be conflated. During an in-flight request, the panel-level disabled state prevents double-submission or selecting a different card mid-request.

---

## 10. Component Tree

```
App
└── AuthProvider (AuthContext)
    ├── /login → LoginPage
    └── ProtectedRoute
        └── /dashboard → Dashboard
            ├── ResidentPanel
            │   └── renders: name, email
            │   └── missing fields: "—" placeholder
            │   └── 404 / null: page-level "Resident not found" — no other panels render
            │
            ├── PointsPanel
            │   └── renders: balance.points
            │   └── null balance: "Unavailable"
            │   └── 0 balance: renders normally, all cards ineligible
            │
            ├── GiftCardPanel
            │   └── renders: GiftCardResponse[] from GET /gift-cards/eligible/:id
            │   └── ineligible cards (eligible: false): grayed out, button disabled
            │   └── POST in-flight: entire panel disabled
            │   └── on redeem 200: re-fetch balance + cards + transactions
            │   └── on redeem 400: inline error on the clicked card, no re-fetch
            │   └── on re-fetch failure: stale data + warning banner
            │
            └── TransactionPanel
                └── renders: Transaction[], sorted newest-first by createdAt
                └── empty array: "No transactions yet"
                └── partial rows: missing fields shown as "—"
```

---

## 11. Security Boundary Summary

```
UI Layer     → gates for user experience (disabled buttons, grayed cards)
Server Layer → gates for data integrity  (re-validates before mutating)

UI alone   = good UX, bad security (can be bypassed with curl/Postman)
Server alone = safe data, poor UX
Both together = correct architecture
```

The UI never trusts itself as the last line of defense. Any POST mutation is validated server-side regardless of what the UI shows. The `GET /gift-cards/eligible/:id` endpoint provides the eligibility-flagged catalog for UX purposes only — the `POST /residents/:id/redeem` handler re-checks `balance >= pointsCost` independently before mutating anything.

---

## 12. Pseudo-Transactional Write Safety

The redemption POST handler performs two sequential mutations:

1. Debit `balance.points` in `balances.json`
2. Append new transaction record to `transactions.json`

There is no rollback mechanism. If mutation 1 succeeds and mutation 2 fails, the balance is deducted but no transaction record exists — the data is inconsistent.

**Known tradeoff:** This is an inherent limitation of flat JSON files as a data store. In a production system, both mutations would be wrapped in a single database transaction with rollback on failure. This limitation is documented and acknowledged as a scope-appropriate tradeoff for this implementation.

---

*Document reflects locked architecture. Update if API routes, entity schemas, or auth mechanism change.*
