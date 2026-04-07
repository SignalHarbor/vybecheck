import { useAuthStore } from '../store/authStore';
import { FEATURE_FLAGS, ADMIN_USERS } from '../../shared/features';

export function useFeatures() {
  const { twitterUsername } = useAuthStore();

  const isAdmin = Boolean(twitterUsername && ADMIN_USERS.includes(twitterUsername));
  // In Vite, import.meta.env.DEV is true in development mode
  // const isDev = import.meta.env.DEV;
  const isDev = false

  return {
    isAdmin,
    enablePayments: FEATURE_FLAGS.enablePayments || isAdmin || isDev,
    enableAIGeneration: FEATURE_FLAGS.enableAIGeneration || isAdmin || isDev,
  };
}
