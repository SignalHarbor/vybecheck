import { analytics } from '../utils/analytics';

export function PurchaseCancel() {
  const handleGoBack = () => {
    analytics.capture('purchase_cancelled');
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🛒</div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700', color: '#1F2937' }}>
          Purchase Cancelled
        </h1>
        <p style={{ color: '#6B7280', fontSize: '16px', marginBottom: '24px' }}>
          No worries! Your purchase was cancelled and you haven't been charged.
          You can try again whenever you're ready.
        </p>

        <button
          onClick={handleGoBack}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Back to App
        </button>
      </div>
    </div>
  );
}
