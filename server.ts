import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;
const JWT_SECRET = 'casaperks-secret-dev';

app.use(cors());
app.use(express.json());

// ── REQUEST LOGGING ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ── DATA LOADING ──────────────────────────────────────────────────────────────
// Load JSON files into memory at startup. Mutations update these arrays directly.
// No file re-reads after startup — all state lives in memory.

interface Resident {
  id: string;
  name: string;
  email: string;
}

interface Balance {
  residentId: string;
  points: number;
}

interface Transaction {
  id: string;
  residentId: string;
  type: 'earn' | 'redeem';
  points: number;
  description: string;
  createdAt: string;
  redemptionCode?: string;
}

function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface GiftCard {
  id: string;
  name: string;
  brand: string;
  pointsCost: number;
  category: string;
  quantity: number;
}

const dataDir = path.join(process.cwd(), 'data');
const residents: Resident[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'residents.json'), 'utf-8'));
const balances: Balance[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'balances.json'), 'utf-8'));
const transactions: Transaction[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'transactions.json'), 'utf-8'));
const giftcards: GiftCard[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'giftcards.json'), 'utf-8'));

// ── JWT MIDDLEWARE ────────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  residentId?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { residentId: string };
    req.residentId = payload.residentId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── RATE LIMITER ──────────────────────────────────────────────────────────────

const redeemLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many redemption attempts. Please wait.' }
});

// ── ROUTES ────────────────────────────────────────────────────────────────────

// POST /auth/login
app.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const resident = residents.find(r => r.email === email);
  if (!resident || password !== 'password123') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ residentId: resident.id }, JWT_SECRET);
  return res.json({ token, residentId: resident.id });
});

// GET /residents/:id
app.get('/residents/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const resident = residents.find(r => r.id === req.params.id);
  if (!resident) {
    return res.status(404).json({ error: 'Resident not found' });
  }
  return res.json(resident);
});

// GET /balances/:id
app.get('/balances/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const balance = balances.find(b => b.residentId === req.params.id);
  if (!balance) {
    return res.status(404).json({ error: 'Balance not found' });
  }
  return res.json(balance);
});

// GET /transactions/:id
app.get('/transactions/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const result = transactions
    .filter(t => t.residentId === req.params.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(result);
});

// GET /gift-cards/eligible/:id
app.get('/gift-cards/eligible/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const balance = balances.find(b => b.residentId === req.params.id);
  if (!balance) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  const result = giftcards.map(card => ({
    id: card.id,
    name: card.name,
    brand: card.brand,
    pointsCost: card.pointsCost,
    category: card.category,
    eligible: card.pointsCost <= balance.points && card.quantity > 0,
    ineligibleReason: card.quantity <= 0
      ? 'out_of_stock'
      : card.pointsCost > balance.points
        ? 'insufficient_points'
        : null
  }));
  return res.json(result);
});

// POST /redeem
const redeemSchema = z.object({
  giftCardId: z.string()
});

app.post('/redeem', authMiddleware, redeemLimiter, (req: AuthRequest, res: Response) => {
  // 1. Validate body
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { giftCardId } = parsed.data;
  const residentId = req.residentId!;

  // 2. Look up gift card
  const card = giftcards.find(g => g.id === giftCardId);
  if (!card) {
    return res.status(404).json({ error: 'Gift card not found' });
  }

  // 3. Look up balance
  const balanceEntry = balances.find(b => b.residentId === residentId);
  if (!balanceEntry) {
    return res.status(404).json({ error: 'Balance not found' });
  }

  // 4. Server-side eligibility check
  if (balanceEntry.points < card.pointsCost) {
    return res.status(400).json({ error: 'Insufficient points' });
  }
  if (card.quantity <= 0) {
    return res.status(400).json({ error: 'Gift card out of stock' });
  }

  // 5. Mutation 1: deduct balance
  balanceEntry.points -= card.pointsCost;

  // 6. Mutation 2: decrement gift card quantity
  card.quantity -= 1;

  // 7. Mutation 3: append transaction
  const redemptionCode = generateRedemptionCode();
  const newTransaction: Transaction = {
    id: `txn_${Date.now()}`,
    residentId,
    type: 'redeem',
    points: -card.pointsCost,
    description: `Redeemed: ${card.brand} ${card.name}`,
    createdAt: new Date().toISOString(),
    redemptionCode
  };
  transactions.push(newTransaction);

  // 8. Respond
  return res.json({ newBalance: balanceEntry.points, transaction: newTransaction });
});

// ── START SERVER ──────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
