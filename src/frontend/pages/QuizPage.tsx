import { useState, useEffect, useRef } from 'react';
import { useQuizStore } from '../store/quizStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { MatchCard } from '../components/MatchCard';
import type { MatchTier } from '../../shared/types';

// TODO: Refactor this page - it's doing a lot right now with quiz taking, progress tracking, and match purchasing.
// We can break it down into smaller components and hooks for better readability and maintainability.
// Pricing for match tiers
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

  const submitResponse = (questionId: string, optionChosen: string) => {
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

  // No active session
  if (!sessionId || !quizState) {
    return (
      <div className="w-full min-h-full">
        <div className="bg-white p-8 rounded-[20px] text-center shadow-card">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="m-0 mb-2 text-2xl font-bold text-gray-800">
            No Active Session
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Join a session to start answering questions and find your matches.
          </p>
          <button
            onClick={() => setActivePage('lobby')}
            className="w-full py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-gradient-to-br from-vybe-blue to-vybe-purple text-white shadow-primary active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  // Session hasn't started yet (still in lobby)
  if (quizState.status === 'live') {
    return (
      <div className="w-full min-h-full">
        <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
          <div className="text-6xl mb-4 animate-pulse">⏳</div>
          <h2 className="text-xl font-bold text-gray-800 m-0 mb-2">Session Not Started</h2>
          <p className="text-base text-gray-500 m-0">Waiting for the host to start the session...</p>
          <button
            onClick={() => setActivePage('lobby')}
            className="mt-6 py-3 px-6 border-2 border-gray-200 rounded-xl cursor-pointer text-[15px] font-semibold bg-white text-vybe-blue active:scale-[0.97]"
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (quizState.questions.length === 0) {
    return (
      <div className="w-full min-h-full">
        <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
          <div className="text-6xl mb-4 opacity-50">⏳</div>
          <p className="text-base text-gray-500 m-0">Waiting for questions...</p>
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

  return (
    <div className="w-full min-h-full flex flex-col gap-6">
      {/* Progress Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-gray-500 tracking-wide">QUESTION {currentQuestionIndex + 1} OF {totalQuestions}</span>
          <span className="text-[13px] font-semibold text-vybe-blue">{progressPercentage}% Complete</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-vybe-blue to-vybe-purple rounded transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
        </div>
      </div>

      {/* Guest sign-in banner */}
      {!isAuthenticated && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-2xl py-4 px-5 flex flex-col items-center text-center gap-3">
          <p className="text-sm font-semibold text-amber-800 m-0">You're viewing as a guest. Sign in to participate and get matched!</p>
          <button
            onClick={() => signInWithTwitter()}
            className="flex items-center justify-center gap-2 py-2.5 px-5 border-none rounded-xl cursor-pointer text-sm font-semibold bg-twitter text-white shadow-twitter active:scale-[0.97]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Sign in with Twitter
          </button>
        </div>
      )}

      {/* Question Card */}
      {!isCompleted ? (
        <div className="bg-white rounded-3xl py-8 px-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)] flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center text-[32px] mb-6">🎨</div>
          <h2 className="text-2xl font-bold text-gray-800 m-0 mb-3 leading-tight">{currentQuestion.prompt}</h2>
          <p className="text-[15px] text-gray-500 m-0 mb-8 leading-relaxed">
            {isAuthenticated ? 'Pick the option that speaks to you right now.' : 'Sign in with Twitter to answer and get matched.'}
          </p>

          <div className="w-full flex flex-col gap-3">
            {currentQuestion.options.map((option) => {
              const isSelected = hasAnswered && currentResponse === option;
              return (
                <button
                  key={option}
                  onClick={() => isAuthenticated && submitResponse(currentQuestion.id, option)}
                  disabled={!isAuthenticated || hasAnswered}
                  className={`w-full flex items-center gap-4 p-4 border-2 rounded-2xl transition-all text-left [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed ${
                    !isAuthenticated
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : isSelected
                        ? 'bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 border-emerald-500'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ${
                    isSelected
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                      : 'bg-gradient-to-br from-vybe-blue to-vybe-purple'
                  }`}>
                    {isSelected ? '✓' : '○'}
                  </div>
                  <span className="flex-1 text-base font-semibold text-gray-800">{option}</span>
                  <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? 'border-emerald-500' : 'border-gray-300'
                  }`}>
                    {isSelected && <div className="w-3 h-3 bg-emerald-500 rounded-full" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : !quizState.resultsReleased && !isOwner ? (
        /* Waiting for host to release results */
        <div className="bg-white rounded-3xl py-8 px-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)] flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl flex items-center justify-center text-[32px] mb-6">✨</div>
          <h2 className="text-2xl font-bold text-gray-800 m-0 mb-3 leading-tight">You've completed the quiz!</h2>
          <p className="text-[15px] text-gray-500 m-0 mb-4 leading-relaxed">Waiting for the host to release results...</p>
          <div className="text-4xl animate-pulse">⏳</div>
        </div>
      ) : (
        /* Matches Section - shown after results released */
        <div className="bg-white rounded-3xl py-8 px-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)] flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-2xl flex items-center justify-center text-[32px] mb-6">✨</div>
          <h2 className="text-2xl font-bold text-gray-800 m-0 mb-3 leading-tight">Results are in!</h2>
          <p className="text-[15px] text-gray-500 m-0 mb-8 leading-relaxed">Calculate your matches to see who you vibe with.</p>

          {(() => {
            // Calculate how many participants have completed
            const participantsWithResponses = quizState.participants.filter(p => {
              // Check if this participant has answered all questions
              // Note: This is a simplified check - in reality, we'd need server data
              // For now, we'll use a simple heuristic based on active participants
              return p.isActive;
            }).length;

            const totalParticipants = quizState.participantCount;
            const completionRate = totalParticipants > 0
              ? Math.round((participantsWithResponses / totalParticipants) * 100)
              : 0;

            const canCalculateMatches = completionRate >= COMPLETION_THRESHOLD_PERCENT;

            return (
              <>
                {!canCalculateMatches && (
                  <div className="bg-amber-100 border-2 border-amber-500 rounded-xl py-3 px-4 mt-4 text-sm text-amber-800 font-medium text-center">
                    ⏳ Waiting for {COMPLETION_THRESHOLD_PERCENT}% of participants to complete
                    <div className="mt-2 text-[13px] opacity-80">
                      Currently: {completionRate}% ({participantsWithResponses}/{totalParticipants} active)
                    </div>
                  </div>
                )}

                {/* Tier Selection */}
                <div className="mt-5 flex flex-col gap-2 w-full">
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
                        className={`flex justify-between items-center py-3.5 px-4 rounded-xl border-2 transition-all ${
                          isSelected ? 'border-vybe-blue bg-indigo-50' : 'border-gray-200 bg-white'
                        } ${canCalculateMatches ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-50'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full bg-white ${
                            isSelected ? 'border-[6px] border-vybe-blue' : 'border-2 border-gray-300'
                          }`} />
                          <span className="font-semibold text-gray-800">
                            {TIER_LABELS[tier]}
                          </span>
                        </div>
                        <span className={`text-sm font-semibold ${
                          hasAccess ? 'text-emerald-500' : canAfford ? 'text-vybe-blue' : 'text-red-500'
                        }`}>
                          {hasAccess ? '✓ Unlocked' : cost === 0 ? 'Free' : `${cost} ✨`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Balance indicator */}
                <div className="flex justify-between items-center mt-3 py-2 px-3 bg-gray-50 rounded-lg text-[13px] text-gray-500 w-full">
                  <span>Your balance:</span>
                  <span className="font-semibold text-gray-800">{vybesBalance} ✨</span>
                </div>

                <button
                  onClick={() => getMatches(selectedTier)}
                  disabled={!canCalculateMatches || !canAffordTier(selectedTier) || matchState.isLoading}
                  className={`w-full mt-4 py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-gradient-to-br from-vybe-blue to-vybe-purple text-white shadow-primary active:scale-[0.97] ${
                    canCalculateMatches && canAffordTier(selectedTier) ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'
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
            <div className="mt-6 w-full">
              <div className="flex justify-between items-center mb-3">
                <h3 className="m-0 text-base font-bold text-gray-800">
                  Your Matches ({TIER_LABELS[matchState.tier]})
                </h3>
                {matchState.cost > 0 && (
                  <span className="text-[13px] text-gray-500">
                    Cost: {matchState.cost} ✨
                  </span>
                )}
              </div>
              <div className="mt-4">
                {matchState.matches.map((match, index) => (
                  <MatchCard
                    key={match.participantId}
                    match={match}
                    rank={index + 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
