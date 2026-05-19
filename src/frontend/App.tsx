import { useEffect, useState, useRef, useCallback } from 'react';
import type { ServerMessage } from '../shared/types';
import { useWebSocketStore } from './store/websocketStore';
import { useAuthStore } from './store/authStore';
import { useQuizStore } from './store/quizStore';
import { useUIStore } from './store/uiStore';
import { useDraftStore } from './store/draftStore';
import { LoadingScreen } from './components/LoadingScreen';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StartPage } from './pages/StartPage';
import { LabPage } from './pages/LabPage';
import { QuizPage } from './pages/QuizPage';
import { LobbyPage } from './pages/LobbyPage';
import { VybesPage } from './pages/VybesPage';
import { PurchaseSuccess } from './pages/PurchaseSuccess';
import { PurchaseCancel } from './pages/PurchaseCancel';
import { PurchaseError } from './pages/PurchaseError';
import { AuthCallback } from './pages/AuthCallback';
import OnboardingPage, { isOnboardingComplete, markOnboardingComplete } from './pages/OnboardingPage';
import { analytics } from './utils/analytics';

function App() {
  // Zustand stores
  const { connected, setWebSocket, setConnected } = useWebSocketStore();
  const { sessionId, participantId, setSessionId, setParticipantId, setIsOwner, setQuizState, updateQuizState, setMatchState, setQuestionLimitState, clearQuestionLimitState, isOwner, quizState, reset: resetQuizStore } = useQuizStore();
  const { isSignedIn, setSignedIn, setVybesBalance, addFeatureUnlock, setTransactionHistory, revalidateSession, authToken } = useAuthStore();
  const { activePage, setActivePage, notification, error, info, showNotification, showError, showInfo, clearNotification, clearError, clearInfo, newQuestionCount, incrementNewQuestionCount, clearNewQuestionCount } = useUIStore();
  const { draftQuestions } = useDraftStore();

  // Track page views whenever the active tab changes
  useEffect(() => {
    analytics.capture('$pageview', { page: activePage });
    // Clear new-question badge when participant visits the quiz page
    if (activePage === 'quiz') clearNewQuestionCount();
  }, [activePage]);

  // Scroll position memory — restore per-tab scroll on tab switch
  const scrollRefs = useRef<Partial<Record<string, number>>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollContainerRef.current?.querySelector('[data-scroll-container]') as HTMLElement | null;
    if (el) {
      el.scrollTop = scrollRefs.current[activePage] ?? 0;
    }
  }, [activePage]);
  const handleScrollSave = (page: string, top: number) => {
    scrollRefs.current[page] = top;
  };

  // Tab slide direction — tracks nav order to slide left/right
  const PAGE_ORDER: Record<string, number> = { lobby: 0, lab: 1, quiz: 2, vybes: 3 };
  const prevPageRef = useRef(activePage);
  const slideDir = useRef<'right' | 'left'>('right');
  if (prevPageRef.current !== activePage) {
    slideDir.current = (PAGE_ORDER[activePage] ?? 0) >= (PAGE_ORDER[prevPageRef.current] ?? 0) ? 'right' : 'left';
    prevPageRef.current = activePage;
  }

  // Connection timeout — escalating messages
  const [connectMessage, setConnectMessage] = useState('Connecting to server...');
  useEffect(() => {
    if (connected) { setConnectMessage('Connecting to server...'); return; }
    const t1 = setTimeout(() => setConnectMessage('Taking a little longer than usual…'), 8000);
    const t2 = setTimeout(() => setConnectMessage('Having trouble connecting. Try refreshing.'), 22000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [connected]);

  // Onboarding — shown once per user on first sign-in.
  // Persistence lives in localStorage under a versioned key (see OnboardingPage).
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (isSignedIn && !isOnboardingComplete()) {
      setShowOnboarding(true);
    }
  }, [isSignedIn]);
  const completeOnboarding = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
  };

  // Revalidate auth session on app load
  useEffect(() => {
    if (authToken) {
      revalidateSession();
    }
  }, []);



  // Signed-in users shouldn't be on 'start' — default to Lobby
  useEffect(() => {
    if (isSignedIn && activePage === 'start') {
      setActivePage(authToken ? 'lab' : 'lobby');
    }
  }, [isSignedIn, activePage, authToken, setActivePage]);

  // WebSocket setup (skip on transient pages that redirect away immediately)
  const isTransientPage = ['/auth/callback', '/purchase/success', '/purchase/cancel', '/purchase/error']
    .includes(window.location.pathname);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000); // starts at 1 s, doubles up to 30 s
  const destroyedRef = useRef(false);     // set on unmount to stop further retries
  const [hasEverConnected, setHasEverConnected] = useState(false);

  useEffect(() => {
    if (isTransientPage) return;

    // Reset so a StrictMode re-mount can reconnect
    destroyedRef.current = false;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.DEV
      ? `${wsProtocol}//${window.location.host}/ws`
      : `${wsProtocol}//${window.location.host}`;

    const connect = () => {
      if (destroyedRef.current) return;

      // In production, WS is on the same host. In dev, route through Vite's /ws proxy
      // (direct ws://localhost:3000 doesn't work in all browser contexts)
      const websocket = new WebSocket(wsUrl);
      wsRef.current = websocket;

      websocket.addEventListener('open', () => {
        if (destroyedRef.current) { websocket.close(); return; }
        console.log('[WS] Connected');
        reconnectDelayRef.current = 1000; // reset backoff on successful connection
        setConnected(true);
        setHasEverConnected(true);
        setWebSocket(websocket);

        // Rejoin existing session if we have stored state
        const storedSessionId = useQuizStore.getState().sessionId;
        const storedParticipantId = useQuizStore.getState().participantId;
        if (storedSessionId && storedParticipantId) {
          console.log('[WS] Rejoining session:', storedSessionId);
          websocket.send(JSON.stringify({
            type: 'session:reconnect',
            data: { sessionId: storedSessionId, participantId: storedParticipantId },
          }));
        }
      });

      websocket.addEventListener('message', (event) => {
        const message: ServerMessage = JSON.parse(event.data);
        // Always use the ref so the handler reads the latest store values,
        // avoiding the stale-closure bug from the empty-dep useEffect.
        handleServerMessageRef.current(message);
      });

      websocket.addEventListener('close', () => {
        if (destroyedRef.current) return;
        console.log('[WS] Disconnected — retrying in', reconnectDelayRef.current, 'ms');
        setConnected(false);
        // Schedule next attempt with exponential backoff (cap at 30 s)
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30_000);
          connect();
        }, reconnectDelayRef.current);
      });

      websocket.addEventListener('error', (error) => {
        console.error('[WS] Error:', error);
        // close event always fires after error, so the retry is handled there
      });
    };

    connect();

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  // Kept as useCallback so the function identity is stable across renders;
  // the ref below ensures the WebSocket listener always calls the latest version.
  const handleServerMessage = useCallback((message: ServerMessage) => {
    console.log('Received:', message);

    switch (message.type) {
      case 'session:created':
        setSessionId(message.data.sessionId);
        setParticipantId(message.data.participantId);
        setIsOwner(true);
        setVybesBalance(message.data.vybesBalance);
        setActivePage('lab');
        analytics.capture('session_created', { session_id: message.data.sessionId });
        analytics.group('session', message.data.sessionId, { session_id: message.data.sessionId, is_owner: true });
        break;

      case 'session:joined':
        setSessionId(message.data.sessionId);
        setParticipantId(message.data.participantId);
        setIsOwner(message.data.isOwner);
        setVybesBalance(message.data.vybesBalance);
        // Mark as signed in (as guest participant if not already signed in)
        if (!isSignedIn) {
          setSignedIn(`guest_${message.data.participantId.slice(0, 6)}`);
        }
        // Owner → Lab to build questions; participant → Quiz to answer
        setActivePage(message.data.isOwner ? 'lab' : 'quiz');
        analytics.capture('session_joined', { session_id: message.data.sessionId, is_owner: message.data.isOwner });
        analytics.group('session', message.data.sessionId, { session_id: message.data.sessionId, is_owner: message.data.isOwner });
        break;

      case 'session:reconnected': {
        console.log('[Reconnect] Successfully rejoined session:', message.data.sessionId);
        setSessionId(message.data.sessionId);
        setParticipantId(message.data.participantId);
        setIsOwner(message.data.isOwner);
        setVybesBalance(message.data.vybesBalance);
        // Route unconditionally using the server-supplied sessionStatus so that
        // a page refresh (where quizState is null until quiz:state arrives) still
        // lands the user on the right page immediately.
        if (message.data.sessionStatus === 'expired') {
          setActivePage('quiz'); // show results / match screen
        } else if (message.data.isOwner) {
          setActivePage('lobby');
        } else {
          setActivePage('quiz');
        }
        break;
      }

      case 'session:started':
        updateQuizState((prev) => prev ? { ...prev, status: 'active' } : null);
        // Read isOwner from the store directly to avoid stale closure.
        if (useQuizStore.getState().isOwner) {
          showNotification('Session started!');
          setActivePage('lobby'); // Owner monitors progress from lobby
        } else {
          showNotification('Session started! Answer the questions now.');
          setActivePage('quiz');
        }
        break;

      case 'session:terminated':
        resetQuizStore();
        setActivePage('lobby');
        showError('Session has been terminated');
        break;

      case 'session:results-released':
        updateQuizState((prev) => prev ? { ...prev, resultsReleased: true, status: 'expired' } : null);
        showNotification('Results are now available!');
        analytics.capture('session_results_released', { session_id: useQuizStore.getState().sessionId });
        // Automatically fetch PREVIEW matches so participants land on results
        // with data ready — no manual action required.
        useWebSocketStore.getState().send({ type: 'matches:get', data: { tier: 'PREVIEW' } });
        setActivePage('quiz');
        break;

      case 'quiz:state':
        setQuizState(message.data);
        break;

      case 'question:added':
        updateQuizState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            questions: [...prev.questions, message.data.question],
            myResponses: [...prev.myResponses, ""]
          };
        });
        clearQuestionLimitState(); // Clear any limit warning since question was added
        if (!isOwner && useUIStore.getState().activePage !== 'quiz') {
          incrementNewQuestionCount();
        }
        break;

      case 'question:limit-reached':
        setQuestionLimitState({
          isAtLimit: true,
          current: message.data.current,
          max: message.data.max,
          upgradeCost: message.data.upgradeCost,
        });
        showError(`Question limit reached (${message.data.current}/${message.data.max}). Upgrade for ${message.data.upgradeCost} Vybes!`);
        break;

      case 'question:limit-unlocked':
        clearQuestionLimitState();
        setVybesBalance(message.data.vybesBalance);
        addFeatureUnlock('QUESTION_LIMIT_10');
        showNotification(`Question limit upgraded to ${message.data.newLimit}!`);
        break;

      case 'participant:joined': {
        const joiningParticipant = message.data;
        updateQuizState((prev) => {
          if (!prev) return null;
          const exists = prev.participants.some(p => p.id === joiningParticipant.id);
          // Upsert: update the existing entry if the participant is reconnecting,
          // otherwise append. This prevents ghost duplicates in the list.
          const updatedParticipants = exists
            ? prev.participants.map(p => p.id === joiningParticipant.id ? joiningParticipant : p)
            : [...prev.participants, joiningParticipant];
          return {
            ...prev,
            participants: updatedParticipants,
            participantCount: exists ? prev.participantCount : prev.participantCount + 1,
            activeParticipantCount: exists
              ? prev.activeParticipantCount + (joiningParticipant.isActive ? 1 : 0)
              : prev.activeParticipantCount + 1,
          };
        });
        // Only announce the join notification for genuinely new participants,
        // not for reconnects (which already existed in the list).
        const alreadyKnown = useQuizStore.getState().quizState?.participants.some(
          p => p.id === joiningParticipant.id
        );
        if (!alreadyKnown) {
          showNotification(`${joiningParticipant.username || 'New participant'} joined!`);
        }
        break;
      }

      case 'participant:left':
        updateQuizState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            participants: prev.participants.map(p =>
              p.id === message.data.participantId ? { ...p, isActive: false } : p
            ),
            activeParticipantCount: prev.activeParticipantCount - 1
          };
        });
        break;

      case 'participant:kicked': {
        const kickedId = message.data.participantId;
        const myParticipantId = useQuizStore.getState().participantId;
        if (kickedId === myParticipantId) {
          // We were kicked — clear session state and return to start
          resetQuizStore();
          setActivePage('start');
          showError('You were removed from the session by the host.');
        } else {
          // Someone else was kicked — remove them from the participant list
          updateQuizState((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              participants: prev.participants.filter(p => p.id !== kickedId),
              participantCount: prev.participantCount - 1,
              activeParticipantCount: prev.activeParticipantCount - 1,
            };
          });
        }
        break;
      }

      case 'response:recorded':
        // Response recorded, the quiz state will be updated via quiz:state message
        break;

      case 'matches:result':
        setMatchState({
          matches: message.data.matches,
          tier: message.data.tier,
          cost: message.data.cost,
          isLoading: false,
        });
        setVybesBalance(message.data.vybesBalance);
        analytics.capture('matches_unlocked', {
          session_id: useQuizStore.getState().sessionId,
          tier: message.data.tier,
          cost: message.data.cost,
          match_count: message.data.matches.length,
          remaining_balance: message.data.vybesBalance,
        });
        break;

      case 'credits:balance':
        setVybesBalance(message.data.balance);
        break;

      case 'credits:history':
        setTransactionHistory(message.data.transactions);
        break;

      case 'credits:insufficient':
        showError(`Not enough Vybes! Need ${message.data.required}, have ${message.data.current}`);
        break;

      case 'notification':
        showNotification(message.message);
        break;

      case 'error':
        showError(message.message);
        // Do NOT auto-wipe session state on reconnect errors. If the server
        // temporarily can't find the session (e.g. Fly.io resumed a second
        // machine), the WebSocket backoff will retry and eventually reconnect
        // to the right machine. Wiping localStorage here permanently destroys
        // the participant's session data and prevents self-healing.
        break;
    }
  }, [setSessionId, setParticipantId, setIsOwner, setVybesBalance, setSignedIn, setActivePage,
      updateQuizState, setQuizState, setMatchState, setQuestionLimitState, clearQuestionLimitState,
      addFeatureUnlock, setTransactionHistory, showNotification, showError, resetQuizStore]);

  // Keep a ref to the latest handler so the WebSocket listener (captured in the
  // empty-dep useEffect) always calls the current version without stale closures.
  const handleServerMessageRef = useRef(handleServerMessage);
  useEffect(() => {
    handleServerMessageRef.current = handleServerMessage;
  }, [handleServerMessage]);

  // Check for path-based routes
  const pathname = window.location.pathname;
  if (pathname === '/auth/callback') {
    return <AuthCallback />;
  }
  if (pathname === '/purchase/success') {
    return <PurchaseSuccess />;
  }
  if (pathname === '/purchase/cancel') {
    return <PurchaseCancel />;
  }
  if (pathname === '/purchase/error') {
    return <PurchaseError />;
  }

  // Deeplink: /join/:sessionId or ?join=:sessionId — pre-fill session and land on Lobby.
  // The query-param form is what the Lobby's "Copy" button produces so the entire
  // URL can be shared (origin + ?join=...).
  const joinMatch = pathname.match(/^\/join\/([^/]+)$/);
  const queryJoin = new URLSearchParams(window.location.search).get('join');
  const deeplinkSessionId = joinMatch ? joinMatch[1] : queryJoin;

  if (!connected && !hasEverConnected) {
    return (
      <div className="w-screen max-w-app h-screen mx-auto bg-surface-page flex flex-col overflow-hidden shadow-app relative">
        <LoadingScreen message={connectMessage} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="w-screen max-w-app h-screen mx-auto bg-surface-page flex flex-col overflow-hidden shadow-app relative">
        <StartPage prefilledSessionId={deeplinkSessionId} />
        {showOnboarding && <OnboardingPage onComplete={completeOnboarding} />}
      </div>
    );
  }

  // Active session banner: show when user has a session but isn't on Lobby or Quiz
  const hasActiveSession = Boolean(sessionId) && Boolean(quizState) && quizState?.status !== 'expired';
  const onSessionPage = activePage === 'lobby' || activePage === 'quiz' || activePage === 'lab';
  const showSessionBanner = hasActiveSession && !onSessionPage;

  return (
    <div className="w-screen max-w-app h-screen mx-auto bg-surface-page flex flex-col overflow-hidden shadow-app relative font-sans transition-colors duration-300">
      {/* Fixed toast notifications — bottom of screen above nav */}
      {(notification || error || info) && (
        <div className="absolute bottom-[calc(88px+env(safe-area-inset-bottom))] left-0 right-0 z-50 px-4 pointer-events-none">
          {notification && (
            <div
              onClick={clearNotification}
              className="bg-linear-to-br from-status-success to-status-success-dark text-white py-3 px-5 rounded-2xl mb-2 text-center text-[14px] font-bold shadow-[0_4px_16px_rgba(34,197,94,0.3)] animate-slide-up pointer-events-auto cursor-pointer select-none"
              title="Tap to dismiss"
            >
              {notification}
            </div>
          )}
          {error && (
            <div
              onClick={clearError}
              className="bg-linear-to-br from-vybe-red to-vybe-red-dark text-white py-3 px-5 rounded-2xl mb-2 text-center text-[14px] font-bold shadow-glow-red animate-slide-up pointer-events-auto cursor-pointer select-none"
              title="Tap to dismiss"
            >
              {error}
            </div>
          )}
          {info && (
            <div
              onClick={clearInfo}
              className="bg-ink text-white py-3 px-5 rounded-2xl mb-2 text-center text-[14px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.25)] animate-slide-up pointer-events-auto cursor-pointer select-none"
              title="Tap to dismiss"
            >
              {info}
            </div>
          )}
        </div>
      )}

      {/* Page content — re-keyed on route change to trigger fade-in */}
      <ErrorBoundary>
        <div key={activePage} className={`flex-1 min-h-0 flex flex-col overflow-hidden ${slideDir.current === 'right' ? 'animate-slide-from-right' : 'animate-slide-from-left'}`} ref={scrollContainerRef}>
          {activePage === 'lab' && <LabPage />}
          {activePage === 'quiz' && <QuizPage />}
          {activePage === 'lobby' && <LobbyPage prefilledSessionId={deeplinkSessionId} />}
          {activePage === 'vybes' && <VybesPage />}
        </div>
      </ErrorBoundary>

      {/* Active session banner — in flow, sits directly above BottomNav, no overlap */}
      {showSessionBanner && (
        <div className="shrink-0 px-4 py-2 bg-surface-page border-t border-border-light z-40">
          <button
            onClick={() => setActivePage(isOwner ? 'lobby' : 'quiz')}
            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-vybe-red/20 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-vybe-red animate-pulse shrink-0" />
              <span className="text-[14px] font-bold text-ink">
                {isOwner ? '🎙 Session active — back to Lobby' : '⚡ Session active — back to Quiz'}
              </span>
            </div>
            <span className="text-[13px] font-bold text-vybe-red shrink-0">Go →</span>
          </button>
        </div>
      )}



      {/* Onboarding replay button — in flow, above BottomNav on Lobby */}
      {activePage === 'lobby' && !showOnboarding && (
        <div className="shrink-0 flex justify-end px-4 py-2 bg-surface-page">
          <button
            onClick={() => setShowOnboarding(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-light bg-white shadow-card-muted text-[13px] font-extrabold text-ink-muted cursor-pointer"
            title="How it works"
          >
            ?
          </button>
        </div>
      )}

      <BottomNav
        activePage={activePage}
        onNavigate={setActivePage}
        isOwner={isOwner}
        hasSession={Boolean(sessionId)}
        draftCount={draftQuestions.length}
        isAuthenticated={authToken !== null}
        hasActiveSession={hasActiveSession}
        participantCount={quizState?.participantCount}
        onLockedTap={showInfo}
      />

      {/* New questions side capsule — fixed to right edge of the app container */}
      {newQuestionCount > 0 && activePage !== 'quiz' && (
        <div
          key={newQuestionCount}
          className="fixed z-50 animate-slide-in-tab"
          style={{
            right: 'max(0px, calc((100vw - 430px) / 2))',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {/* Dismiss dot */}
          <button
            onClick={clearNewQuestionCount}
            className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white text-[11px] leading-none border-2 border-surface-page cursor-pointer z-10"
            title="Dismiss"
          >
            ×
          </button>

          {/* Main tap area */}
          <button
            onClick={() => { setActivePage('quiz'); clearNewQuestionCount(); }}
            className="flex flex-col items-center gap-2 rounded-l-2xl border-l border-t border-b border-vybe-yellow/40 bg-tint-yellow px-3 py-4 shadow-[-4px_0_24px_rgba(254,197,57,0.3)] cursor-pointer active:scale-95 transition-transform"
          >
            <span className="h-2 w-2 rounded-full bg-vybe-yellow animate-pulse shrink-0" />
            <span className="text-[18px] font-black text-ink leading-none">{newQuestionCount}</span>
            <span
              className="text-[10px] font-bold tracking-wide text-vybe-gold leading-none"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
            >
              NEW Q
            </span>
          </button>
        </div>
      )}

      {/* First-time onboarding overlay */}
      {showOnboarding && <OnboardingPage onComplete={completeOnboarding} />}
    </div>
  );
}

export default App;
