export interface Resident {
  id: string;
  name: string;
  email: string;
}

export interface Balance {
  residentId: string;
  points: number | null;
}

export interface Transaction {
  id: string;
  residentId: string;
  type: 'earn' | 'redeem';
  points: number;
  description: string;
  createdAt: string;
  redemptionCode?: string;  // only present for 'redeem' type
}

export interface GiftCardResponse {
  id: string;
  name: string;
  brand: string;
  pointsCost: number;
  category: string;
  eligible: boolean;
  ineligibleReason: 'out_of_stock' | 'insufficient_points' | null;
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
