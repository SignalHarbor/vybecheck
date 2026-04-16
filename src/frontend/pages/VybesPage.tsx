import { useState, useEffect, useCallback } from 'react';
import { Sparkles, History, Lock, ChevronRight, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Header } from '../components/Header';
import { useFeatures } from '../utils/features';
import type { LedgerEntry } from '../../shared/types';

const REASON_LABELS: Record<string, string> = {
  INITIAL_VYBES: 'Welcome Bonus',
  PURCHASE_VYBES: 'Purchased',
  UNLOCK_MATCH_TOP3: 'Unlocked Top 3 Matches',
  UNLOCK_MATCH_ALL: 'Unlocked All Matches',
  UNLOCK_QUESTION_LIMIT: 'Upgraded Question Limit',
};

const VYBE_PACKS = [
  { id: 'starter', name: 'Starter Pack', vybes: 20, price: 5, popular: false },
  { id: 'pro', name: 'Pro Pack', vybes: 50, price: 10, popular: true },
  { id: 'ultimate', name: 'Ultimate Pack', vybes: 120, price: 20, popular: false },
];

const UNLOCK_PRICING = [
  { label: 'Preview Matches', cost: null, free: true },
  { label: 'Top 3 Matches', cost: 2, free: false },
  { label: 'All Matches', cost: 5, free: false },
  { label: 'Extended Questions (10)', cost: 3, free: false },
];

