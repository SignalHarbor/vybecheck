import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useWebSocketStore } from '../store/websocketStore';
import { useUIStore } from '../store/uiStore';
import logo from '../assets/logo.png';

export function StartPage({ prefilledSessionId }: { prefilledSessionId?: string | null }) {
  const { isSigningIn, signInWithTwitter, twitterUsername } = useAuthStore();
  const { send } = useWebSocketStore();
  const { error, notification, showError } = useUIStore();

  const [joinSessionId, setJoinSessionId] = useState(prefilledSessionId || '');

  const handleSignIn = () => {
    signInWithTwitter();
  };

  const joinSession = () => {
    if (!joinSessionId.trim()) {
      showError('Please enter a session ID');
      return;
    }
    send({ type: 'session:join', data: { sessionId: joinSessionId, username: twitterUsername || undefined } });
  };

  return (
    <div className="flex h-full flex-col bg-gradient-header font-sans">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <img src={logo} alt="VybeCheck Logo" className="w-[90px] h-[90px] rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.3)]" />
        <h1 className="text-[38px] font-black text-white mb-0">VybeCheck</h1>
        <p className="text-white/50 text-[14px] -mt-1 mb-2">Live quiz matching for Twitter Spaces</p>

        {error && (
          <div className="w-full max-w-[320px] bg-gradient-to-br from-vybe-red to-vybe-red-dark text-white py-3 px-5 rounded-2xl mb-2 text-center text-[14px] font-bold shadow-glow-red animate-slide-down">
            {error}
          </div>
        )}
        {notification && (
          <div className="w-full max-w-[320px] bg-gradient-to-br from-status-success to-status-success-dark text-white py-3 px-5 rounded-2xl mb-2 text-center text-[14px] font-bold shadow-[0_4px_16px_rgba(34,197,94,0.3)] animate-slide-down">
            {notification}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full max-w-[320px] flex items-center justify-center gap-2 py-3.5 px-6 border-none rounded-2xl cursor-pointer text-[15px] font-extrabold transition-all bg-white text-ink shadow-[0_8px_28px_rgba(0,0,0,0.2)] active:scale-[0.97] disabled:opacity-50"
        >
          {isSigningIn ? (
            <>
              <div className="w-5 h-5 border-[3px] border-ink-muted/30 border-t-ink rounded-full animate-spin-fast" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>Sign in with Twitter</span>
            </>
          )}
        </button>
        <p className="text-white/35 text-[13px] max-w-[320px] text-center -mt-1 mb-2">
          Host a session, build quizzes &amp; see your matches
        </p>

        <div className="flex items-center gap-3 w-full max-w-[320px] my-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-[11px] font-bold">OR JOIN AS PARTICIPANT</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex w-full max-w-[320px] items-center gap-2.5 rounded-2xl border-[1.5px] border-white/10 bg-white/5 px-4 py-3">
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg bg-white/10">
            <span className="text-[12px]">🔑</span>
          </div>
          <input
            type="text"
            placeholder="Enter Session ID"
            value={joinSessionId}
            onChange={(e) => setJoinSessionId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinSession()}
            className="flex-1 border-0 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
          />
          {joinSessionId.length > 0 && (
            <button
              onClick={joinSession}
              className="shrink-0 cursor-pointer rounded-xl border-0 bg-gradient-blue px-3.5 py-1.5 text-[13px] font-bold text-white"
            >
              Join →
            </button>
          )}
        </div>
        <p className="text-white/30 text-[11px] max-w-[320px] text-center">
          Answer questions — no account needed
        </p>
      </div>

      <div className="shrink-0 flex items-center justify-center gap-1.5 pb-10 pt-4">
        <Sparkles size={12} className="text-vybe-yellow/50" />
        <span className="text-[11px] text-white/25">Powered by VybeCheck</span>
      </div>
    </div>
  );
}
