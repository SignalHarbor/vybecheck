import { useAuthStore } from '../store/authStore';
import { FEATURE_FLAGS, ADMIN_USERS } from '../../shared/features';

export function useFeatures() {
  const { twitterUsername } = useAuthStore();

  const isAdmin = Boolean(twitterUsername && ADMIN_USERS.includes(twitterUsername));

  return {
    isAdmin,
    enablePayments: FEATURE_FLAGS.enablePayments || isAdmin,
    enableAIGeneration: FEATURE_FLAGS.enableAIGeneration || isAdmin,
  };
}
