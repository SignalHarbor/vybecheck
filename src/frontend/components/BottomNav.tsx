import { Zap, DoorOpen, Sparkles, FlaskConical } from 'lucide-react';
import type { PageType } from '../store/uiStore';
import type { LucideIcon } from 'lucide-react';

interface BottomNavProps {
  activePage: PageType;
  onNavigate: (page: PageType) => void;
  isOwner: boolean;
  hasSession: boolean;
  draftCount: number;
  isAuthenticated: boolean;
}

interface NavItem {
  id: PageType;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function BottomNav({ activePage, onNavigate, isOwner, hasSession, draftCount, isAuthenticated }: BottomNavProps) {
  if (activePage === 'start') return null;

  const navItems: NavItem[] = [
    {
      id: 'lobby' as PageType,
      label: 'Lobby',
      icon: DoorOpen,
    },
    ...(isAuthenticated ? [{
      id: 'lab' as PageType,
      label: 'Lab',
      icon: FlaskConical,
      badge: draftCount > 0 ? draftCount : undefined,
    }] : []),
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
      {navItems.map(({ id, label, icon: Icon, badge }) => {
        const isActive = activePage === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-2xl bg-transparent border-none px-3 py-1 text-[10px] transition-all [-webkit-tap-highlight-color:transparent] active:scale-95 ${
              isActive ? 'font-bold text-vybe-red' : 'font-normal text-ink-muted'
            }`}
          >
            <div className={`relative rounded-xl p-1.5 ${
              isActive ? 'bg-tint-pink' : 'bg-transparent'
            }`}>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              {badge !== undefined && badge > 0 && (
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
