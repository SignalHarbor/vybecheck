import { Zap, DoorOpen, Sparkles, FlaskConical, Lock } from 'lucide-react';
import type { PageType } from '../store/uiStore';
import type { LucideIcon } from 'lucide-react';

interface BottomNavProps {
  activePage: PageType;
  onNavigate: (page: PageType) => void;
  isOwner: boolean;
  hasSession: boolean;
  draftCount: number;
  isAuthenticated: boolean;
  hasActiveSession: boolean;
  participantCount?: number;
}

interface NavItem {
  id: PageType;
  label: string;
  icon: LucideIcon;
  badge?: number;
  locked?: boolean;
}

export function BottomNav({ activePage, onNavigate, isOwner, hasSession, draftCount, isAuthenticated, hasActiveSession, participantCount }: BottomNavProps) {
  if (activePage === 'start') return null;

  const navItems: NavItem[] = [
    {
      id: 'lobby' as PageType,
      label: 'Lobby',
      icon: DoorOpen,
      badge: hasActiveSession && participantCount && participantCount > 0 ? participantCount : undefined,
    },
    {
      id: 'lab' as PageType,
      label: 'Lab',
      icon: FlaskConical,
      badge: draftCount > 0 ? draftCount : undefined,
      locked: !isAuthenticated,
    },
    {
      id: 'quiz' as PageType,
      label: 'Quiz',
      icon: Zap,
    },
    ...(isAuthenticated ? [{
      id: 'vybes' as PageType,
      label: 'Vybes',
      icon: Sparkles,
    }] : []),
  ];

  return (
    <nav className="shrink-0 flex items-center justify-around border-t border-border-light bg-white px-2 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))] z-50">
      {navItems.map(({ id, label, icon: Icon, badge, locked }) => {
        const isActive = activePage === id;
        return (
          <button
            key={id}
            onClick={() => !locked && onNavigate(id)}
            title={locked ? 'Sign in to access' : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-2xl bg-transparent border-none px-3 py-1 text-[10px] transition-all [-webkit-tap-highlight-color:transparent] ${
              locked
                ? 'cursor-default opacity-40'
                : 'cursor-pointer active:scale-95'
            } ${
              isActive
                ? 'font-bold bg-[linear-gradient(135deg,#F14573,#C91457)] bg-clip-text text-transparent'
                : 'font-normal text-ink-muted'
            }`}
          >
            <div className={`relative rounded-xl p-1.5 ${
              isActive ? 'bg-tint-pink' : 'bg-transparent'
            }`}>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              {/* Active session pulse on Lobby icon */}
              {id === 'lobby' && hasActiveSession && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-vybe-red">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vybe-red opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-vybe-red" />
                </span>
              )}
              {locked && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink-muted/20">
                  <Lock size={7} className="text-ink-muted" />
                </span>
              )}
              {!locked && badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.75 w-3.75 items-center justify-center rounded-full bg-vybe-red text-[8px] font-extrabold text-white">
                  {badge}
                </span>
              )}
            </div>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
