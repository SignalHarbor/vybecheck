import { useState, useEffect, useRef } from 'react';
import { Zap, Radio, Sparkles, ChevronRight, ChevronLeft, Home } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Header } from '../components/Header';
import { MatchCard } from '../components/MatchCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { haptic } from '../utils/haptic';
import type { MatchTier } from '../../shared/types';

const TIER_COSTS: Record<MatchTier, number> = {
  PREVIEW: 0,
  TOP3: 2,
  ALL: 5,
};

const TIER_LABELS: Record<MatchTier, string> = {
  PREVIEW: 'Preview (2 matches)',
  TOP3: 'Top 3 Matches',
  ALL: 'All Matches',
};

export function QuizPage() {
  const { sessionId, quizState, matchState, setMatchesLoading, isOwner } = useQuizStore();
  const { send } = useWebSocketStore();
  const { vybesBalance, hasFeatureUnlock, authToken, signInWithTwitter } = useAuthStore();
  const isAuthenticated = authToken !== null;
  const { setActivePage } = useUIStore();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedTier, setSelectedTier] = useState<MatchTier>('PREVIEW');
  const prevQuestionCountRef = useRef(0);

  // Vybes spend confirmation
  const [pendingTier, setPendingTier] = useState<MatchTier | null>(null);

  // Confetti burst on quiz completion
  const [showConfetti, setShowConfetti] = useState(false);
  const prevCompletedRef = useRef(false);

  // Configurable threshold: percentage of participants that must complete before matches can be calculated
  // 100 = all participants must complete, 50 = half must complete, etc.
  const COMPLETION_THRESHOLD_PERCENT = 100;

  // Navigate to new questions when they're added
  useEffect(() => {
    if (!quizState || quizState.questions.length === 0) return;

    const currentQuestionCount = quizState.questions.length;

    // Check if new questions were added
    if (currentQuestionCount > prevQuestionCountRef.current) {
      console.log('New questions added! Old count:', prevQuestionCountRef.current, 'New count:', currentQuestionCount);

      // Find first unanswered
      const firstUnanswered = quizState.myResponses.findIndex(response => response === '');
      console.log('First unanswered question index:', firstUnanswered);

      if (firstUnanswered !== -1) {
        // Jump to first unanswered question
        setCurrentQuestionIndex(firstUnanswered);
      }
    }

    // Update the ref for next comparison
    prevQuestionCountRef.current = currentQuestionCount;

    // Handle out of bounds
    if (currentQuestionIndex >= quizState.questions.length) {
      setCurrentQuestionIndex(quizState.questions.length - 1);
    }
  }, [quizState?.questions.length, quizState?.myResponses, currentQuestionIndex]);

  // Trigger confetti burst when quiz first becomes fully completed
  useEffect(() => {
    if (!quizState) return;
    const isNowCompleted = quizState.myResponses.every(r => r !== '');
    if (isNowCompleted && !prevCompletedRef.current) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1800);
    }
    prevCompletedRef.current = isNowCompleted;
  }, [quizState?.myResponses]);

  const submitResponse = (questionId: string, optionChosen: string) => {
    haptic();
    send({
      type: 'response:submit',
      data: { questionId, optionChosen }
    });

    // Move to next question after answering
    if (quizState && currentQuestionIndex < quizState.questions.length - 1) {
      setTimeout(() => setCurrentQuestionIndex(currentQuestionIndex + 1), 300);
    }
  };

  const getMatches = (tier: MatchTier) => {
    setMatchesLoading(true);
    send({ type: 'matches:get', data: { tier } });
  };

  const handleTierButtonClick = (tier: MatchTier) => {
    if (hasTierAccess(tier) || TIER_COSTS[tier] === 0) {
      getMatches(tier);
    } else {
      setPendingTier(tier);
    }
  };

  const confirmSpend = () => {
    if (pendingTier) {
      getMatches(pendingTier);
      setPendingTier(null);
    }
  };

  // Check if user already has access to a tier (won't be charged again)
  const hasTierAccess = (tier: MatchTier): boolean => {
    if (tier === 'PREVIEW') return true;
    if (tier === 'TOP3') return hasFeatureUnlock('MATCH_TOP3') || hasFeatureUnlock('MATCH_ALL');
    if (tier === 'ALL') return hasFeatureUnlock('MATCH_ALL');
    return false;
  };

  const canAffordTier = (tier: MatchTier): boolean => {
    if (hasTierAccess(tier)) return true;
    return vybesBalance >= TIER_COSTS[tier];
  };

  // Status pills for the header
  const headerPills = (
    <>
      <div className="flex items-center gap-1.5 rounded-full border border-vybe-blue/25 bg-vybe-blue/15 px-2.5 py-1">
        <span className={`h-1.5 w-1.5 rounded-full bg-vybe-blue ${sessionId ? 'animate-pulse' : 'opacity-70'}`} />
        <span className="text-[11px] font-bold text-vybe-blue">
          {sessionId ? 'In session' : 'No active session'}
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1">
        <Sparkles size={10} className="fill-vybe-yellow text-vybe-yellow" />
        <span className="text-[11px] text-white/55">{vybesBalance} Vybes</span>
      </div>
    </>
  );

  // No active session
  if (!sessionId || !quizState) {
    // DEV DEMO: toggle to preview match cards
    // TODO: REMOVE BEFORE PUBLISHING
    const [showMatchDemo, setShowMatchDemo] = (useState as typeof useState<boolean>)(false);
    const demoMatches = [
      { participantId: 'abc123def456', username: 'kingnoble_',   matchPercentage: 92 },
      { participantId: 'xyz789ghi012', username: 'signalharbor', matchPercentage: 74 },
      { participantId: 'mno345pqr678', username: 'vybemaster',   matchPercentage: 55 },
      { participantId: 'stu901vwx234', username: 'lowvybe_dev',  matchPercentage: 31 },
    ];

    return (
      <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
        <Header
          title="Quiz"
          subtitle="Ready to answer? ⚡"
          actionIcon={<Zap size={20} strokeWidth={2.5} />}
          actionColor="blue"
          pills={headerPills}
        />

        <div className="flex-1 overflow-y-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* DEV: Match ring demo */}
          <div className="mb-4 rounded-2xl border border-dashed border-vybe-yellow/40 bg-tint-yellow px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[12px] font-bold text-vybe-gold">🎨 DEV: Match ring preview</p>
            <button
              onClick={() => setShowMatchDemo(v => !v)}
              className="rounded-xl bg-vybe-yellow/30 px-3 py-1 text-[11px] font-extrabold text-vybe-gold cursor-pointer border-0"
            >
              {showMatchDemo ? 'Hide' : 'Show'}
            </button>
          </div>

          {showMatchDemo && (
            <div className="mb-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-red" />
                <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-red">DEMO MATCHES</p>
              </div>
              <div className="flex flex-col gap-2">
                {demoMatches.map((m, i) => (
                  <MatchCard key={m.participantId} match={m} rank={i + 1} />
                ))}
              </div>
            </div>
          )}

          <div className="relative mb-5 overflow-hidden rounded-3xl border-[1.5px] border-vybe-blue/20 bg-white p-5 shadow-card-blue">
            <div className="pointer-events-none absolute -top-[30px] -right-5 h-[110px] w-[110px] rounded-full bg-[radial-gradient(circle,rgba(83,157,192,0.1)_0%,transparent_70%)]" />
            <div className="relative">
              <div className="mb-3 flex h-[46px] w-[46px] items-center justify-center rounded-2xl bg-tint-blue">
                <Zap size={22} strokeWidth={2.2} className="text-vybe-blue" />
              </div>
              <h2 className="mb-[5px] text-[17px] font-extrabold text-ink">No Active Session</h2>
              <p className="mb-4 text-[13px] leading-[1.6] text-ink-muted">
                Head to the Lobby to join a live session and start answering questions in real time.
              </p>
              <button
                onClick={() => setActivePage('lobby')}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-red py-3 text-[14px] font-bold text-white shadow-glow-red"
              >
                <Radio size={15} />
                Go to Lobby →
              </button>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-blue" />
            <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-blue">HOW IT WORKS</p>
          </div>
          <div className="mb-5 rounded-3xl border border-border-light bg-white p-5 shadow-card-muted">
            {[
              { step: '1', label: 'Join a live session from the Lobby', bgClass: 'bg-vybe-red/10', textClass: 'text-vybe-red' },
              { step: '2', label: 'Answer questions in real time', bgClass: 'bg-vybe-blue/12', textClass: 'text-vybe-blue' },
              { step: '3', label: 'See your vybe compatibility results', bgClass: 'bg-vybe-yellow/18', textClass: 'text-vybe-yellow' },
            ].map(({ step, label, bgClass, textClass }) => (
              <div key={step} className="mb-4 flex items-center gap-4 last:mb-0">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${bgClass}`}>
                  <span className={`text-[16px] font-black ${textClass}`}>{step}</span>
                </div>
                <p className="text-[13px] leading-[1.4] text-ink">{label}</p>
              </div>
            ))}
          </div>

          {/* Vybes upsell */}
          <button
            onClick={() => setActivePage('vybes')}
            className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] border-vybe-yellow/25 bg-white px-4 py-3.5 shadow-[0_2px_14px_rgba(254,197,57,0.1)]">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-tint-yellow">
              <Sparkles size={18} className="fill-vybe-yellow text-vybe-yellow" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-bold text-ink">{vybesBalance} Vybes</p>
              <p className="text-[11px] text-ink-muted">Top up to unlock match insights</p>
            </div>
            <ChevronRight size={16} className="text-ink-muted" />
          </button>
        </div>
      </div>
    );
  }

  // Session hasn't started yet (still in lobby)
  if (quizState.status === 'live') {
    return (
      <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
        <Header title="Quiz" subtitle="Waiting to start ⏳" />
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h2 className="text-[17px] font-extrabold text-ink m-0 mb-2">Session Not Started</h2>
          <p className="text-[13px] text-ink-muted m-0 mb-5">Waiting for the host to start the session...</p>
          <button
            onClick={() => setActivePage('lobby')}
            className="flex items-center gap-2 rounded-2xl border border-border-light bg-white px-5 py-3 text-[13px] font-bold text-vybe-blue cursor-pointer shadow-card-muted active:scale-[0.97]"
          >
            <Radio size={14} /> Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (quizState.questions.length === 0) {
    return (
      <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
        <Header title="Quiz" subtitle="Waiting for questions ⏳" />
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
          <div className="text-5xl mb-4 opacity-50">⏳</div>
          <p className="text-[13px] text-ink-muted m-0">Waiting for the host to add questions...</p>
        </div>
      </div>
    );
  }

  // Session ended — show a summary screen
  if (quizState.status === 'expired') {
    const answeredCount = quizState.myResponses.filter(r => r !== '').length;
    const totalQs = quizState.questions.length;
    return (
      <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
        <Header title="Quiz" subtitle="Session wrapped 🎉" pills={headerPills} />
        <div className="flex-1 overflow-y-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Summary card */}
          <div className="mb-4 rounded-3xl border border-border-light bg-white p-6 shadow-card-muted flex flex-col items-center text-center">
            <div className="mb-4 w-14 h-14 bg-tint-yellow rounded-2xl flex items-center justify-center text-3xl">🏁</div>
            <h2 className="text-[17px] font-extrabold text-ink mb-1">Session Ended</h2>
            <p className="text-[13px] text-ink-muted mb-5">Here's how you did</p>
            <div className="flex items-stretch gap-3 w-full mb-5">
              <div className="flex-1 rounded-2xl bg-tint-blue p-3 text-center">
                <p className="text-[22px] font-black text-vybe-blue">{answeredCount}/{totalQs}</p>
                <p className="text-[10px] font-bold text-ink-muted tracking-[0.6px]">ANSWERED</p>
              </div>
              <div className="flex-1 rounded-2xl bg-tint-yellow p-3 text-center">
                <p className="text-[22px] font-black text-vybe-gold">{vybesBalance}</p>
                <p className="text-[10px] font-bold text-ink-muted tracking-[0.6px]">VYBES</p>
              </div>
            </div>
            <button
              onClick={() => setActivePage('lobby')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-red py-3 text-[14px] font-bold text-white shadow-glow-red cursor-pointer active:scale-[0.97]"
            >
              <Home size={15} /> Back to Lobby
            </button>
          </div>

          {/* Show matches if released */}
          {quizState.resultsReleased && matchState?.matches && matchState.matches.length > 0 && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-red" />
                <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-red">YOUR MATCHES</p>
              </div>
              <div className="flex flex-col gap-3">
                {matchState.matches.map((match, i) => (
                  <MatchCard key={match.participantId} match={match} rank={i + 1} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const currentQuestion = quizState.questions[currentQuestionIndex];
  const currentResponse = quizState.myResponses[currentQuestionIndex];
  const hasAnswered = currentResponse !== '';
  const answeredCount = quizState.myResponses.filter(r => r !== '').length;
  const totalQuestions = quizState.questions.length;
  const progressPercentage = Math.round((answeredCount / totalQuestions) * 100);

  // Calculate completion locally - check if all questions have been answered
  const isCompleted = quizState.myResponses.every(r => r !== '');

  // Touch swipe to navigate questions
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return; // threshold
    if (dx < 0 && currentQuestionIndex < totalQuestions - 1 && hasAnswered) {
      setCurrentQuestionIndex(i => i + 1); // swipe left = next
    } else if (dx > 0 && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1); // swipe right = prev
    }
  };

  return (
    <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
      <Header title="Quiz" subtitle="Answer time ⚡" />

      {/* Confetti burst overlay */}
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {[...Array(18)].map((_, i) => {
            const colors = ['#FEC539','#F14573','#539DC0','#63688C','#22C55E'];
            const color = colors[i % colors.length];
            const left = `${5 + (i * 5.5) % 90}%`;
            const delay = `${(i * 0.07).toFixed(2)}s`;
            return (
              <div
                key={i}
                className="absolute top-1/3 h-2.5 w-2.5 rounded-full"
                style={{
                  left,
                  background: color,
                  animation: `confettiBurst 1.6s ease-out ${delay} forwards`,
                }}
              />
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Progress Bar */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold tracking-[0.8px] text-ink-muted">QUESTION {currentQuestionIndex + 1} OF {totalQuestions}</span>
            <span className="text-[12px] font-bold text-vybe-blue">{progressPercentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-tint-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-vybe-blue to-vybe-blue-dark rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>

        {/* Guest sign-in banner */}
        {!isAuthenticated && (
          <div className="mb-4 rounded-2xl border-[1.5px] border-vybe-yellow/25 bg-tint-yellow p-4 flex flex-col items-center text-center gap-3">
            <p className="text-[13px] font-bold text-vybe-gold m-0">Sign in to participate and get matched!</p>
            <button
              onClick={() => signInWithTwitter()}
              className="flex items-center justify-center gap-2 py-2.5 px-5 border-none rounded-xl cursor-pointer text-[13px] font-bold bg-twitter text-white shadow-twitter active:scale-[0.97]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Sign in with Twitter
            </button>
          </div>
        )}

        {/* Question Card */}
        {!isCompleted ? (
          <>
          <div
            className="rounded-3xl border-[1.5px] border-vybe-blue/20 bg-white p-5 shadow-card-blue flex flex-col items-center text-center"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-12 h-12 bg-tint-blue rounded-2xl flex items-center justify-center mb-5">
              <Zap size={24} strokeWidth={2} className="text-vybe-blue" />
            </div>
            <h2 className="text-[17px] font-extrabold text-ink m-0 mb-2 leading-tight">{currentQuestion.prompt}</h2>
            <p className="text-[13px] text-ink-muted m-0 mb-5 leading-[1.6]">
              {isAuthenticated ? 'Pick the option that speaks to you.' : 'Sign in to answer.'}
            </p>

            <div className="w-full grid grid-cols-2 gap-2">
              {currentQuestion.options.map((option) => {
                const isSelected = hasAnswered && currentResponse === option;
                return (
                  <button
                    key={option}
                    onClick={() => isAuthenticated && submitResponse(currentQuestion.id, option)}
                    disabled={!isAuthenticated || hasAnswered}
                    className={`rounded-2xl py-4 px-3 text-center transition-all [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed ${
                      !isAuthenticated
                        ? 'border border-border-light bg-surface-page opacity-60'
                        : isSelected
                          ? 'border-2 border-status-success bg-tint-green text-status-success-dark font-extrabold'
                          : 'border border-border-light bg-surface-page hover:border-vybe-blue/30 cursor-pointer active:scale-[0.97]'
                    }`}
                  >
                    <span className={`text-[14px] font-semibold ${isSelected ? 'text-status-success-dark' : 'text-ink'}`}>
                      {option}{isSelected && ' ✓'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between gap-3 mt-4">
            <button
              onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-1.5 rounded-2xl border border-border-light bg-white px-4 py-2.5 text-[13px] font-bold text-ink disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
            >
              <ChevronLeft size={15} strokeWidth={2.5} /> Prev
            </button>
            <span className="text-[12px] font-bold text-ink-muted">
              {currentQuestionIndex + 1} / {totalQuestions}
            </span>
            <button
              onClick={() => setCurrentQuestionIndex(i => Math.min(totalQuestions - 1, i + 1))}
              disabled={currentQuestionIndex === totalQuestions - 1 || !hasAnswered}
              className="flex items-center gap-1.5 rounded-2xl border border-border-light bg-white px-4 py-2.5 text-[13px] font-bold text-ink disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
            >
              Next <ChevronRight size={15} strokeWidth={2.5} />
            </button>
          </div>
          </>

        ) : !quizState.resultsReleased && !isOwner ? (
          <div className="rounded-3xl border border-border-light bg-white p-6 shadow-card-muted flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-tint-yellow rounded-2xl flex items-center justify-center mb-5">
              <Sparkles size={24} className="fill-vybe-yellow text-vybe-yellow" />
            </div>
            <h2 className="text-[17px] font-extrabold text-ink m-0 mb-2">Quiz Complete!</h2>
            <p className="text-[13px] text-ink-muted m-0 mb-4">Waiting for the host to release results...</p>
            <div className="text-3xl animate-pulse">⏳</div>
          </div>
        ) : (
          /* Matches Section */
          <div className="rounded-3xl border border-border-light bg-white p-5 shadow-card-muted flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-tint-blue rounded-2xl flex items-center justify-center mb-5">
              <Sparkles size={24} className="text-vybe-blue" />
            </div>
            <h2 className="text-[17px] font-extrabold text-ink m-0 mb-2">Results are in!</h2>
            <p className="text-[13px] text-ink-muted m-0 mb-5">See who you vibe with.</p>

            {(() => {
              const participantsWithResponses = quizState.participants.filter(p => p.isActive).length;
              const totalParticipants = quizState.participantCount;
              const completionRate = totalParticipants > 0
                ? Math.round((participantsWithResponses / totalParticipants) * 100) : 0;
              const canCalculateMatches = completionRate >= COMPLETION_THRESHOLD_PERCENT;

              return (
                <>
                  {!canCalculateMatches && (
                    <div className="rounded-2xl border border-vybe-yellow/25 bg-tint-yellow py-3 px-4 mb-4 text-[12px] text-vybe-gold font-bold text-center w-full">
                      ⏳ Waiting for {COMPLETION_THRESHOLD_PERCENT}% completion
                      <div className="mt-1 text-[11px] font-medium opacity-80">
                        {completionRate}% ({participantsWithResponses}/{totalParticipants} active)
                      </div>
                    </div>
                  )}

                  {/* Tier Selection */}
                  <div className="mt-2 flex flex-col gap-2 w-full">
                    {(['PREVIEW', 'TOP3', 'ALL'] as MatchTier[]).map((tier) => {
                      const cost = TIER_COSTS[tier];
                      const hasAccess = hasTierAccess(tier);
                      const canAfford = canAffordTier(tier);
                      const isSelected = selectedTier === tier;

                      return (
                        <button
                          key={tier}
                          onClick={() => setSelectedTier(tier)}
                          disabled={!canCalculateMatches}
                          className={`flex justify-between items-center py-3 px-4 rounded-2xl transition-all ${
                            isSelected ? 'border-2 border-vybe-blue bg-tint-blue' : 'border border-border-light bg-white'
                          } ${canCalculateMatches ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded-full ${
                              isSelected ? 'border-[5px] border-vybe-blue bg-white' : 'border-2 border-border-light bg-white'
                            }`} />
                            <span className="text-[13px] font-semibold text-ink">{TIER_LABELS[tier]}</span>
                          </div>
                          <span className={`text-[12px] font-bold ${
                            hasAccess ? 'text-status-success' : canAfford ? 'text-vybe-blue' : 'text-vybe-red'
                          }`}>
                            {hasAccess ? '✓ Unlocked' : cost === 0 ? 'Free' : `${cost} ✨`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Balance */}
                  <div className="flex justify-between items-center mt-3 py-2.5 px-3 bg-tint-muted rounded-xl text-[12px] text-ink-muted w-full">
                    <span>Your balance:</span>
                    <span className="font-bold text-ink">{vybesBalance} ✨</span>
                  </div>

                  <button
                    onClick={() => handleTierButtonClick(selectedTier)}
                    disabled={!canCalculateMatches || !canAffordTier(selectedTier) || matchState.isLoading}
                    className={`w-full mt-4 py-3.5 border-none rounded-2xl cursor-pointer text-[14px] font-bold transition-all bg-gradient-red text-white shadow-glow-red active:scale-[0.97] ${
                      canCalculateMatches && canAffordTier(selectedTier) ? '' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {matchState.isLoading ? 'Loading...' :
                     hasTierAccess(selectedTier) ? `View ${TIER_LABELS[selectedTier]}` :
                     `Unlock ${TIER_LABELS[selectedTier]} (${TIER_COSTS[selectedTier]} ✨)`}
                  </button>
                </>
              );
            })()}

            {matchState.matches.length > 0 && (
              <div className="mt-5 w-full">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-red" />
                  <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-red">
                    YOUR MATCHES ({TIER_LABELS[matchState.tier].toUpperCase()})
                  </p>
                  {matchState.cost > 0 && (
                    <span className="ml-auto text-[11px] text-ink-muted">Cost: {matchState.cost} ✨</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {matchState.matches.map((match, index) => (
                    <MatchCard key={match.participantId} match={match} rank={index + 1} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vybes spend confirmation */}
      {pendingTier && (
        <ConfirmDialog
          isOpen={true}
          title={`Unlock ${TIER_LABELS[pendingTier]}?`}
          message={`This will spend ${TIER_COSTS[pendingTier]} ✨ Vybes from your balance of ${vybesBalance} ✨. You won't be charged again for this tier.`}
          confirmText={`Spend ${TIER_COSTS[pendingTier]} Vybes`}
          cancelText="Cancel"
          onConfirm={confirmSpend}
          onCancel={() => setPendingTier(null)}
        />
      )}
    </div>
  );
}
