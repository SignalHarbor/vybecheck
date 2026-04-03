import { useState } from 'react';
import { useQuizStore } from '../store/quizStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useDraftStore } from '../store/draftStore';

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
      <div className="w-full min-h-full">
        {/* Create session - only for authenticated users */}
        {isAuthenticated && (
          <div className="bg-white p-8 rounded-[20px] text-center shadow-card mb-5">
            <div className="text-5xl mb-4">📡</div>
            <h2 className="m-0 mb-2 text-2xl font-bold text-gray-800">No Active Session</h2>
            <p className="text-gray-500 text-sm mb-6">
              Create a new session to start a quiz, or join an existing one.
            </p>
            <button
              onClick={handleCreateSession}
              disabled={isCreating}
              className="w-full mb-3 py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-gradient-to-br from-vybe-blue to-vybe-purple text-white shadow-primary active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : draftQuestions.length > 0
                ? `Create Session (${draftQuestions.length} draft${draftQuestions.length !== 1 ? 's' : ''} will publish)`
                : 'Create New Session'
              }
            </button>
            {draftQuestions.length > 0 && (
              <p className="text-vybe-blue text-xs mb-4">
                Your {draftQuestions.length} draft question{draftQuestions.length !== 1 ? 's' : ''} will be published automatically
              </p>
            )}
          </div>
        )}

        <div className="bg-white p-6 rounded-[20px] shadow-card">
          <h3 className="m-0 mb-4 text-base font-semibold text-gray-800">Join Existing Session</h3>
          <input
            type="text"
            placeholder="Enter Session ID"
            value={joinSessionId}
            onChange={(e) => setJoinSessionId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
            className="mb-3"
          />
          <button
            onClick={handleJoinSession}
            className="w-full py-4 px-6 border-2 border-gray-200 rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-white text-vybe-blue shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:bg-gray-50 active:scale-[0.97]"
          >
            Join Session
          </button>
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
    <div className="w-full min-h-full">
      {/* Session ID Card */}
      <div className="bg-gradient-to-br from-vybe-blue to-vybe-purple p-5 rounded-[20px] mb-4 text-white">
        <div className="text-xs opacity-80 mb-1">Session ID</div>
        <div className="text-2xl font-bold font-mono tracking-wider">{sessionId}</div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`w-2 h-2 rounded-full ${isLobby ? 'bg-amber-300' : 'bg-emerald-300'}`} />
          <span className="text-xs opacity-90">
            {isLobby ? 'Waiting in Lobby' : isActive ? 'Session In Progress' : quizState.status}
          </span>
        </div>
      </div>

      {/* Participant List */}
      <div className="bg-white p-5 rounded-[20px] mb-4 shadow-card">
        <h3 className="m-0 mb-3 text-base font-bold text-gray-800">
          Participants ({quizState.participantCount})
        </h3>
        <div className="flex flex-col gap-1">
          {(isOwner && isActive && quizState.participantProgress
            ? quizState.participantProgress.map(p => (
                <div key={p.participantId} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {p.username || p.participantId.slice(0, 8)}
                      </span>
                      {p.isOwner && <span className="text-xs" title="Owner">👑</span>}
                      {p.participantId === participantId && (
                        <span className="text-[10px] font-bold text-vybe-blue bg-vybe-blue/10 py-0.5 px-1.5 rounded">YOU</span>
                      )}
                      {!p.isActive && <span className="text-xs text-gray-400">(offline)</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            p.completionPercent === 100
                              ? 'bg-emerald-500'
                              : p.completionPercent > 0
                                ? 'bg-vybe-blue'
                                : 'bg-gray-200'
                          }`}
                          style={{ width: `${p.completionPercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 w-8 text-right">
                        {p.completionPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            : quizState.participants.map(p => (
                <div key={p.id} className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-b-0">
                  <span className="text-sm font-medium text-gray-800">
                    {p.username || p.id.slice(0, 8)}
                  </span>
                  {p.isOwner && <span className="text-xs" title="Owner">👑</span>}
                  {p.id === participantId && (
                    <span className="text-[10px] font-bold text-vybe-blue bg-vybe-blue/10 py-0.5 px-1.5 rounded">YOU</span>
                  )}
                  {!p.isActive && <span className="text-xs text-gray-400">(offline)</span>}
                </div>
              ))
          )}
        </div>
      </div>

      {/* Published Questions Review (owner only) */}
      {isOwner && quizState.questions.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowQuestions(!showQuestions)}
            className="w-full py-3 px-4 bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer text-left flex justify-between items-center"
          >
            <span className="text-sm font-semibold text-gray-800">
              📋 Published Questions ({quizState.questions.length})
            </span>
            <span className="text-gray-400">{showQuestions ? '▲' : '▼'}</span>
          </button>
          {showQuestions && (
            <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {quizState.questions.map((q, i) => (
                <div key={q.id} className="py-3 px-4 border-b border-gray-100 last:border-b-0">
                  <div className="text-sm font-semibold text-gray-800 mb-1">Q{i + 1}: {q.prompt}</div>
                  <div className="flex gap-2">
                    {q.options.map(opt => (
                      <span key={opt} className="text-xs bg-gray-100 text-gray-600 py-1 px-2 rounded">
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
        <div className="mt-2">
          {isLobby && (
            <button
              onClick={handleStartSession}
              disabled={quizState.questions.length === 0}
              className="w-full py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {quizState.questions.length === 0
                ? 'Add questions in Lab first'
                : `▶ Start Session (${quizState.questions.length} question${quizState.questions.length !== 1 ? 's' : ''})`
              }
            </button>
          )}

          {isActive && !quizState.resultsReleased && (
            <button
              onClick={handleReleaseResults}
              className="w-full py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_4px_16px_rgba(245,158,11,0.3)] active:scale-[0.97]"
            >
              🔓 Release Results to Participants
            </button>
          )}

          {isActive && quizState.resultsReleased && (
            <div className="py-3 px-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <span className="text-sm font-semibold text-emerald-700">
                ✅ Results released — participants can now view matches
              </span>
            </div>
          )}
        </div>
      )}

      {/* Guest sign-in prompt */}
      {!isAuthenticated && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-[20px] p-5 mb-4 flex flex-col items-center text-center gap-3">
          <p className="text-sm font-semibold text-amber-800 m-0">Sign in to participate in the quiz and get matched with others!</p>
          <button
            onClick={() => signInWithTwitter()}
            className="flex items-center justify-center gap-2 py-3 px-6 border-none rounded-xl cursor-pointer text-[15px] font-semibold bg-twitter text-white shadow-twitter active:scale-[0.97]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Sign in with Twitter
          </button>
        </div>
      )}

      {/* Non-owner waiting states */}
      {!isOwner && isLobby && (
        <div className="py-8 text-center">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <p className="text-gray-500 text-sm m-0">Waiting for the host to start the session...</p>
        </div>
      )}

      {!isOwner && isActive && (
        <div className="mt-2">
          <button
            onClick={() => setActivePage('quiz')}
            className="w-full py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-gradient-to-br from-vybe-blue to-vybe-purple text-white shadow-primary active:scale-[0.97]"
          >
            🎯 Go to Quiz
          </button>
        </div>
      )}
    </div>
  );
}
