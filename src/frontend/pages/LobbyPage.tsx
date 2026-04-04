import { useState } from 'react';
import { Users, ChevronRight, Radio, Zap } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useDraftStore } from '../store/draftStore';
import { Header } from '../components/Header';

export function LobbyPage() {
  const { sessionId, participantId, quizState, isOwner } = useQuizStore();
  const { send } = useWebSocketStore();
  const { twitterUsername, authToken, signInWithTwitter } = useAuthStore();
  const isAuthenticated = authToken !== null;
  const { showError, showNotification, setActivePage } = useUIStore();
  const { draftQuestions, clearDrafts } = useDraftStore();
  const [joinSessionId, setJoinSessionId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  const headerPills = (
    <>
      {sessionId ? (
        <div className="flex items-center gap-1.5 rounded-full border border-vybe-yellow/25 bg-vybe-yellow/15 px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-vybe-yellow" />
          <span className="text-[11px] font-bold text-vybe-yellow">
            {quizState?.status === 'live' ? 'In lobby' : 'Session active'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1">
          <Users size={10} className="text-white/55" />
          <span className="text-[11px] text-white/55">No session</span>
        </div>
      )}
    </>
  );

  // No active session - show create/join options
  if (!sessionId || !quizState) {
    const handleCreateSession = () => {
      setIsCreating(true);
      send({ type: 'session:create', data: { username: twitterUsername || undefined } });

      if (draftQuestions.length > 0) {
        setTimeout(() => {
          draftQuestions.forEach(draft => {
            send({
              type: 'question:add',
              data: {
                prompt: draft.prompt,
                options: draft.options,
                ownerResponse: draft.ownerResponse
              }
            });
          });
          clearDrafts();
          showNotification(`Session created with ${draftQuestions.length} question(s)`);
        }, 500);
      }
    };

    const handleJoinSession = () => {
      if (!joinSessionId.trim()) {
        showError('Please enter a session ID');
        return;
      }
      send({ type: 'session:join', data: { sessionId: joinSessionId, username: twitterUsername || undefined } });
    };

    return (
      <div className="relative flex h-full flex-col bg-surface-page font-sans">
        <Header title="Lobby" subtitle="Find your vybe 🎯" pills={headerPills} />

        <div className="flex-1 overflow-y-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Session code join */}
          <div className="mt-4 mb-4 flex items-center gap-2.5 rounded-2xl border-[1.5px] border-vybe-blue/20 bg-white px-4 py-3">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl bg-tint-blue">
              <span className="text-[13px]">🔑</span>
            </div>
            <input
              value={joinSessionId}
              onChange={(e) => setJoinSessionId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
              placeholder="Have a session code? Enter it here…"
              className="flex-1 border-0 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-muted"
            />
            {joinSessionId.length > 0 && (
              <button
                onClick={handleJoinSession}
                className="shrink-0 cursor-pointer rounded-xl border-0 bg-gradient-blue px-3 py-1.5 text-[12px] font-bold text-white"
              >
                Go →
              </button>
            )}
          </div>

          {/* Create session card */}
          {isAuthenticated && (
            <div className="relative mb-5 overflow-hidden rounded-3xl border-[1.5px] border-vybe-blue/20 bg-white p-5 shadow-card-blue">
              <div className="pointer-events-none absolute -top-[30px] -right-5 h-[110px] w-[110px] rounded-full bg-[radial-gradient(circle,rgba(83,157,192,0.1)_0%,transparent_70%)]" />
              <div className="relative">
                <div className="mb-3 flex h-[46px] w-[46px] items-center justify-center rounded-2xl bg-tint-blue">
                  <Radio size={22} strokeWidth={2.2} className="text-vybe-blue" />
                </div>
                <h2 className="mb-[5px] text-[17px] font-extrabold text-ink">Create a Session</h2>
                <p className="mb-4 text-[13px] leading-[1.6] text-ink-muted">
                  Start a new quiz session. Others can join using your session code.
                </p>
                <button
                  onClick={handleCreateSession}
                  disabled={isCreating}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-red py-3 text-[14px] font-bold text-white shadow-glow-red disabled:opacity-50"
                >
                  <Radio size={15} />
                  {isCreating ? 'Creating...' : draftQuestions.length > 0
                    ? `Create Session (${draftQuestions.length} draft${draftQuestions.length !== 1 ? 's' : ''})`
                    : 'Create New Session'}
                </button>
                {draftQuestions.length > 0 && (
                  <p className="mt-2 text-[11px] text-vybe-blue text-center">
                    Your drafts will be published automatically
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Guest sign-in */}
          {!isAuthenticated && (
            <div className="mb-5 rounded-2xl border-[1.5px] border-vybe-yellow/25 bg-tint-yellow p-4 flex flex-col items-center text-center gap-3">
              <p className="text-[13px] font-bold text-vybe-gold m-0">Sign in to create sessions and get matched!</p>
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

          {/* Vybes upsell */}
          <div
            className="relative cursor-pointer overflow-hidden rounded-3xl bg-gradient-dark p-5 shadow-card-dark"
            onClick={() => setActivePage('vybes')}
          >
            <div className="pointer-events-none absolute -top-10 -right-5 h-[140px] w-[140px] rounded-full bg-[radial-gradient(circle,rgba(254,197,57,0.14)_0%,transparent_70%)]" />
            <div className="relative flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[14px] font-extrabold text-white">Unlock your matches!</p>
                <p className="mt-px text-[12px] text-white/60">Top up Vybes to see compatibility →</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-vybe-yellow">
                <Zap size={17} className="fill-ink text-ink" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isLobby = quizState.status === 'live';
  const isActive = quizState.status === 'active';

  const handleStartSession = () => {
    if (quizState.questions.length === 0) {
      showError('Add at least one question before starting');
      return;
    }
    send({ type: 'session:start' });
  };

  const handleReleaseResults = () => {
    send({ type: 'session:release-results' });
  };

  return (
    <div className="relative flex h-full flex-col bg-surface-page font-sans">
      <Header
        title="Lobby"
        subtitle={isLobby ? 'Waiting for start 🎯' : 'Session active ⚡'}
        pills={
          <>
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              isLobby
                ? 'border-vybe-yellow/25 bg-vybe-yellow/15'
                : 'border-status-success/30 bg-status-success/15'
            }`}>
              <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isLobby ? 'bg-vybe-yellow' : 'bg-status-success'}`} />
              <span className={`text-[11px] font-bold ${isLobby ? 'text-vybe-yellow' : 'text-status-success'}`}>
                {isLobby ? 'Lobby' : 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1">
              <Users size={10} className="text-white/55" />
              <span className="text-[11px] text-white/55">{quizState.participantCount} participants</span>
            </div>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Session ID Card */}
        <div className="mt-4 mb-4 rounded-2xl border border-border-light bg-white p-4 shadow-card-muted">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[1px] text-ink-muted">SESSION ID</p>
              <p className="mt-1 font-mono text-[15px] font-bold tracking-wider text-ink">{sessionId}</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-tint-muted px-2.5 py-1">
              <Radio size={10} className="text-ink-muted" />
              <span className="text-[10px] font-bold text-ink-muted">{isLobby ? 'LOBBY' : 'ACTIVE'}</span>
            </div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-blue" />
          <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-blue">
            PARTICIPANTS ({quizState.participantCount})
          </p>
        </div>

        <div className="mb-5 rounded-3xl border border-border-light bg-white p-4 shadow-card-muted">
          {(isOwner && isActive && quizState.participantProgress
            ? quizState.participantProgress.map(p => (
                <div key={p.participantId} className="flex items-center gap-3 py-3 border-b border-border-light last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-ink truncate">
                        {p.username || p.participantId.slice(0, 8)}
                      </span>
                      {p.isOwner && <span className="text-[10px]" title="Owner">👑</span>}
                      {p.participantId === participantId && (
                        <span className="text-[9px] font-extrabold text-vybe-blue bg-tint-blue py-0.5 px-1.5 rounded">YOU</span>
                      )}
                      {!p.isActive && <span className="text-[10px] text-ink-muted">(offline)</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 bg-tint-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            p.completionPercent === 100 ? 'bg-status-success' : p.completionPercent > 0 ? 'bg-vybe-blue' : 'bg-border-light'
                          }`}
                          style={{ width: `${p.completionPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-ink-muted w-7 text-right">{p.completionPercent}%</span>
                    </div>
                  </div>
                </div>
              ))
            : quizState.participants.map(p => (
                <div key={p.id} className="flex items-center gap-2 py-3 border-b border-border-light last:border-b-0">
                  <span className="text-[13px] font-bold text-ink">
                    {p.username || p.id.slice(0, 8)}
                  </span>
                  {p.isOwner && <span className="text-[10px]" title="Owner">👑</span>}
                  {p.id === participantId && (
                    <span className="text-[9px] font-extrabold text-vybe-blue bg-tint-blue py-0.5 px-1.5 rounded">YOU</span>
                  )}
                  {!p.isActive && <span className="text-[10px] text-ink-muted">(offline)</span>}
                </div>
              ))
          )}
        </div>

        {/* Published Questions (owner only) */}
        {isOwner && quizState.questions.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowQuestions(!showQuestions)}
              className="mb-2 flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border-light bg-white px-4 py-3 shadow-[0_2px_8px_rgba(99,104,140,0.05)]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl bg-tint-muted">
                  <span className="text-[13px]">📋</span>
                </div>
                <span className="text-[13px] font-semibold text-ink">
                  Published Questions ({quizState.questions.length})
                </span>
              </div>
              <ChevronRight size={16} className={`text-ink-muted transition-transform ${showQuestions ? 'rotate-90' : ''}`} />
            </button>
            {showQuestions && (
              <div className="rounded-2xl border border-border-light bg-white overflow-hidden shadow-card-muted">
                {quizState.questions.map((q, i) => (
                  <div key={q.id} className="py-3 px-4 border-b border-border-light last:border-b-0">
                    <div className="text-[13px] font-bold text-ink mb-1">Q{i + 1}: {q.prompt}</div>
                    <div className="flex gap-2">
                      {q.options.map(opt => (
                        <span key={opt} className="text-[11px] bg-surface-page text-ink-muted py-1 px-2 rounded-lg">
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Owner Controls */}
        {isOwner && (
          <div className="mb-4">
            {isLobby && (
              <button
                onClick={handleStartSession}
                disabled={quizState.questions.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-0 py-3.5 cursor-pointer text-[14px] font-bold transition-all bg-gradient-to-br from-status-success to-status-success-dark text-white shadow-[0_4px_16px_rgba(34,197,94,0.3)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quizState.questions.length === 0
                  ? 'Add questions in Lab first'
                  : `▶ Start Session (${quizState.questions.length} Q)`}
              </button>
            )}

            {isActive && !quizState.resultsReleased && (
              <button
                onClick={handleReleaseResults}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-0 py-3.5 cursor-pointer text-[14px] font-bold bg-gradient-to-br from-vybe-yellow to-vybe-yellow-dark text-ink shadow-glow-yellow active:scale-[0.97]"
              >
                🔓 Release Results
              </button>
            )}

            {isActive && quizState.resultsReleased && (
              <div className="py-3 px-4 bg-tint-green rounded-2xl border border-status-success/20 text-center">
                <span className="text-[13px] font-bold text-status-success-dark">
                  ✅ Results released — participants can view matches
                </span>
              </div>
            )}
          </div>
        )}

        {/* Non-owner waiting state */}
        {!isOwner && isLobby && (
          <div className="py-8 text-center">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <p className="text-[13px] text-ink-muted m-0">Waiting for the host to start...</p>
          </div>
        )}

        {!isOwner && isActive && (
          <button
            onClick={() => setActivePage('quiz')}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-0 py-3.5 cursor-pointer text-[14px] font-bold bg-gradient-red text-white shadow-glow-red active:scale-[0.97]"
          >
            <Zap size={15} /> Go to Quiz
          </button>
        )}
      </div>
    </div>
  );
}
