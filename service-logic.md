# Service Logic Documentation
## CasaPerks Rewards Dashboard — Express + TypeScript Backend

---

## 1. System Overview

This document describes the complete service logic for the CasaPerks Rewards Dashboard backend. The system serves a single resident's points balance, transaction history, and gift card catalog through six REST endpoints, backed by four in-memory JSON flat files.

**Stack:** Express + TypeScript, no database, in-memory JSON flat files as data store.

### Entity Relationships

| Entity | File | Description |
|--------|------|-------------|
| Resident | `residents.json` | Identity: id, name, email |
| Balance | `balances.json` | Points balance, separated from resident to isolate write-heavy operations |
| Transaction | `transactions.json` | Point movement history (earn/redeem), linked by residentId |
| GiftCard | `giftcards.json` | Catalog of redeemable gift cards. No resident FK — catalog is global, eligibility is computed at the API layer |

---

## 2. API Contract

| Method | Route | JWT | Rate Limit | Description |
|--------|-------|-----|------------|-------------|
| POST | `/auth/login` | No | No | Authenticate resident, return JWT |
| GET | `/residents/:id` | Yes | No | Fetch resident name and email |
| GET | `/balances/:id` | Yes | No | Fetch current points balance |
| GET | `/transactions/:id` | Yes | No | Fetch transaction history, newest first |
| GET | `/gift-cards/eligible/:id` | Yes | No | Full catalog with `eligible` flag per card |
| POST | `/residents/:id/redeem` | Yes | Yes (5/min) | Redeem points for a gift card |

---

## 3. Route-by-Route Service Logic

### 3.1 POST `/auth/login`

The only public endpoint. Validates credentials against the seeded resident record and issues a signed JWT on success.

**Request body:**
```json
{ "email": "sam.rivera@casaperks.com", "password": "password123" }
```

**Handler steps:**
1. Parse `email` and `password` from request body
2. Find resident in `residents.json` where email matches
3. Compare password against hardcoded value *(production would use bcrypt + DB)*
4. On match: sign JWT with payload `{ residentId }` using `jsonwebtoken`, return `{ token, residentId }`
5. On no match: return `401 Unauthorized`

**Success response:**
```json
{ "token": "<signed_jwt>", "residentId": "resident_001" }
```

---

### 3.2 GET `/residents/:id`

Returns the resident's display information. Balance is intentionally excluded — it lives on a separate endpoint to isolate write concerns.

**Handler steps:**
1. JWT middleware verifies `Authorization: Bearer <token>`
2. Find resident in `residents.json` where `id` matches URL param
3. If not found: return `404`
4. Return `{ id, name, email }`

**Success response:**
```json
{ "id": "resident_001", "name": "Sam Rivera", "email": "sam.rivera@casaperks.com" }
```

---

### 3.3 GET `/balances/:id`

Returns the resident's current points balance. Separated from the resident entity because balance is the only write-heavy field in the system — isolating it prevents partial write failures from corrupting resident profile data.

**Handler steps:**
1. JWT middleware verifies token
2. Find entry in `balances.json` where `residentId` matches URL param
3. If not found: return `404`
4. Return `{ residentId, points }`

**Success response:**
```json
{ "residentId": "resident_001", "points": 3450 }
```

---

### 3.4 GET `/transactions/:id`

Returns the full transaction history for a resident, sorted newest-first. An empty array is a valid response — a resident with no transactions is not an error.

**Handler steps:**
1. JWT middleware verifies token
2. Filter `transactions.json` where `residentId` matches URL param
3. Sort results descending by `createdAt`
4. Return array (empty array `[]` if no transactions found — not a 404)

**Success response:**
```json
[
  {
    "id": "txn_010",
    "residentId": "resident_001",
    "type": "earn",
    "points": 300,
    "description": "Community event participation",
    "createdAt": "2025-05-05T17:00:00Z"
  },
  ...
]
```

---

### 3.5 GET `/gift-cards/eligible/:id`

Returns the full gift card catalog with an `eligible` boolean flag computed per card. The decision to return the full catalog — rather than filtering ineligible cards out — is deliberate: the frontend renders ineligible cards as greyed-out, giving the resident visibility into what they can work toward. Filtering server-side would cause the catalog to visually shrink as points are spent, which is disorienting UX.

**Handler steps:**
1. JWT middleware verifies token
2. Look up balance from `balances.json` for the `residentId`
3. Read all cards from `giftcards.json`
4. Map over cards, appending: `eligible = (card.pointsCost <= balance.points)`
5. Return full array with `eligible` flag on each card

**Success response:**
```json
[
  { "id": "gc_001", "name": "$5 Gift Card", "brand": "Starbucks",
    "pointsCost": 500, "category": "Food & Drink", "eligible": true },
  { "id": "gc_008", "name": "$50 Gift Card", "brand": "Visa",
    "pointsCost": 5000, "category": "Universal", "eligible": false }
]
```

---

### 3.6 POST `/residents/:id/redeem`

The only write endpoint. Carries all three security layers: JWT authentication, Zod input validation, and rate limiting. Performs two sequential mutations with a documented tradeoff around atomicity.

**Request body:**
```json
{ "giftCardId": "gc_002" }
```

> `residentId` is sourced exclusively from the URL param — never the request body. The JWT is the identity anchor; the body carries only the resource being acted upon.

**Handler steps:**
1. JWT middleware verifies token
2. Rate limiter checks: max 5 requests/minute per IP — returns `429` if exceeded
3. Zod validates request body: `{ giftCardId: z.string() }` — rejects missing or malformed fields before touching data
4. Look up gift card in `giftcards.json` by `giftCardId` — if not found, return `404`
5. Look up balance in `balances.json` by `residentId` — if not found, return `404`
6. Server-side balance check: `balance.points >= giftCard.pointsCost` — if false, return `400` with `"Insufficient points"`
7. Mutation 1: deduct `pointsCost` from balance in `balances.json`
8. Mutation 2: append new transaction to `transactions.json`
9. Return `{ newBalance, transaction }`

