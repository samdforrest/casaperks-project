import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Resident,
  Balance,
  Transaction,
  GiftCardResponse,
  RedeemResponse,
} from '../types';

const BASE_URL = 'http://localhost:3001';

interface LoginResponse {
  token: string;
  residentId: string;
}

export function useApi() {
  const { token, logout } = useAuth();

  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        logout();
        throw new Error('Unauthorized');
      }

      return response;
    },
    [token, logout]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResponse> => {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },
    []
  );

  const getResident = useCallback(
    async (residentId: string): Promise<Resident> => {
      const response = await fetchWithAuth(`/residents/${residentId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch resident');
      }

      return response.json();
    },
    [fetchWithAuth]
  );

  const getBalance = useCallback(
    async (residentId: string): Promise<Balance> => {
      const response = await fetchWithAuth(`/balances/${residentId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch balance');
      }

      return response.json();
    },
    [fetchWithAuth]
  );

  const getTransactions = useCallback(
    async (residentId: string): Promise<Transaction[]> => {
      const response = await fetchWithAuth(`/transactions/${residentId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch transactions');
      }

      return response.json();
    },
    [fetchWithAuth]
  );

  const getGiftCards = useCallback(
    async (residentId: string): Promise<GiftCardResponse[]> => {
      const response = await fetchWithAuth(`/gift-cards/eligible/${residentId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch gift cards');
      }

      return response.json();
    },
    [fetchWithAuth]
  );

  const redeemGiftCard = useCallback(
    async (giftCardId: string): Promise<RedeemResponse> => {
      const response = await fetchWithAuth('/redeem', {
        method: 'POST',
        body: JSON.stringify({ giftCardId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Redemption failed');
      }

      return response.json();
    },
    [fetchWithAuth]
  );

  return {
    login,
    getResident,
    getBalance,
    getTransactions,
    getGiftCards,
    redeemGiftCard,
  };
}
