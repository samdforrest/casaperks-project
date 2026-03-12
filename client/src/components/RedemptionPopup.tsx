interface Props {
  code: string;
  giftCardName: string;
  onClose: () => void;
}

export default function RedemptionPopup({ code, giftCardName, onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 32,
          borderRadius: 8,
          maxWidth: 400,
          width: '90%',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>Redemption Successful</h2>
        <p style={{ margin: '0 0 24px 0', color: '#666' }}>{giftCardName}</p>

        <div
          style={{
            backgroundColor: '#f5f5f5',
            padding: 16,
            borderRadius: 4,
            marginBottom: 24,
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontSize: 14, color: '#666' }}>Your redemption code:</p>
          <p
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 'bold',
              fontFamily: 'monospace',
              letterSpacing: 2,
            }}
          >
            {code}
          </p>
        </div>

        <p style={{ margin: '0 0 24px 0', fontSize: 14, color: '#666' }}>
          This code has been saved to your transaction history.
        </p>

        <button
          onClick={onClose}
          style={{
            padding: '12px 32px',
            fontSize: 16,
            cursor: 'pointer',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: 4,
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
