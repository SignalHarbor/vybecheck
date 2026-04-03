import { useAuthStore } from '../store/authStore';
import { useQuizStore } from '../store/quizStore';
import { useUIStore } from '../store/uiStore';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { twitterUsername, profileImageUrl, authToken, signOut } = useAuthStore();
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
    <header className="bg-gradient-to-br from-vybe-blue to-vybe-purple pt-[60px] pb-4 px-5 flex-shrink-0 shadow-[0_2px_20px_rgba(83,157,192,0.3)]">
      <div className="flex items-center justify-between">
        <h1 className="m-0 text-white text-[32px] font-bold tracking-tight">{title}</h1>
        {isAuthenticated && (
          <div className="flex items-center gap-2">
            {profileImageUrl && (
              <img src={profileImageUrl} alt="" className="w-8 h-8 rounded-full border-2 border-white/30" />
            )}
            <button
              onClick={handleSignOut}
              className="bg-white/15 hover:bg-white/25 text-white text-xs font-semibold py-1.5 px-3 rounded-lg border-none cursor-pointer transition-all active:scale-95"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
      {subtitle && (
        <div className="flex flex-wrap gap-2 items-center text-[13px] text-white/95 mt-2">
          <span className="bg-white/20 py-1.5 px-3 rounded-xl backdrop-blur-sm font-medium">{subtitle}</span>
        </div>
      )}
    </header>
  );
}
