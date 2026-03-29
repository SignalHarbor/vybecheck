import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import type { LedgerEntry } from '../../shared/types';

// Transaction reason display names
const REASON_LABELS: Record<string, string> = {
  INITIAL_VYBES: 'Welcome Bonus',
  PURCHASE_VYBES: 'Purchased',
  UNLOCK_MATCH_TOP3: 'Unlocked Top 3 Matches',
  UNLOCK_MATCH_ALL: 'Unlocked All Matches',
  UNLOCK_QUESTION_LIMIT: 'Upgraded Question Limit',
};

// Pack IDs must match server-side StripeService VYBE_PACKS
const VYBE_PACKS = [
  { id: 'starter', name: 'Starter Pack', vybes: 20, price: 5, popular: false },
  { id: 'pro', name: 'Pro Pack', vybes: 50, price: 10, popular: true },
  { id: 'ultimate', name: 'Ultimate Pack', vybes: 120, price: 20, popular: false },
];

export function VybesPage() {
  const { twitterUsername, vybesBalance, transactionHistory, setVybesBalance, setTransactionHistory } = useAuthStore();
  const [showHistory, setShowHistory] = useState(false);
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Use twitterUsername as account ID (Vybes are account-based, not session-based)
  const accountId = twitterUsername || '';

  // Fetch balance via REST API
  const fetchBalance = useCallback(async () => {
    if (!accountId) return;
    
    setIsLoadingBalance(true);
    try {
      const response = await fetch(`/api/vybes/balance?participantId=${encodeURIComponent(accountId)}`);
      if (response.ok) {
        const data = await response.json();
        setVybesBalance(data.balance);
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [accountId, setVybesBalance]);

  // Fetch transaction history via REST API
  const fetchHistory = useCallback(async () => {
    if (!accountId) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/vybes/history?participantId=${encodeURIComponent(accountId)}`);
      if (response.ok) {
        const data = await response.json();
        setTransactionHistory(data.transactions);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [accountId, setTransactionHistory]);

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Fetch history when toggled
  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory, fetchHistory]);

  const handlePurchase = async (packId: string) => {
    if (!accountId) {
      setPurchaseError('Please sign in to purchase Vybes');
      return;
    }

    setPurchasingPackId(packId);
    setPurchaseError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, participantId: accountId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Purchase error:', err);
      setPurchaseError(err.message || 'Failed to start checkout');
      setPurchasingPackId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full min-h-full">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-vybe-blue to-vybe-purple p-6 rounded-[20px] mb-5 shadow-primary text-white">
        <div className="text-sm opacity-90 mb-1">Your Balance</div>
        <div className="text-4xl font-bold flex items-center gap-2">
          <span>✨</span>
          <span>{isLoadingBalance ? '...' : vybesBalance}</span>
          <span className="text-xl opacity-80">Vybes</span>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="mt-3 bg-white/20 border-none py-2 px-4 rounded-lg text-white text-[13px] cursor-pointer hover:bg-white/30 transition-colors"
        >
          {showHistory ? 'Hide History' : 'View History'}
        </button>
      </div>

      {/* Transaction History */}
      {showHistory && (
        <div className="bg-white p-4 rounded-2xl mb-5 shadow-card-sm">
          <h3 className="m-0 mb-3 text-base font-bold text-gray-800">
            Transaction History
          </h3>
          {isLoadingHistory ? (
            <p className="text-gray-500 text-sm m-0">Loading...</p>
          ) : transactionHistory.length === 0 ? (
            <p className="text-gray-500 text-sm m-0">No transactions yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {transactionHistory.map((txn: LedgerEntry) => (
                <div
                  key={txn.id}
                  className="flex justify-between items-center py-2.5 border-b border-gray-100"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      {REASON_LABELS[txn.reason] || txn.reason}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(txn.createdAt)}
                    </div>
                  </div>
                  <div className={`text-base font-bold ${
                    txn.amount > 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {txn.amount > 0 ? '+' : ''}{txn.amount} ✨
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Purchase Error */}
      {purchaseError && (
        <div className="bg-red-100 border border-red-300 rounded-xl py-3 px-4 mb-4 text-red-800 text-sm">
          {purchaseError}
        </div>
      )}

      {/* Vybe Packs */}
      <h2 className="m-0 mb-4 text-xl font-bold text-gray-800">Buy Vybe Packs</h2>
      <div className="flex flex-col gap-3 mb-8">
        {VYBE_PACKS.map(pack => {
          const isPurchasing = purchasingPackId === pack.id;
          return (
            <div
              key={pack.id}
              className={`bg-white p-5 rounded-2xl shadow-card-sm relative transition-opacity ${
                pack.popular ? 'border-2 border-vybe-blue' : ''
              } ${isPurchasing ? 'opacity-70' : 'opacity-100'}`}
            >
              {pack.popular && (
                <div className="absolute -top-2.5 right-5 bg-gradient-to-br from-vybe-blue to-vybe-purple text-white py-1 px-3 rounded-xl text-[11px] font-bold">
                  POPULAR
                </div>
              )}
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-bold text-gray-800 mb-1">
                    {pack.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    ✨ {pack.vybes} Vybes
                  </div>
                </div>
                <button
                  className="py-3 px-6 text-[15px] border-none rounded-xl cursor-pointer font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-gradient-to-br from-vybe-blue to-vybe-purple text-white shadow-primary active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handlePurchase(pack.id)}
                  disabled={isPurchasing || purchasingPackId !== null}
                >
                  {isPurchasing ? 'Loading...' : `$${pack.price}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pricing Info */}
      <div className="bg-gray-50 p-5 rounded-2xl mb-5">
        <h3 className="m-0 mb-3 text-base font-bold text-gray-800">
          Unlock Pricing
        </h3>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Preview Matches</span>
            <span className="text-emerald-500 font-semibold">Free</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Top 3 Matches</span>
            <span className="font-semibold">2 ✨</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>All Matches</span>
            <span className="font-semibold">5 ✨</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Extended Questions (10)</span>
            <span className="font-semibold">3 ✨</span>
          </div>
        </div>
      </div>

      {/* What are Vybes? */}
      <div className="bg-gray-50 p-5 rounded-2xl">
        <h3 className="m-0 mb-3 text-base font-bold text-gray-800">
          What are Vybes?
        </h3>
        <p className="m-0 text-sm text-gray-500 leading-relaxed">
          Vybes are used to unlock premium features like viewing detailed match results,
          accessing exclusive visualizations, and more. New participants receive 10 free Vybes!
        </p>
      </div>

      {/* FOR DEVELOPMENT ONLY — comment out in prod */}
      <div className="mt-8 pt-4 border-t border-dashed border-gray-300">
        <button
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="w-full py-2 px-4 bg-red-100 text-red-600 border border-red-300 rounded-lg text-xs font-mono cursor-pointer"
        >
          🧹 DEV: Clear localStorage & Reload
        </button>
      </div>
      {/* END DEV ONLY */}
    </div>
  );
}
