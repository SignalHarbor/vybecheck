import { useAuthStore } from '../store/authStore';
import { FEATURE_FLAGS, ADMIN_USERS } from '../../shared/features';

export function useFeatures() {
  const { twitterUsername } = useAuthStore();

  const isAdmin = Boolean(twitterUsername && ADMIN_USERS.includes(twitterUsername));
  const isDev = false;

  return {
    isAdmin,
    enablePayments: FEATURE_FLAGS.enablePayments || isAdmin || isDev,
    enableAIGeneration: FEATURE_FLAGS.enableAIGeneration || isAdmin || isDev,
  };
}
