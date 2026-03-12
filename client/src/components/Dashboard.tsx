import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../api/client';
import { Resident, Balance, Transaction, GiftCardResponse, FetchStatus } from '../types';
import ResidentPanel from './ResidentPanel';
import PointsPanel from './PointsPanel';
import GiftCardPanel from './GiftCardPanel';
import TransactionPanel from './TransactionPanel';

export default function Dashboard() {
  const { residentId, logout } = useAuth();
  const api = useApi();

  const [resident, setResident] = useState<Resident | null>(null);
  const [residentStatus, setResidentStatus] = useState<FetchStatus>('idle');

  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceStatus, setBalanceStatus] = useState<FetchStatus>('idle');

  const [giftCards, setGiftCards] = useState<GiftCardResponse[]>([]);
  const [giftCardsStatus, setGiftCardsStatus] = useState<FetchStatus>('idle');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsStatus, setTransactionsStatus] = useState<FetchStatus>('idle');

  const [staleWarning, setStaleWarning] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const fetchResident = useCallback(async () => {
    if (!residentId) return;
    setResidentStatus('loading');
    try {
      const data = await api.getResident(residentId);
      setResident(data);
      setResidentStatus('success');
    } catch {
      setResidentStatus('error');
    }
  }, [residentId, api]);

  const fetchBalance = useCallback(async () => {
    if (!residentId) return;
    setBalanceStatus('loading');
    try {
      const data = await api.getBalance(residentId);
      setBalance(data);
      setBalanceStatus('success');
    } catch {
      setBalanceStatus('error');
    }
  }, [residentId, api]);

  const fetchGiftCards = useCallback(async () => {
    if (!residentId) return;
    setGiftCardsStatus('loading');
    try {
      const data = await api.getGiftCards(residentId);
      setGiftCards(data);
      setGiftCardsStatus('success');
    } catch {
      setGiftCardsStatus('error');
    }
  }, [residentId, api]);

  const fetchTransactions = useCallback(async () => {
    if (!residentId) return;
    setTransactionsStatus('loading');
    try {
      const data = await api.getTransactions(residentId);
      setTransactions(data);
      setTransactionsStatus('success');
    } catch {
      setTransactionsStatus('error');
    }
  }, [residentId, api]);

  useEffect(() => {
    fetchResident();
    fetchBalance();
    fetchGiftCards();
    fetchTransactions();
  }, [fetchResident, fetchBalance, fetchGiftCards, fetchTransactions]);

  const handleRedeem = async (giftCardId: string): Promise<void> => {
    setIsRedeeming(true);
    setStaleWarning(false);

    try {
      await api.redeemGiftCard(giftCardId);

      const results = await Promise.allSettled([
        fetchBalance(),
        fetchGiftCards(),
        fetchTransactions(),
      ]);

      const anyFailed = results.some((r) => r.status === 'rejected');
      if (anyFailed) {
        setStaleWarning(true);
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  if (residentStatus === 'error') {
    return (
      <div style={{ padding: 20 }}>
        <h1>Error</h1>
        <p>Unable to load resident information.</p>
        <button onClick={fetchResident}>Retry</button>
        <button onClick={logout} style={{ marginLeft: 10 }}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>CasaPerks Dashboard</h1>
        <button onClick={logout}>Logout</button>
      </div>

      {staleWarning && (
        <div style={{ padding: 10, backgroundColor: '#fff3cd', border: '1px solid #ffc107', marginBottom: 20 }}>
          Balance may be outdated. Refresh to update.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ResidentPanel
          resident={resident}
          status={residentStatus}
          onRetry={fetchResident}
        />
        <PointsPanel
          balance={balance}
          status={balanceStatus}
          onRetry={fetchBalance}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <GiftCardPanel
          giftCards={giftCards}
          status={giftCardsStatus}
          onRetry={fetchGiftCards}
          onRedeem={handleRedeem}
          isRedeeming={isRedeeming}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <TransactionPanel
          transactions={transactions}
          status={transactionsStatus}
          onRetry={fetchTransactions}
        />
      </div>
    </div>
  );
}