**New transaction shape:**
```typescript
{
  id: `txn_${Date.now()}`,
  residentId,                              // from URL param
  type: 'redeem',
  points: -giftCard.pointsCost,            // negative value
  description: `Redeemed: ${giftCard.brand} ${giftCard.name}`,
  createdAt: new Date().toISOString()
}
```

**Success response:**
```json
{
  "newBalance": 2450,
  "transaction": {
    "id": "txn_1748822400000",
    "residentId": "resident_001",
    "type": "redeem",
    "points": -1000,
    "description": "Redeemed: Amazon $10 Gift Card",
    "createdAt": "2025-06-01T12:00:00Z"
  }
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| `400` | `balance.points < giftCard.pointsCost` |
| `404` | `giftCardId` not found in catalog |
| `404` | `residentId` not found in balances |
| `429` | Rate limit exceeded (5 req/min per IP) |

---

## 4. Security Architecture

Three security layers are applied, each targeting a different attack surface with a product-aware justification.

### 4.1 JWT Authentication

All routes except `POST /auth/login` are protected by JWT middleware that verifies the `Authorization: Bearer <token>` header. The token payload carries `residentId`, which is used as the identity anchor for all downstream data fetches.

*Production consideration: `exp` claim (token expiry) and refresh token rotation would be added for a real deployment.*

### 4.2 Zod Input Validation

`POST /residents/:id/redeem` validates its request body against a Zod schema before any business logic executes. Malformed, missing, or unexpected fields are rejected at the boundary — bad data never reaches the data layer.

```typescript
const redeemSchema = z.object({
  giftCardId: z.string()
});

// Rejects: {}, { giftCardId: 123 }, { giftCardId: null }, extra fields
```

*Justification: redemption is a write operation with financial consequences. Validating at the boundary is cheap and high-leverage.*

### 4.3 Rate Limiting on Redeem

`POST /residents/:id/redeem` is rate-limited to 5 requests per minute per IP using `express-rate-limit`. Requests exceeding the limit receive `429 Too Many Requests`.

*Justification: points fraud is a real attack vector in loyalty platforms. Rate limiting is a cheap first line of defense against automated abuse.*

### 4.4 Dual-Gate Redemption Pattern

The frontend disables the redeem button and greys out ineligible cards as a UX gate. The server independently re-checks `balance >= pointsCost` before executing any mutation. Both gates are required:

- **UI gate alone** = good UX, bad security (UI can be bypassed with a raw POST via curl or Postman)
- **Server gate alone** = safe data, poor UX (no feedback until the request fails)
- **Both together** = correct architecture

---

## 5. Data Schemas

All four flat files follow TypeScript-compatible shapes:

```typescript
// residents.json
type Resident = {
  id: string;       // e.g. 'resident_001'
  name: string;
  email: string;
};

// balances.json
type Balance = {
  residentId: string;   // FK → Resident.id
  points: number;       // mutated on every successful redeem
};

// transactions.json
type Transaction = {
  id: string;           // e.g. 'txn_001'
  residentId: string;   // FK → Resident.id
  type: 'earn' | 'redeem';
  points: number;       // positive for earn, negative for redeem
  description: string;
  createdAt: string;    // ISO 8601
};

// giftcards.json
type GiftCard = {
  id: string;         // e.g. 'gc_001'
  name: string;       // e.g. '$10 Gift Card'
  brand: string;      // e.g. 'Amazon'
  pointsCost: number;
  category: string;   // e.g. 'Shopping'
};

// eligible flag added at API response layer only — not stored in giftcards.json
type GiftCardResponse = GiftCard & { eligible: boolean };
```

---

## 6. Documented Tradeoffs

### 6.1 Flat JSON Files vs. Database

**Why flat files:** No database setup, runs with a single command, zero infrastructure overhead. Data relationships are simple enough that ID-based linking across four files is sufficient at this scale.

**Production equivalent:** PostgreSQL for ACID transactions, indexing, and query flexibility.

### 6.2 Balance Separated from Resident

**Tradeoff:** Adds one extra GET on mount — `/balances/:id` fires separately from `/residents/:id`.

**Benefit:** Balance is the only write-heavy field. Separating it means a partial write failure cannot corrupt the resident profile object. Isolation makes debugging clearer — exactly one file changes during a redemption.

### 6.3 No Atomic Transactions on Redeem

`POST /residents/:id/redeem` performs two sequential file writes with no rollback:

1. Deduct balance in `balances.json`
2. Append transaction in `transactions.json`

**Known risk:** If the process crashes between write 1 and write 2, the balance is deducted but no transaction record exists.

**Acceptable for this scope:** probability is low, data is mock, risk is documented.

**Production remedy:** A database transaction wrapping both mutations atomically with `BEGIN / COMMIT / ROLLBACK`.

### 6.4 Full Catalog with Eligible Flag vs. Filtered Catalog

Rather than filtering ineligible cards server-side, `GET /gift-cards/eligible/:id` returns all cards with an `eligible: boolean` computed per card.

**Benefit:** Frontend can show the full catalog with greyed-out cards, letting residents see what they can work toward.

**Alternative rejected:** Filtering server-side would cause the catalog to visually shrink as points are spent — disorienting UX and hiding available options from the user.

**Security:** The server still re-checks `balance >= pointsCost` inside the redeem handler regardless of what the client reports.

---

*Document reflects locked architecture. Update if routes, schemas, or security layers change.*