export function VybesPage() {
  const { enablePayments, isAdmin } = useFeatures();
  const { twitterUsername, vybesBalance, transactionHistory, setVybesBalance, setTransactionHistory } = useAuthStore();
  const { setActivePage } = useUIStore();
  const [showHistory, setShowHistory] = useState(true);
  const [selected, setSelected] = useState('pro');
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [adminIssueId, setAdminIssueId] = useState('');
  const [adminIssueAmount, setAdminIssueAmount] = useState('20');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueMessage, setIssueMessage] = useState('');

  const accountId = twitterUsername || '';

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

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => { if (showHistory) fetchHistory(); }, [showHistory, fetchHistory]);

  const handlePurchase = async (packId: string) => {
    if (!accountId) { setPurchaseError('Please sign in to purchase Vybes'); return; }
    setPurchasingPackId(packId);
    setPurchaseError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, participantId: accountId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session');
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      console.error('Purchase error:', err);
      setPurchaseError(message);
      setPurchasingPackId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleAdminIssue = async () => {
    if (!adminIssueId || !adminIssueAmount) return;
    setIsIssuing(true);
    setIssueMessage('');
    try {
      const response = await fetch('/api/vybes/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUsername: twitterUsername,
          participantId: adminIssueId,
          amount: Number(adminIssueAmount)
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to issue');
      setIssueMessage(`Success! New balance: ${data.balance}`);
      if (adminIssueId === accountId) {
        setVybesBalance(data.balance);
      }
      setAdminIssueId('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setIssueMessage(message);
    } finally {
      setIsIssuing(false);
    }
  };

  const selectedPack = VYBE_PACKS.find(p => p.id === selected)!;

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
      {/* Custom extended header for Vybes — has balance display inline */}
      <div className="relative shrink-0 overflow-hidden rounded-b-[32px] bg-gradient-header pb-6 mb-6">
        <div className="pointer-events-none absolute -top-[60px] -right-10 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(254,197,57,0.12)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 -left-5 h-[120px] w-[120px] rounded-full bg-[radial-gradient(circle,rgba(241,69,115,0.1)_0%,transparent_70%)]" />

        <div className="pt-14 pb-2 px-6" />

        <div className="relative mb-4 flex items-start justify-between px-5 pt-1">
          <div className="flex items-center gap-2.5">
            <div>
              <p className="mb-0.5 text-[12px] tracking-[0.4px] text-white/45">Your currency ✨</p>
              <h1 className="text-[26px] leading-[1.1] font-black text-white">Vybes</h1>
            </div>
          </div>
          <div className="mt-1 flex h-[42px] w-[42px] items-center justify-center rounded-2xl border border-vybe-yellow/25 bg-vybe-yellow/15">
            <Sparkles size={20} className="fill-vybe-yellow text-vybe-yellow" />
          </div>
        </div>

        <div className="relative px-5">
          <p className="mb-1.5 text-[10px] font-bold tracking-[1.2px] text-white/40">YOUR BALANCE</p>
          <div className="mb-3 flex items-end gap-2">
            <Sparkles size={30} className="fill-vybe-yellow text-vybe-yellow" />
            <span className="text-[52px] leading-none font-black text-white">
              {isLoadingBalance ? '…' : vybesBalance}
            </span>
            <span className="mb-1.5 text-[20px] font-bold text-vybe-yellow">Vybes</span>
          </div>

          {/* Last transaction inline */}
          {transactionHistory.length > 0 && (
            <p className="mb-3 text-[11px] text-white/40">
              Last: <span className="text-white/65 font-semibold">{REASON_LABELS[transactionHistory[0].reason] ?? transactionHistory[0].reason}</span>
              {' '}·{' '}
              <span className={transactionHistory[0].amount > 0 ? 'text-status-success' : 'text-vybe-red'}>
                {transactionHistory[0].amount > 0 ? '+' : ''}{transactionHistory[0].amount}
              </span>
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/80"
            >
              <History size={12} />
              {showHistory ? 'Hide History' : 'View History'}
            </button>
            <button
              onClick={() => setActivePage('quiz')}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-vybe-yellow/25 bg-vybe-yellow/15 px-3 py-1.5 text-[12px] font-bold text-vybe-yellow"
            >
              <Zap size={11} />
              Earn Vybes
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Transaction History */}
        {showHistory && (
          <div className="mb-4 rounded-3xl border border-border-light bg-white p-4 shadow-card-muted">
            <h3 className="m-0 mb-3 text-[13px] font-extrabold text-ink">Transaction History</h3>
            {isLoadingHistory ? (
              <p className="text-ink-muted text-[12px] m-0">Loading...</p>
            ) : transactionHistory.length === 0 ? (
              <p className="text-ink-muted text-[12px] m-0">No transactions yet</p>
            ) : (
              <div className="flex flex-col">
                {transactionHistory.map((txn: LedgerEntry) => (
                  <div key={txn.id} className="flex justify-between items-center py-2.5 border-b border-border-light last:border-b-0">
                    <div>
                      <div className="text-[13px] font-bold text-ink">{REASON_LABELS[txn.reason] || txn.reason}</div>
                      <div className="text-[10px] text-ink-muted">{formatDate(txn.createdAt)}</div>
                    </div>
                    <div className={`text-[13px] font-extrabold ${txn.amount > 0 ? 'text-status-success' : 'text-vybe-red'}`}>
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
          <div className="mb-4 rounded-2xl border border-vybe-red/20 bg-tint-pink py-3 px-4 text-[12px] font-bold text-vybe-red">
            {purchaseError}
          </div>
        )}

        {enablePayments && (
          <>
            {/* Buy Vybe Packs */}
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-yellow" />
              <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-gold">BUY VYBE PACKS</p>
            </div>

            <div className="mb-5 flex flex-col gap-3">
              {VYBE_PACKS.map(({ id, name, vybes, price, popular }) => {
                const isSelected = selected === id;
                const isPurchasing = purchasingPackId === id;

                return (
                  <button
                    key={id}
                    onClick={() => setSelected(id)}
                    className={`relative flex cursor-pointer items-center justify-between rounded-2xl bg-white px-4 py-4 transition-all ${
                      isSelected
                        ? 'border-2 border-vybe-yellow shadow-card-yellow'
                        : 'border border-border-light shadow-[0_2px_8px_rgba(99,104,140,0.05)]'
                    } ${isPurchasing ? 'opacity-70' : ''}`}
                  >
                    {popular && (
                      <span className="absolute -top-2.5 right-16 rounded-full bg-vybe-yellow px-2 py-0.5 text-[9px] font-extrabold tracking-[0.5px] text-ink">
                        POPULAR
                      </span>
                    )}
                    <div className="text-left">
                      <p className="text-[15px] font-bold text-ink">{name}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Sparkles size={12} className="fill-vybe-yellow text-vybe-yellow" />
                        <span className="text-[12px] font-medium text-ink-muted">{vybes} Vybes</span>
                      </div>
                    </div>
                    <div className={`flex h-[40px] w-[58px] items-center justify-center rounded-2xl transition-all ${
                      isSelected
                        ? 'bg-gradient-yellow shadow-glow-yellow'
                        : 'bg-tint-muted'
                    }`}>
                      <span className={`text-[14px] font-extrabold ${isSelected ? 'text-ink' : 'text-ink-muted'}`}>
                        ${price}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Unlock Pricing */}
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-ink-muted" />
              <p className="text-[11px] font-extrabold tracking-[0.8px] text-ink-muted">UNLOCK PRICING</p>
            </div>

            <div className="mb-5 rounded-3xl border border-border-light bg-white p-5 shadow-card-muted">
              {UNLOCK_PRICING.map(({ label, cost, free }, index) => (
                <div
                  key={label}
                  className={`flex items-center justify-between py-3 ${
                    index < UNLOCK_PRICING.length - 1 ? 'border-b border-border-light' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                      free ? 'bg-tint-green' : 'bg-tint-muted'
                    }`}>
                      <Lock size={11} className={free ? 'text-status-success-dark' : 'text-ink-muted'} />
                    </div>
                    <span className="text-[13px] text-ink">{label}</span>
                  </div>
                  {free ? (
                    <span className="rounded-full bg-tint-green px-2.5 py-1 text-[11px] font-bold text-status-success-dark">Free</span>
                  ) : (
                    <div className="flex items-center gap-1 rounded-full bg-tint-yellow px-2.5 py-1">
                      <span className="text-[13px] font-extrabold text-vybe-gold">{cost}</span>
                      <Sparkles size={12} className="fill-vybe-yellow text-vybe-yellow" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* What are Vybes? */}
        <div className="relative mb-5 overflow-hidden rounded-3xl border-[1.5px] border-vybe-yellow/15 bg-gradient-dark p-5">
          <div className="pointer-events-none absolute -top-5 -right-2.5 h-[100px] w-[100px] rounded-full bg-[radial-gradient(circle,rgba(254,197,57,0.1)_0%,transparent_70%)]" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-vybe-yellow">
                <Sparkles size={14} className="text-ink" />
              </div>
              <span className="text-[12px] font-extrabold tracking-[0.5px] text-vybe-yellow">WHAT ARE VYBES?</span>
            </div>
            <p className="mb-2.5 text-[13px] leading-[1.7] text-white/70">
              Vybes unlock premium features — view detailed match results, access deeper analytics, and reveal who truly
              resonates with you.
            </p>
            {/* <button
              onClick={() => setActivePage('quiz')}
              className="flex cursor-pointer items-center gap-1 border-0 bg-transparent"
            >
              <span className="text-[12px] font-bold text-vybe-yellow">How to earn Vybes</span>
              <ChevronRight size={13} className="text-vybe-yellow" />
            </button> */}
          </div>
        </div>

        {/* Buy Button */}
        {enablePayments && (
          <>
            <button
              onClick={() => handlePurchase(selected)}
              disabled={purchasingPackId !== null}
              className="mb-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-yellow py-4 text-[15px] font-extrabold text-ink shadow-glow-yellow-lg disabled:opacity-50"
            >
              <Sparkles size={18} className="text-ink" />
              {purchasingPackId ? 'Loading...' : `Buy ${selectedPack.name} — $${selectedPack.price}`}
            </button>

            <p className="mb-1 text-center text-[11px] text-ink-muted">
              🔒 Secure one-time purchase · No subscription
            </p>
          </>
        )}

        {/* ADMIN CONTROLS */}
        {isAdmin && (
          <div className="mt-6 mb-5 rounded-3xl border-2 border-vybe-blue/20 bg-white p-5 shadow-card-muted">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-blue" />
              <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-blue">ADMIN: ISSUE VYBES</p>
            </div>

            <input
              type="text"
              placeholder="Participant ID (e.g. @username)"
              value={adminIssueId}
              onChange={e => setAdminIssueId(e.target.value)}
              className="w-full mb-2 text-[12px] py-2.5 px-3 rounded-xl border border-border-light bg-surface-page"
            />
            <input
              type="number"
              placeholder="Amount"
              value={adminIssueAmount}
              onChange={e => setAdminIssueAmount(e.target.value)}
              className="w-full mb-3 text-[12px] py-2.5 px-3 rounded-xl border border-border-light bg-surface-page"
            />
            <button
              onClick={handleAdminIssue}
              disabled={isIssuing || !adminIssueId || !adminIssueAmount}
              className="w-full py-2.5 bg-tint-blue text-vybe-blue font-bold rounded-xl text-[12px] disabled:opacity-50"
            >
              {isIssuing ? 'Issuing...' : 'Grant Vybes'}
            </button>
            {issueMessage && (
              <p className="mt-2 text-[11px] font-medium text-ink-muted">{issueMessage}</p>
            )}
          </div>
        )}

        {/* DEV ONLY */}
        {/* <div className="mt-8 pt-4 border-t border-dashed border-border-light">
          <button
            onClick={() => {
              const aiCacheEntries: [string, string][] = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('vybecheck_ai_cache_')) {
                  aiCacheEntries.push([key, localStorage.getItem(key)!]);
                }
              }
              localStorage.clear();
              aiCacheEntries.forEach(([k, v]) => localStorage.setItem(k, v));
              window.location.reload();
            }}
            className="w-full py-2 px-4 bg-tint-pink text-vybe-red border border-vybe-red/20 rounded-xl text-[11px] font-mono cursor-pointer"
          >
            🧹 DEV: Clear localStorage & Reload (preserves AI cache)
          </button>
        </div> */}
      </div>
    </div>
  );
}
