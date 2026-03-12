import { Resident, FetchStatus } from '../types';

interface Props {
  resident: Resident | null;
  status: FetchStatus;
  onRetry: () => void;
}

export default function ResidentPanel({ resident, status, onRetry }: Props) {
  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Resident Info</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Resident Info</h2>
        <p style={{ color: 'red' }}>Failed to load resident information.</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (!resident) {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Resident Info</h2>
        <p>No resident data available.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
      <h2>Resident Info</h2>
      <p><strong>Name:</strong> {resident.name}</p>
      <p><strong>Email:</strong> {resident.email}</p>
      <p><strong>ID:</strong> {resident.id}</p>
    </div>
  );
}
