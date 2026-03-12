import { useState } from 'react';
import { GiftCardResponse, FetchStatus } from '../types';

interface Props {
  giftCards: GiftCardResponse[];
  status: FetchStatus;
  onRetry: () => void;
  onRedeem: (giftCardId: string) => Promise<void>;
  isRedeeming: boolean;
}

export default function GiftCardPanel({ giftCards, status, onRetry, onRedeem, isRedeeming }: Props) {
  const [redeemingCardId, setRedeemingCardId] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ cardId: string; message: string } | null>(null);

  const handleRedeem = async (cardId: string) => {
    setRedeemingCardId(cardId);
    setCardError(null);

    try {
      await onRedeem(cardId);
    } catch (err) {
      setCardError({
        cardId,
        message: err instanceof Error ? err.message : 'Redemption failed',
      });
    } finally {
      setRedeemingCardId(null);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Gift Cards</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Gift Cards</h2>
        <p style={{ color: 'red' }}>Failed to load gift cards.</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (giftCards.length === 0) {
    return (
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2>Gift Cards</h2>
        <p>No gift cards available</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4, opacity: isRedeeming ? 0.7 : 1 }}>
      <h2>Gift Cards</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
        {giftCards.map((card) => {
          const isThisCardRedeeming = redeemingCardId === card.id;
          const thisCardError = cardError?.cardId === card.id ? cardError.message : null;

          return (
            <div
              key={card.id}
              style={{
                padding: 16,
                border: '1px solid #ddd',
                borderRadius: 4,
                opacity: card.eligible ? 1 : 0.5,
                backgroundColor: card.eligible ? 'white' : '#f5f5f5',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0' }}>{card.brand}</h3>
              <p style={{ margin: '0 0 4px 0' }}>{card.name}</p>
              <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: 14 }}>{card.category}</p>
              <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>{card.pointsCost} points</p>

              {thisCardError && (
                <p style={{ color: 'red', fontSize: 14, margin: '0 0 8px 0' }}>{thisCardError}</p>
              )}

              <button
                onClick={() => handleRedeem(card.id)}
                disabled={!card.eligible || isRedeeming || isThisCardRedeeming}
                style={{
                  width: '100%',
                  padding: 8,
                  cursor: card.eligible && !isRedeeming ? 'pointer' : 'not-allowed',
                }}
              >
                {isThisCardRedeeming ? 'Redeeming...' : card.eligible ? 'Redeem' : 'Not Eligible'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
