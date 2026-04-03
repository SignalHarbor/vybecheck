import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useUIStore } from '../store/uiStore';
import logo from '../assets/logo.png';

export function StartPage() {
  const { isSigningIn, signInWithTwitter, twitterUsername } = useAuthStore();
  const { send } = useWebSocketStore();
  const { error, notification, showError, setActivePage } = useUIStore();

  const [joinSessionId, setJoinSessionId] = useState('');

  const handleSignIn = () => {
    signInWithTwitter();
    // signInWithTwitter() redirects to Twitter — no follow-up needed here
  };

  const joinSession = () => {
    if (!joinSessionId.trim()) {
      showError('Please enter a session ID');
      return;
    }
    send({ type: 'session:join', data: { sessionId: joinSessionId, username: twitterUsername || undefined } });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 px-5 min-h-full">
      <img src={logo} alt="VybeCheck Logo" className="w-[120px] h-[120px] rounded-3xl" />
      <h1 className="text-5xl font-extrabold text-gray-800 mb-2">VybeCheck</h1>
      <p className="text-gray-500 mb-10 text-base">Your vibes on real-time debates</p>
      
      {error && (
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white py-3.5 px-5 rounded-xl mb-4 text-center font-medium shadow-[0_4px_16px_rgba(239,68,68,0.3)] animate-slide-down">
          {error}
        </div>
      )}
      {notification && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white py-3.5 px-5 rounded-xl mb-4 text-center font-medium shadow-emerald animate-slide-down">
          {notification}
        </div>
      )}

      {/* Sign in section */}
      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="w-full max-w-[320px] flex items-center justify-center gap-2 py-4 px-6 border-none rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-twitter text-white shadow-twitter active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningIn ? (
          <>
            <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin-fast" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>Sign in with Twitter</span>
          </>
        )}
      </button>
      <p className="text-gray-400 text-[13px] mt-3 max-w-[320px] text-center">
        Sign in to create quizzes and view matches
      </p>

      <div className="text-gray-400 my-2 font-medium text-sm">or join existing session</div>
      <div className="flex flex-col gap-3 w-full max-w-[320px]">
        <input
          type="text"
          placeholder="Enter Session ID"
          value={joinSessionId}
          onChange={(e) => setJoinSessionId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && joinSession()}
        />
        <button
          onClick={joinSession}
          className="py-4 px-6 border-2 border-gray-200 rounded-xl cursor-pointer text-[17px] font-semibold transition-all text-center select-none [-webkit-tap-highlight-color:transparent] touch-manipulation bg-white text-vybe-blue shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:bg-gray-50 active:scale-[0.97]"
        >
          Join Session
        </button>
      </div>
      <p className="text-gray-400 text-[13px] mt-3 max-w-[320px] text-center">
        Join as a participant to answer questions
      </p>

    </div>
  );
}
