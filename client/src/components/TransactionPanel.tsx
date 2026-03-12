import { Transaction, FetchStatus } from '../types';

interface Props {
  transactions: Transaction[];
  status: FetchStatus;
  onRetry: () => void;
}

export default function TransactionPanel({ transactions, status, onRetry }: Props) {
  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Transaction History</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Transaction History</h2>
        <p style={{ color: 'red' }}>Failed to load transactions.</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Transaction History</h2>
        <p>No transactions yet</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
      <h2>Transaction History</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Description</th>
            <th style={{ textAlign: 'left', padding: 8 }}>Code</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Points</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr key={txn.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>
                {txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : '—'}
              </td>
              <td style={{ padding: 8 }}>{txn.type || '—'}</td>
              <td style={{ padding: 8 }}>{txn.description || '—'}</td>
              <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>
                {txn.redemptionCode || '—'}
              </td>
              <td style={{ padding: 8, textAlign: 'right', color: txn.points > 0 ? 'green' : 'red' }}>
                {txn.points !== undefined ? (txn.points > 0 ? `+${txn.points}` : txn.points) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
