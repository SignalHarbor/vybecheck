import { useState, useRef } from 'react';
import { Users, ChevronRight, DoorOpen, Zap, XCircle, Copy, Check, Share2, X } from 'lucide-react';
import { useQuizStore } from '../store/quizStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useDraftStore } from '../store/draftStore';
import { Header } from '../components/Header';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { haptic } from '../utils/haptic';
import { parseJoinInput } from '../utils/parseJoinInput';


/** Sanitise and cap a raw session code input to 6 valid chars. */
const sanitiseCode = (raw: string): string =>
  raw.replace(/\s/g, '').slice(0, 6);

/** True when the value looks like a complete session code (exactly 6 non-space chars). */
const isValidCode = (v: string): boolean => v.trim().length === 6;

export function LobbyPage({ prefilledSessionId }: { prefilledSessionId?: string | null }) {
  const { sessionId, participantId, quizState, isOwner, reset: resetQuizStore } = useQuizStore();
  const { send } = useWebSocketStore();
  const { twitterUsername, authToken, signInWithTwitter } = useAuthStore();
  const isAuthenticated = authToken !== null;
  const { showError, showNotification, setActivePage } = useUIStore();
  const { draftQuestions, clearDrafts } = useDraftStore();
  const [joinSessionId, setJoinSessionId] = useState(() => sanitiseCode(prefilledSessionId || ''));
  const [joinSubmitted, setJoinSubmitted] = useState(false);
  const joinInputRef = useRef<HTMLInputElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const createTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySessionId = () => {
    if (!sessionId) return;
    // Build a shareable join URL using the current origin so it works in
    // both development (localhost) and deployed environments automatically.
    const shareUrl = `${window.location.origin}/?join=${encodeURIComponent(sessionId)}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      haptic();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Clear the create-session timeout as soon as sessionId is received
  if (sessionId && createTimeoutRef.current) {
    clearTimeout(createTimeoutRef.current);
    createTimeoutRef.current = null;
  }

  const shareSession = async () => {
    if (!sessionId) return;
    haptic();
    const shareUrl = `${window.location.origin}/join/${sessionId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my VybeCheck session!',
          text: `Join my live quiz — session code: ${sessionId}`,
          url: shareUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => showNotification('Share link copied!'));
    }
  };

  const headerPills = (
    <>
      {sessionId ? (
        <div className="flex items-center gap-1.5 rounded-full border border-vybe-yellow/25 bg-vybe-yellow/15 px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-vybe-yellow" />
          <span className="text-[11px] font-bold text-vybe-yellow">
            {quizState?.status === 'live' ? 'In lobby' : quizState?.status === 'expired' ? 'Session closed' : 'Session active'}
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

      // 2 minute safety timeout — reset if server never responds (disabled in dev)
      if (!import.meta.env.DEV) {
        if (createTimeoutRef.current) clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = setTimeout(() => {
          setIsCreating(false);
          showError('Session creation timed out. Please try again.');
        }, 120000);
      }

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
      // Accept either a raw id or a full join URL. URLs must be on the allowlist.
      const parsed = parseJoinInput(joinSessionId);
      if (!parsed.sessionId) {
        showError(parsed.error || 'Please enter a valid session ID');
        return;
      }
      send({ type: 'session:join', data: { sessionId: parsed.sessionId, username: twitterUsername || undefined } });
    };

    // If the user pastes a full join URL, auto-normalize the field to the id.
    const handleJoinInputChange = (value: string) => {
      if (/^(https?:)?\/\//i.test(value.trim()) || value.includes('?join=') || value.includes('/join/')) {
        const parsed = parseJoinInput(value);
        if (parsed.sessionId) {
          setJoinSessionId(parsed.sessionId);
          return;
        }
        if (parsed.error) {
          showError(parsed.error);
        }
      }
      setJoinSessionId(value);
      // const val = sanitiseCode(e.target.value);
      // setJoinSessionId(val);
      // setJoinSubmitted(false);
      // // auto-submit once code is complete
      // if (isValidCode(val)) {
      //   haptic();
      //   setTimeout(() => {
      //     send({ type: 'session:join', data: { sessionId: val, username: twitterUsername || undefined } });
      //     setJoinSubmitted(true);
      //   }, 120);
      // }
    };

    return (
      <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
        <Header title="Lobby" subtitle="Enter a session 🚪" pills={headerPills} />

        <div className="flex-1 overflow-y-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingBottom: '140px' }}>
          {/* Explainer */}
          <div className="mb-4 rounded-2xl bg-tint-blue border border-vybe-blue/15 px-4 py-3">
            <p className="text-[12px] text-vybe-blue font-medium leading-[1.6] m-0">
              <span className="font-extrabold">Join</span> a live Twitter Space quiz with a session code, or <span className="font-extrabold">create</span> your own session as a host.
            </p>
          </div>

          {/* Section: Join */}
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-blue" />
            <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-blue">JOIN A SESSION</p>
          </div>
          {/* Session code join */}
          <div className={`mb-4 flex items-center gap-2.5 rounded-2xl border-[1.5px] bg-white px-4 py-3 transition-colors duration-150 ${
            isValidCode(joinSessionId)
              ? 'border-status-success shadow-[0_0_0_3px_rgba(34,197,94,0.10)]'
              : 'border-vybe-blue/20'
          }`}>
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xl bg-tint-blue">
              <span className="text-[13px]">🔑</span>
            </div>
            <input
              ref={joinInputRef}
              value={joinSessionId}
              onChange={(e) => handleJoinInputChange(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = sanitiseCode(e.clipboardData.getData('text'));
                setJoinSessionId(pasted);
                setJoinSubmitted(false);
                if (isValidCode(pasted)) {
                  haptic();
                  setTimeout(() => {
                    send({ type: 'session:join', data: { sessionId: pasted, username: twitterUsername || undefined } });
                    setJoinSubmitted(true);
                  }, 120);
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
              placeholder="e.g. aB3xP7"
              maxLength={6}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 border-0 bg-transparent inline-input font-mono text-[15px] font-bold tracking-[0.15em] text-ink outline-none placeholder:font-sans placeholder:text-[12px] placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-muted"
            />
            {/* right-side action */}
            {joinSessionId.length > 0 && !isValidCode(joinSessionId) && (
              <button
                onClick={() => { setJoinSessionId(''); setJoinSubmitted(false); joinInputRef.current?.focus(); }}
                className="shrink-0 cursor-pointer rounded-full p-0.5 text-ink-muted transition-opacity hover:opacity-70"
                title="Clear"
              >
                <X size={15} />
              </button>
            )}
            {isValidCode(joinSessionId) && !joinSubmitted && (
              <button
                onClick={handleJoinSession}
                className="shrink-0 cursor-pointer rounded-xl border-0 bg-gradient-blue px-3 py-1.5 text-[12px] font-bold text-white shadow-glow-blue"
              >
                Join →
              </button>
            )}
            {isValidCode(joinSessionId) && joinSubmitted && (
              <span className="shrink-0 text-[11px] font-bold text-status-success animate-pulse">Joining…</span>
            )}
          </div>

          {/* Create session card */}
          {isAuthenticated && (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-vybe-red" />
                <p className="text-[11px] font-extrabold tracking-[0.8px] text-vybe-red">HOST A SESSION</p>
              </div>
              <div className="relative mb-5 overflow-hidden rounded-3xl border-[1.5px] border-vybe-blue/20 bg-white p-5 shadow-card-blue">
              <div className="pointer-events-none absolute -top-[30px] -right-5 h-[110px] w-[110px] rounded-full bg-[radial-gradient(circle,rgba(83,157,192,0.1)_0%,transparent_70%)]" />
              <div className="relative">
                <div className="mb-3 flex h-[46px] gs items-center justify-center rounded-2xl bg-tint-blue">
                  <DoorOpen size={22} strokeWidth={2.2} className="text-vybe-blue" />
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
                  {isCreating ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Setting up your session…
                    </>
                  ) : (
                    <>
                      <DoorOpen size={15} />
                      {draftQuestions.length > 0
                        ? `Create Session (${draftQuestions.length} draft${draftQuestions.length !== 1 ? 's' : ''})`
                        : 'Create New Session'}
                    </>
                  )}
                </button>
                {draftQuestions.length > 0 && (
                  <p className="mt-2 text-[11px] text-vybe-blue text-center">
                    Your drafts will be published automatically
                  </p>
                )}
              </div>
            </div>
            </>
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
          {isAuthenticated && <div
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
          </div>}
        </div>
      </div>
    );
  }

  const isLobby = quizState.status === 'live';
  const isActive = quizState.status === 'active';
  const isExpired = quizState.status === 'expired';

  const handleStartSession = () => {
    if (quizState.questions.length === 0) {
      showError('Add at least one question before starting');
      return;
    }
    send({ type: 'session:start' });
  };

  const handleReleaseResults = () => {
    const progress = quizState?.participantProgress ?? [];
    // All participants — including the owner — are valid respondents and count toward completion.
    // Only exclude participants who have gone offline (they may never finish).
    const activeProgress = progress.filter(p => p.isActive);
    const totalParticipants = activeProgress.length;
    const doneParticipants = activeProgress.filter(p => p.completionPercent === 100).length;

    // If not everyone is done, show a confirmation with context
    if (totalParticipants > 0 && doneParticipants < totalParticipants) {
      setShowReleaseDialog(true);
      return;
    }
    // Everyone done (or no progress data yet) — release immediately
    send({ type: 'session:release-results' });
  };

  const confirmReleaseResults = () => {
    send({ type: 'session:release-results' });
    setShowReleaseDialog(false);
  };

  // Derived completion counts for the release button UI.
  // Counts all active participants (owner included — they answer too).
  // Offline participants are excluded since they may never complete.
  const releaseProgress = (() => {
    const progress = quizState?.participantProgress ?? [];
    const active = progress.filter(p => p.isActive);
    const done = active.filter(p => p.completionPercent === 100).length;
    return { done, total: active.length };
  })();

  const handleTerminateSession = () => {
    setShowTerminateDialog(true);
  };

  const confirmTerminate = () => {
    send({ type: 'session:terminate' });
    setShowTerminateDialog(false);
  };

  // Show terminate when: session in lobby, or owner is the only participant
  const canTerminate = isOwner && !isExpired && (
    isLobby || quizState.participantCount <= 1
  );

  return (
    <div className="relative flex flex-1 min-h-0 flex-col bg-surface-page font-sans">
      <Header
        title="Lobby"
        subtitle={isLobby ? 'Waiting for start 🎯' : isExpired ? 'Session closed 🔒' : 'Session active ⚡'}
        pills={
          <>
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              isLobby
                ? 'border-vybe-yellow/25 bg-vybe-yellow/15'
                : isExpired
                ? 'border-ink-muted/30 bg-ink-muted/15'
                : 'border-status-success/30 bg-status-success/15'
            }`}>
              <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isLobby ? 'bg-vybe-yellow' : isExpired ? 'bg-ink-muted' : 'bg-status-success'}`} />
              <span className={`text-[11px] font-bold ${isLobby ? 'text-vybe-yellow' : isExpired ? 'text-ink-muted' : 'text-status-success'}`}>
                {isLobby ? 'Lobby' : isExpired ? 'Closed' : 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1">
              <Users size={10} className="text-white/55" />
              <span className="text-[11px] text-white/55">{quizState.participantCount} participants</span>
            </div>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingBottom: '140px' }}>
        {/* Session ID Card */}
        <div className="mb-4 rounded-2xl border border-border-light bg-white p-4 shadow-card-muted">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[1px] text-ink-muted">SESSION ID</p>
              <p className="mt-1 font-mono text-[15px] font-bold tracking-[0.2em] text-ink">{sessionId}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copySessionId}
                disabled={copied}
                title="Copy session ID"
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-all disabled:cursor-default ${
                  copied
                    ? 'border-status-success/30 bg-tint-green text-status-success-dark'
                    : 'border-border-light bg-surface-page text-ink-muted hover:border-vybe-blue/30 hover:text-vybe-blue'
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={shareSession}
                title="Share session"
                className="flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-page px-3 py-1.5 text-[11px] font-bold text-ink-muted cursor-pointer transition-all hover:border-vybe-red/30 hover:text-vybe-red"
              >
                <Share2 size={12} />
                Share
              </button>
              <div className="flex items-center gap-1 rounded-full bg-tint-muted px-2.5 py-1">
                <DoorOpen size={10} className="text-ink-muted" />
                <span className="text-[10px] font-bold text-ink-muted">{isLobby ? 'LOBBY' : isExpired ? 'CLOSED' : 'ACTIVE'}</span>
              </div>
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
          {(isOwner && (isActive || isExpired) && quizState.participantProgress
            ? quizState.participantProgress.map(p => {
                const name = p.username || p.participantId.slice(0, 8);
                const initials = name.slice(0, 2).toUpperCase();
                const hue = (p.participantId.charCodeAt(0) * 37 + p.participantId.charCodeAt(1) * 17) % 360;
                return (
                  <div key={p.participantId} className="flex items-center gap-3 py-3 border-b border-border-light last:border-b-0 animate-fade-in">
                    {/* Avatar */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                      style={{ background: `hsl(${hue},55%,52%)` }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-ink truncate">{name}</span>
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
                );
              })
            : quizState.participants.map(p => {
                const name = p.username || p.id.slice(0, 8);
                const initials = name.slice(0, 2).toUpperCase();
                const hue = (p.id.charCodeAt(0) * 37 + p.id.charCodeAt(1) * 17) % 360;
                return (
                  <div key={p.id} className="flex items-center gap-3 py-3 border-b border-border-light last:border-b-0 animate-fade-in">
                    {/* Avatar */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                      style={{ background: `hsl(${hue},55%,52%)` }}
                    >
                      {initials}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-ink">{name}</span>
                      {p.isOwner && <span className="text-[10px]" title="Owner">👑</span>}
                      {p.id === participantId && (
                        <span className="text-[9px] font-extrabold text-vybe-blue bg-tint-blue py-0.5 px-1.5 rounded">YOU</span>
                      )}
                      {!p.isActive && <span className="text-[10px] text-ink-muted">(offline)</span>}
                    </div>
                  </div>
                );
              })
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
            {isLobby && (() => {
              const noQuestions = quizState.questions.length === 0;
              // participantCount includes the owner, so <=1 means no one else has joined
              const aloneInSession = quizState.participantCount <= 1;
              const isDisabled = noQuestions || aloneInSession;
              return (
                <>
                  <button
                    onClick={handleStartSession}
                    disabled={isDisabled}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border-0 py-3.5 cursor-pointer text-[14px] font-bold transition-all bg-gradient-to-br from-status-success to-status-success-dark text-white shadow-[0_4px_16px_rgba(34,197,94,0.3)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {noQuestions
                      ? 'Add questions in Lab first'
                      : aloneInSession
                        ? '⏳ Waiting for others to join…'
                        : `▶ Start Quiz (${quizState.questions.length} Question${quizState.questions.length !== 1 ? 's' : ''})`}
                  </button>
                  {aloneInSession && !noQuestions && (
                    <p className="mt-2 text-center text-[11px] text-ink-muted">
                      At least 1 other participant needs to join before you can start
                    </p>
                  )}
                </>
              );
            })()}

            {isActive && !quizState.resultsReleased && (
              (() => {
                const noParticipants = releaseProgress.total === 0;
                const allDone = !noParticipants && releaseProgress.done === releaseProgress.total;

                if (noParticipants) {
                  return (
                    <div className="rounded-2xl border border-border-light bg-surface-page px-4 py-3 text-center">
                      <p className="m-0 text-[12px] text-ink-muted">No participants have joined — nothing to release results for</p>
                    </div>
                  );
                }

                return (
                  <button
                    onClick={handleReleaseResults}
                    className={`w-full flex items-center justify-center gap-2 rounded-2xl border-0 py-3.5 cursor-pointer text-[14px] font-bold active:scale-[0.97] transition-all ${
                      allDone
                        ? 'bg-gradient-to-br from-status-success to-status-success-dark text-white shadow-[0_4px_16px_rgba(34,197,94,0.3)]'
                        : 'bg-gradient-to-br from-vybe-yellow to-vybe-yellow-dark text-ink shadow-glow-yellow'
                    }`}
                  >
                    {allDone ? (
                      <>✅ Everyone&apos;s done — Release Results</>
                    ) : (
                      <>⏳ Release Results ({releaseProgress.done}/{releaseProgress.total} finished)</>
                    )}
                  </button>
                );
              })()
            )}

            {(isActive || isExpired) && quizState.resultsReleased && (
              <div className="rounded-2xl border border-status-success/20 bg-tint-green px-4 py-3">
                <p className="m-0 mb-2.5 text-center text-[13px] font-bold text-status-success-dark">
                  ✅ Results released — participants can view matches
                </p>
                <button
                  onClick={() => setActivePage('quiz')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-0 bg-status-success py-2.5 text-[13px] font-bold text-white cursor-pointer active:scale-[0.97] transition-all"
                >
                  View my matches →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Terminate session (owner only, conditional) */}
        {canTerminate && (
          <button
            onClick={handleTerminateSession}
            className="mb-4 w-full flex items-center justify-center gap-2 rounded-2xl border border-vybe-red/20 bg-white py-3 cursor-pointer text-[13px] font-bold text-vybe-red active:scale-[0.97]"
          >
            <XCircle size={15} />
            Terminate Session
          </button>
        )}

        {/* Non-owner waiting state */}
        {!isOwner && isLobby && (
          <div className="py-8 text-center">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <p className="text-[13px] text-ink-muted m-0">Waiting for the host to start...</p>
          </div>
        )}

        {!isOwner && (isActive || isExpired) && (
          <button
            onClick={() => setActivePage('quiz')}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-0 py-3.5 cursor-pointer text-[14px] font-bold bg-gradient-red text-white shadow-glow-red active:scale-[0.97]"
          >
            <Zap size={15} /> Go to Quiz
          </button>
        )}

        {/* Leave closed session */}
        {isExpired && (
          <button
            onClick={() => resetQuizStore()}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl border border-border-light bg-white py-3 cursor-pointer text-[13px] font-bold text-ink-muted active:scale-[0.97]"
          >
            Leave Session
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={showTerminateDialog}
        title="Terminate Session?"
        message="This will end the session permanently. This cannot be undone."
        onConfirm={confirmTerminate}
        onCancel={() => setShowTerminateDialog(false)}
        confirmText="Terminate"
      />
      <ConfirmDialog
        isOpen={showReleaseDialog}
        title="Release results early?"
        message={`Only ${releaseProgress.done} of ${releaseProgress.total} participants have finished answering. Releasing now means incomplete data — their matches may be inaccurate. Are you sure?`}
        onConfirm={confirmReleaseResults}
        onCancel={() => setShowReleaseDialog(false)}
        confirmText="Release anyway"
        cancelText="Wait longer"
      />
    </div>
  );
}
