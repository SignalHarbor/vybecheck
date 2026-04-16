import { type ReactNode } from 'react';
import { Sparkles, Moon, Sun, Radio, Clock, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useQuizStore } from '../store/quizStore';
import { useUIStore } from '../store/uiStore';
import logo from '../assets/logo.png';

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Lucide icon or element rendered in a rounded box at top-right */
  actionIcon?: ReactNode;
  /** Colour class for the action icon wrapper border/bg (e.g. 'vybe-blue') */
  actionColor?: 'blue' | 'yellow' | 'muted';
  /** Pills rendered below the title row */
  pills?: ReactNode;
}

const actionStyles = {
  blue:   'border-vybe-blue/25 bg-vybe-blue/20 text-vybe-blue',
  yellow: 'border-vybe-yellow/25 bg-vybe-yellow/15 text-vybe-yellow',
  muted:  'border-ink-muted/25 bg-ink-muted/20 text-ink-muted',
} as const;

export function Header({ title, subtitle, actionIcon, actionColor = 'blue', pills }: HeaderProps) {
  const { profileImageUrl, authToken, signOut, vybesBalance } = useAuthStore();
  const { reset: resetQuizStore, sessionId, quizState } = useQuizStore();
  const { setActivePage, isDarkMode, toggleDarkMode } = useUIStore();
  const isAuthenticated = authToken !== null;

  const handleSignOut = () => {
    signOut();
    resetQuizStore();
    setActivePage('start');
    window.location.href = '/';
  };

  return (
    <header className="shrink-0 rounded-b-[28px] bg-gradient-header pb-5 mb-6">
      {/* Safe-area spacer */}
      <div className="pt-14 pb-2 px-6" />

      <div className="flex items-start justify-between px-5 pt-1">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="VybeCheck" className="h-7.5 w-7.5 shrink-0 object-contain" />
          <div>
            {subtitle && (
              <p className="mb-0.5 text-[12px] tracking-[0.4px] text-white/45">{subtitle}</p>
            )}
            <h1 className="text-[26px] leading-[1.1] font-black text-white">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Session status chip — shown when there's an active session */}
          {sessionId && quizState && (
            <div className={`mt-1 flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              quizState.status === 'active'
                ? 'border-vybe-red/30 bg-vybe-red/15'
                : quizState.status === 'expired'
                  ? 'border-ink-muted/25 bg-ink-muted/15'
                  : 'border-vybe-yellow/30 bg-vybe-yellow/15'
            }`}>
              {quizState.status === 'active' && (
                <>
                  <Radio size={9} className="text-vybe-red animate-pulse" />
                  <span className="text-[10px] font-bold text-vybe-red">Live</span>
                </>
              )}
              {quizState.status === 'live' && (
                <>
                  <Clock size={9} className="text-vybe-yellow" />
                  <span className="text-[10px] font-bold text-vybe-yellow">In Lobby</span>
                </>
              )}
              {quizState.status === 'expired' && (
                <>
                  <CheckCircle size={9} className="text-ink-muted" />
                  <span className="text-[10px] font-bold text-ink-muted">Ended</span>
                </>
              )}
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="mt-1 flex h-7.5 w-7.5 items-center justify-center rounded-xl border border-white/15 bg-white/10 cursor-pointer"
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode
              ? <Sun size={13} className="text-vybe-yellow" />
              : <Moon size={13} className="text-white/60" />}
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setActivePage('vybes')}
              className="mt-1 flex items-center gap-1 rounded-full border border-vybe-yellow/30 bg-vybe-yellow/15 px-2.5 py-1 cursor-pointer border-none"
              title="Your Vybes balance"
            >
              <Sparkles size={11} className="fill-vybe-yellow text-vybe-yellow" />
              <span className="text-[11px] font-bold text-vybe-yellow">{vybesBalance}</span>
            </button>
          )}
          {actionIcon && (
            <div className={`mt-1 flex h-10.5 w-10.5 items-center justify-center rounded-2xl border ${actionStyles[actionColor]}`}>
              {actionIcon}
            </div>
          )}
          {isAuthenticated && profileImageUrl && (
            <button
              onClick={handleSignOut}
              className="mt-1 shrink-0 cursor-pointer border-0 bg-transparent p-0"
              title="Sign Out"
            >
              <img src={profileImageUrl} alt="" className="h-8.5 w-8.5 rounded-xl border-2 border-white/20 object-cover" />
            </button>
          )}
        </div>
      </div>

      {pills && (
        <div className="mt-3 flex items-center gap-2 px-5">
          {pills}
        </div>
      )}
    </header>
  );
}
