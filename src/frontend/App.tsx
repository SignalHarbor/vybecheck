import { useEffect, useState, useRef } from 'react';
import type { ServerMessage } from '../shared/types';
import { useWebSocketStore } from './store/websocketStore';
import { useAuthStore } from './store/authStore';
import { useQuizStore } from './store/quizStore';
import { useUIStore } from './store/uiStore';
import { useDraftStore } from './store/draftStore';
import { LoadingScreen } from './components/LoadingScreen';
import { BottomNav } from './components/BottomNav';
import { StartPage } from './pages/StartPage';
import { LabPage } from './pages/LabPage';
import { QuizPage } from './pages/QuizPage';
import { LobbyPage } from './pages/LobbyPage';
import { VybesPage } from './pages/VybesPage';
import { PurchaseSuccess } from './pages/PurchaseSuccess';
import { PurchaseCancel } from './pages/PurchaseCancel';
import { PurchaseError } from './pages/PurchaseError';
import { AuthCallback } from './pages/AuthCallback';
import OnboardingPage, { ONBOARDING_KEY } from './pages/OnboardingPage';

function App() {
  // Zustand stores
  const { connected, setWebSocket, setConnected } = useWebSocketStore();
  const { sessionId, participantId, setSessionId, setParticipantId, setIsOwner, setQuizState, updateQuizState, setMatchState, setQuestionLimitState, clearQuestionLimitState, isOwner, quizState, reset: resetQuizStore } = useQuizStore();
  const { isSignedIn, setSignedIn, setVybesBalance, addFeatureUnlock, setTransactionHistory, revalidateSession, authToken } = useAuthStore();
  const { activePage, setActivePage, notification, error, info, showNotification, showError, showInfo, clearNotification, clearError, clearInfo } = useUIStore();
  const { draftQuestions } = useDraftStore();

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

  // Onboarding — shown once per user on first sign-in
  // TODO: BEFORE PUBLISHING — change this back to the line below so it only shows once:
  // const [showOnboarding, setShowOnboarding] = useState(false);
  // useEffect(() => {
  //   if (isSignedIn && !localStorage.getItem(ONBOARDING_KEY)) {
  //     setShowOnboarding(true);
  //   }
  // }, [isSignedIn]);
  const [showOnboarding, setShowOnboarding] = useState(true); // DEV: always show for preview
  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
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

  useEffect(() => {
    if (isTransientPage) return;

    // In production, WS is on the same host. In dev, connect directly to the backend.
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.DEV
      ? 'ws://localhost:3000'
      : `${wsProtocol}//${window.location.host}`;
    const websocket = new WebSocket(wsUrl);
    let hasConnected = false;

    websocket.addEventListener('open', () => {
      console.log('Connected to server');
      hasConnected = true;
      setConnected(true);
      setWebSocket(websocket);

      // Auto-reconnect to existing session if we have stored state
      const storedSessionId = useQuizStore.getState().sessionId;
      const storedParticipantId = useQuizStore.getState().participantId;
      if (storedSessionId && storedParticipantId) {
        console.log('[Reconnect] Attempting to rejoin session:', storedSessionId);
        websocket.send(JSON.stringify({
          type: 'session:reconnect',
          data: { sessionId: storedSessionId, participantId: storedParticipantId },
        }));
      }
    });

    websocket.addEventListener('message', (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      handleServerMessage(message);
    });

    websocket.addEventListener('close', () => {
      console.log('Disconnected from server');
      setConnected(false);
      // Only show error if we were previously connected
      if (hasConnected) {
        showError('Connection lost', 3000);
      }
    });

    websocket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      // Only show error if we were previously connected (not on initial load)
      if (hasConnected) {
        showError('Connection error', 3000);
      }
    });

    return () => {
      websocket.close();
    };
  }, []);

  const handleServerMessage = (message: ServerMessage) => {
    console.log('Received:', message);

    switch (message.type) {
      case 'session:created':
        setSessionId(message.data.sessionId);
        setParticipantId(message.data.participantId);
        setIsOwner(true);
        setVybesBalance(message.data.vybesBalance);
        setActivePage('lab'); // Navigate to lab page for owner
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
        break;

      case 'session:reconnected':
        console.log('[Reconnect] Successfully rejoined session:', message.data.sessionId);
        setSessionId(message.data.sessionId);
        setParticipantId(message.data.participantId);
        setIsOwner(message.data.isOwner);
        setVybesBalance(message.data.vybesBalance);
        break;

      case 'session:started':
        updateQuizState((prev) => prev ? { ...prev, status: 'active' } : null);
        if (isOwner) {
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
        showNotification('Session has been terminated');
        break;

      case 'session:results-released':
        updateQuizState((prev) => prev ? { ...prev, resultsReleased: true, status: 'expired' } : null);
        showNotification('Results are now available!');
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
        showNotification('New question added!');
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

      case 'participant:joined':
        updateQuizState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            participants: [...prev.participants, message.data],
            participantCount: prev.participantCount + 1,
            activeParticipantCount: prev.activeParticipantCount + 1
          };
        });
        showNotification(`${message.data.username || 'New participant'} joined!`);
        break;

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
        // If reconnect failed, clear stale session state
        if (message.message.includes('not found')) {
          console.log('[Reconnect] Session/participant not found, clearing stored state');
          resetQuizStore();
        }
        showError(message.message);
        break;
    }
  };

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

  if (!connected) {
    return (
      <div className="w-screen max-w-app h-screen mx-auto bg-surface-page flex flex-col overflow-hidden shadow-app relative">
        <LoadingScreen message={connectMessage} />
      </div>
    );
  }

  // Show start page only when not signed in
  if (!isSignedIn) {
    return (
      <div className="w-screen max-w-app h-screen mx-auto bg-surface-page flex flex-col overflow-hidden shadow-app relative">
        <StartPage prefilledSessionId={deeplinkSessionId} />
        {/* DEV: show onboarding even on start page for preview */}
        {showOnboarding && <OnboardingPage onComplete={completeOnboarding} />}
      </div>
    );
  }


  // Signed-in users shouldn't be on 'start' — default to Lobby
  if (activePage === 'start') {
    setActivePage('lobby');
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
      <div key={activePage} className={`flex-1 min-h-0 flex flex-col overflow-hidden ${slideDir.current === 'right' ? 'animate-slide-from-right' : 'animate-slide-from-left'}`} ref={scrollContainerRef}>
        {activePage === 'lab' && <LabPage />}
        {activePage === 'quiz' && <QuizPage />}
        {activePage === 'lobby' && <LobbyPage prefilledSessionId={deeplinkSessionId} />}
        {activePage === 'vybes' && <VybesPage />}
      </div>

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

      {/* First-time onboarding overlay */}
      {showOnboarding && <OnboardingPage onComplete={completeOnboarding} />}
    </div>
  );
}

export default App;
