import type { ReactNode } from 'react';
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
  const { profileImageUrl, authToken, signOut } = useAuthStore();
  const { reset: resetQuizStore } = useQuizStore();
  const { setActivePage } = useUIStore();
  const isAuthenticated = authToken !== null;

  const handleSignOut = () => {
    signOut();
    resetQuizStore();
    setActivePage('start');
    window.location.href = '/';
  };

  return (
    <header className="shrink-0 rounded-b-[28px] bg-gradient-header pb-5">
      {/* Safe-area spacer */}
      <div className="pt-14 pb-2 px-6" />

      <div className="flex items-start justify-between px-5 pt-1">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="VybeCheck" className="h-[30px] w-[30px] shrink-0 object-contain" />
          <div>
            {subtitle && (
              <p className="mb-0.5 text-[12px] tracking-[0.4px] text-white/45">{subtitle}</p>
            )}
            <h1 className="text-[26px] leading-[1.1] font-black text-white">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actionIcon && (
            <div className={`mt-1 flex h-[42px] w-[42px] items-center justify-center rounded-2xl border ${actionStyles[actionColor]}`}>
              {actionIcon}
            </div>
          )}
          {isAuthenticated && profileImageUrl && (
            <button
              onClick={handleSignOut}
              className="mt-1 shrink-0 cursor-pointer border-0 bg-transparent p-0"
              title="Sign Out"
            >
              <img src={profileImageUrl} alt="" className="h-[34px] w-[34px] rounded-xl border-2 border-white/20 object-cover" />
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
