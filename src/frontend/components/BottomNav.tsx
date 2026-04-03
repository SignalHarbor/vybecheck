import type { PageType } from '../store/uiStore';

interface BottomNavProps {
  activePage: PageType;
  onNavigate: (page: PageType) => void;
  isOwner: boolean;
  hasSession: boolean;
  draftCount: number;
  isAuthenticated: boolean;
}

export function BottomNav({ activePage, onNavigate, isOwner, hasSession, draftCount, isAuthenticated }: BottomNavProps) {
  if (activePage === 'start') return null;

  const navItems = [
    // Lab and Vybes only for authenticated users
    ...(isAuthenticated ? [{
      id: 'lab' as PageType,
      label: 'Lab',
      icon: '🧪',
      badge: draftCount > 0 ? draftCount : undefined,
    }] : []),
    {
      id: 'quiz' as PageType,
      label: 'Quiz',
      icon: '✓',
    },
    {
      id: 'lobby' as PageType,
      label: 'Lobby',
      icon: '👥',
    },
    ...(isAuthenticated ? [{
      id: 'vybes' as PageType,
      label: 'Vybes',
      icon: '✨',
    }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-white/95 backdrop-blur-xl border-t border-gray-200 flex justify-around py-2 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-50 shadow-nav">
      {navItems.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex-1 flex flex-col items-center gap-1 p-2 bg-transparent border-none rounded-xl cursor-pointer transition-all [-webkit-tap-highlight-color:transparent] active:scale-95"
          >
            <div className={`relative text-2xl flex items-center justify-center w-8 h-8 ${
              isActive ? 'bg-gradient-to-br from-vybe-blue to-vybe-purple rounded-xl shadow-[0_4px_12px_rgba(83,157,192,0.3)]' : ''
            }`}>
              <span>{item.icon}</span>
              {item.badge && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-br from-vybe-red to-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-[0_2px_8px_rgba(241,69,115,0.4)]">
                  {item.badge}
                </span>
              )}
            </div>
            <span className={`text-[11px] font-semibold transition-colors ${
              isActive ? 'text-vybe-blue' : 'text-gray-500'
            }`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
