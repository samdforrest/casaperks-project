# CasaPerks Development Session Reflection

**Date:** March 11, 2026
**Project:** CasaPerks Rewards Dashboard
**Stack:** Express + TypeScript (backend), React + TypeScript + Vite (frontend)

---

## Session Overview

Built a functional points-based rewards dashboard from stub files, implementing both backend API and frontend React components following a detailed specification in `CLAUDE.md`.

---

## What We Built

### Backend (`server.ts`)
- Express server on port 3001
- JWT authentication with middleware
- Zod request validation
- Rate limiting on redemption endpoint (5/min)
- In-memory data store (loaded from JSON files at startup)
- Request logging middleware

### Frontend (`client/src/`)
| File | Purpose |
|------|---------|
| `context/AuthContext.tsx` | JWT token + residentId state, login/logout functions |
| `api/client.ts` | `useApi()` hook with all API functions, 401 interception |
| `App.tsx` | Conditional rendering: LoginPage vs Dashboard |
| `components/LoginPage.tsx` | Email/password form |
| `components/Dashboard.tsx` | Container, fetches all data, handles redemption flow |
| `components/ResidentPanel.tsx` | Displays resident info |
| `components/PointsPanel.tsx` | Displays points balance |
| `components/GiftCardPanel.tsx` | Gift card grid with redeem buttons |
| `components/TransactionPanel.tsx` | Transaction history table |

---

## Issues Encountered & Solutions

### 1. File Reverted Mysteriously
**Problem:** `server.ts` implementation disappeared, reverted to TODO stub.
**Cause:** Unknown (not OneDrive as initially suspected - project was in `C:\Users\Sam`, not OneDrive folder).
**Solution:** Recovered from git with `git checkout server.ts`. The implementation was committed.
**Lesson:** Commit frequently. Git saved us here.

### 2. npm Not Working in Git Bash
**Problem:** `npm install` produced no output and didn't install packages.
**Cause:** On Windows/MINGW, the `npm` shell script doesn't work properly.
**Solution:** Use `npm.cmd` instead of `npm`.
```bash
# Instead of:
npm install

# Use:
npm.cmd install
# Or:
"/c/Program Files/nodejs/npm.cmd" install
```

### 3. TypeScript Error: Missing React Types
**Problem:** `Could not find declaration file for module 'react/jsx-runtime'`
**Cause:** Client folder has its own `package.json` - dependencies weren't installed.
**Solution:** Run `npm.cmd install` in the `client/` directory separately.

### 4. Infinite Re-render Loop
**Problem:** Dashboard components showed data briefly, then stuck on "Loading..." forever.
**Cause:** Unstable references in React hooks:
- `useAuth()` returned new `login`/`logout` functions every render
- `useApi()` returned new object every render
- This triggered `useCallback` dependencies, which triggered `useEffect`, causing infinite loop

**Solution:** Wrap functions in `useCallback` and return objects in `useMemo`:
```typescript
// AuthContext.tsx
const login = useCallback((token, id) => { ... }, []);
const logout = useCallback(() => { ... }, []);
const value = useMemo(() => ({ token, residentId, login, logout }), [...]);

// client.ts
return useMemo(() => ({ login, getResident, ... }), [login, getResident, ...]);
```

### 5. No Network Requests Visible in Browser
**Problem:** Couldn't see API requests in browser Network tab.
**Cause:** Likely filtering or not preserving logs.
**Solution:** Added server-side request logging:
```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

---

## Key Architectural Decisions (from CLAUDE.md)

| Decision | Rationale |
|----------|-----------|
| Single-file backend | Simplicity for small project |
| In-memory data (no disk writes) | Zero infrastructure, acceptable for dev |
| JWT in memory only (not localStorage) | Security - cleared on tab close |
| Server computes `eligible` flag | Server is source of truth, UI just displays |
| `Promise.allSettled` for re-fetches | One failure doesn't block others |
| Panels have independent loading states | Better UX, isolated failures |

---

## Data Flow

### On Login
```
POST /auth/login → { token, residentId }
↓
AuthContext stores token + residentId
↓
App renders Dashboard instead of LoginPage
↓
Dashboard fires 4 parallel GETs:
  GET /residents/:id
  GET /balances/:id
  GET /transactions/:id
  GET /gift-cards/eligible/:id
```

### On Redemption
```
POST /redeem { giftCardId }
↓
Server: validate → deduct balance → decrement quantity → create transaction
↓
Response: { newBalance, transaction }
↓
Dashboard re-fetches (Promise.allSettled):
  GET /balances/:id
  GET /gift-cards/eligible/:id
  GET /transactions/:id
  (NOT /residents - unchanged)
↓
If any re-fetch fails: show "Balance may be outdated" warning
```

---

## Commands Reference

```bash
# Start both servers (from project root)
npm.cmd run dev

# Install root dependencies
npm.cmd install

# Install client dependencies
cd client && npm.cmd install

# Test login endpoint
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sam.rivera@casaperks.com","password":"password123"}'

# Test authenticated endpoint (replace TOKEN)
curl http://localhost:3001/residents/resident_001 \
  -H "Authorization: Bearer TOKEN"
```

---

## Test Credentials

```
Email:    sam.rivera@casaperks.com
Password: password123
```

---

## React StrictMode Note

In development, you'll see duplicate requests on mount (e.g., 2x GET /residents). This is intentional - React StrictMode double-fires effects to help catch bugs. It won't happen in production.

---

## Files Modified This Session

```
server.ts                           - Full Express backend implementation
client/src/context/AuthContext.tsx  - Auth state + hooks
client/src/api/client.ts            - API client with useApi() hook
client/src/main.tsx                 - Entry point with AuthProvider
client/src/App.tsx                  - Routing based on auth state
client/src/components/LoginPage.tsx
client/src/components/Dashboard.tsx
client/src/components/ResidentPanel.tsx
client/src/components/PointsPanel.tsx
client/src/components/GiftCardPanel.tsx
client/src/components/TransactionPanel.tsx
```

---

## Next Steps (Not Done Yet)

- [ ] Add styling (currently inline styles only)
- [ ] Error boundary for uncaught errors
- [ ] Loading skeletons instead of "Loading..." text
- [ ] Persist data to JSON files (or migrate to real DB)
- [ ] Add more residents/gift cards to test data
- [ ] Unit tests

---

## AI Collaboration Notes

**What worked well:**
- Having a detailed spec (`CLAUDE.md`) made implementation straightforward
- Iterative debugging: run → observe → fix → repeat
- AI could trace through React re-render issues by understanding hook dependencies

**What needed human input:**
- Identifying that `npm.cmd` was needed (Windows/MINGW quirk)
- Observing runtime behavior ("it flashes then goes back to loading")
- Confirming the fix worked after changes

**Collaboration pattern:**
1. Human describes problem or goal
2. AI reads relevant files, proposes solution
3. AI implements changes
4. Human tests, reports results
5. Iterate until working
