import { Balance, FetchStatus } from '../types';

interface Props {
  balance: Balance | null;
  status: FetchStatus;
  onRetry: () => void;
}

export default function PointsPanel({ balance, status, onRetry }: Props) {
  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Points Balance</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Points Balance</h2>
        <p style={{ color: 'red' }}>Failed to load balance.</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  }

  const pointsDisplay = balance?.points === null ? 'Unavailable' : balance?.points ?? 'Unavailable';

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
      <h2>Points Balance</h2>
      <p style={{ fontSize: 32, fontWeight: 'bold', margin: '10px 0' }}>
        {pointsDisplay}
      </p>
      {typeof pointsDisplay === 'number' && <p>points available</p>}
    </div>
  );
}
