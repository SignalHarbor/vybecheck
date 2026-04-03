import { useEffect, useState } from 'react';
import type { ServerMessage } from '../shared/types';
import { useWebSocketStore } from './store/websocketStore';
import { useAuthStore } from './store/authStore';
import { useQuizStore } from './store/quizStore';
import { useUIStore } from './store/uiStore';
import { useDraftStore } from './store/draftStore';
import { LoadingScreen } from './components/LoadingScreen';
import { Header } from './components/Header';
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

function App() {
  // Zustand stores
  const { connected, setWebSocket, setConnected } = useWebSocketStore();
  const { sessionId, participantId, setSessionId, setParticipantId, setIsOwner, setQuizState, updateQuizState, setMatchState, setQuestionLimitState, clearQuestionLimitState, isOwner, reset: resetQuizStore } = useQuizStore();
  const { isSignedIn, setSignedIn, setVybesBalance, addFeatureUnlock, setTransactionHistory, revalidateSession, authToken } = useAuthStore();
  const { activePage, setActivePage, notification, error, showNotification, showError } = useUIStore();
  const { draftQuestions } = useDraftStore();

  // Revalidate auth session on app load
  useEffect(() => {
    if (authToken) {
      revalidateSession();
    }
  }, []);

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
        // Navigate to lobby (waiting room) for participants
        setActivePage(message.data.isOwner ? 'lab' : 'lobby');
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

      case 'session:results-released':
        updateQuizState((prev) => prev ? { ...prev, resultsReleased: true } : null);
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

  // Page titles
  const pageTitles: Record<typeof activePage, string> = {
    start: 'VybeCheck',
    lab: 'Lab',
    quiz: 'Quiz',
    lobby: 'Lobby',
    vybes: 'Vybes',
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

  if (!connected) {
    return (
      <div className="w-screen max-w-app h-screen mx-auto bg-gray-100 flex flex-col overflow-hidden shadow-app relative">
        <LoadingScreen message="Connecting to server..." />
      </div>
    );
  }

  // Show start page only when not signed in
  if (!isSignedIn) {
    return (
      <div className="w-screen max-w-app h-screen mx-auto bg-gray-100 flex flex-col overflow-hidden shadow-app relative">
        <StartPage />
      </div>
    );
  }

  // Signed-in users shouldn't be on 'start' — default based on auth status
  if (activePage === 'start') {
    setActivePage(authToken ? 'lab' : 'quiz');
  }

  return (
    <div className="w-screen max-w-app h-screen mx-auto bg-gray-100 flex flex-col overflow-hidden shadow-app relative pb-[env(safe-area-inset-bottom)]">
      <Header title={pageTitles[activePage]} />

      {/* Fixed toast notifications */}
      {(notification || error) && (
        <div className="absolute top-[60px] left-0 right-0 z-50 px-4 pointer-events-none">
          {notification && (
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white py-3 px-5 rounded-xl mb-2 text-center text-sm font-medium shadow-emerald animate-slide-down pointer-events-auto">
              {notification}
            </div>
          )}
          {error && (
            <div className="bg-gradient-to-br from-red-500 to-red-600 text-white py-3 px-5 rounded-xl mb-2 text-center text-sm font-medium shadow-[0_4px_16px_rgba(239,68,68,0.3)] animate-slide-down pointer-events-auto">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-[calc(80px+env(safe-area-inset-bottom))] relative min-h-0 [-webkit-overflow-scrolling:touch]">
        {activePage === 'lab' && <LabPage />}
        {activePage === 'quiz' && <QuizPage />}
        {activePage === 'lobby' && <LobbyPage />}
        {activePage === 'vybes' && <VybesPage />}
      </div>

      <BottomNav
        activePage={activePage}
        onNavigate={setActivePage}
        isOwner={isOwner}
        hasSession={Boolean(sessionId)}
        draftCount={draftQuestions.length}
        isAuthenticated={authToken !== null}
      />
    </div>
  );
}

export default App;
