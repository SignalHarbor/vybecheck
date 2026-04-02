import { create } from 'zustand';
import type { UnlockableFeature, LedgerEntry } from '../../shared/types';

const AUTH_STORAGE_KEY = 'vybecheck_auth';

interface AuthState {
  isSignedIn: boolean;
  twitterUsername: string | null;
}

const getStoredAuth = (): AuthState => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        isSignedIn: parsed.isSignedIn || false,
        twitterUsername: parsed.twitterUsername || null,
      };
    }
  } catch {
    // Ignore
  }
  return { isSignedIn: false, twitterUsername: null };
};

const saveAuth = (state: AuthState) => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
};

interface AuthStore {
  isSignedIn: boolean;
  isSigningIn: boolean;
  twitterUsername: string | null;
  featureUnlocks: UnlockableFeature[];
  vybesBalance: number;
  transactionHistory: LedgerEntry[];
  signInWithTwitter: () => void;
  signOut: () => void;
  setSignedIn: (username: string) => void;
  setVybesBalance: (balance: number) => void;
  addFeatureUnlock: (feature: UnlockableFeature) => void;
  setTransactionHistory: (transactions: LedgerEntry[]) => void;
  getQuestionLimit: () => number;
  hasUpgradedQuestionLimit: () => boolean;
  hasFeatureUnlock: (feature: UnlockableFeature) => boolean;
}

const storedAuth = getStoredAuth();

export const useAuthStore = create<AuthStore>((set, get) => ({
  isSignedIn: storedAuth.isSignedIn,
  isSigningIn: false,
  twitterUsername: storedAuth.twitterUsername,
  featureUnlocks: [],
  vybesBalance: 0,
  transactionHistory: [],

  signInWithTwitter: () => {
    set({ isSigningIn: true });
    // TODO: Implement actual Twitter OAuth flow
    // For now, simulate sign-in with a unique username
    setTimeout(() => {
      const suffix = Date.now().toString(36).slice(-4);
      const username = `@user_${suffix}`;
      const newState = {
        isSigningIn: false,
        isSignedIn: true,
        twitterUsername: username,
        featureUnlocks: [] as UnlockableFeature[],
      };
      saveAuth({ isSignedIn: true, twitterUsername: username });
      set(newState);
    }, 2000);
  },

  signOut: () => {
    saveAuth({ isSignedIn: false, twitterUsername: null });
    set({ isSignedIn: false, twitterUsername: null, featureUnlocks: [] });
  },

  setSignedIn: (username) => {
    saveAuth({ isSignedIn: true, twitterUsername: username });
    set({ isSignedIn: true, twitterUsername: username });
  },

  setVybesBalance: (balance) => {
    set({ vybesBalance: balance });
  },

  addFeatureUnlock: (feature) => {
    set((state) => ({
      featureUnlocks: state.featureUnlocks.includes(feature)
        ? state.featureUnlocks
        : [...state.featureUnlocks, feature],
    }));
  },

  setTransactionHistory: (transactions) => {
    set({ transactionHistory: transactions });
  },

  hasUpgradedQuestionLimit: () => {
    return get().featureUnlocks.includes('QUESTION_LIMIT_10');
  },

  hasFeatureUnlock: (feature) => {
    return get().featureUnlocks.includes(feature);
  },

  getQuestionLimit: () => {
    const hasUpgrade = get().hasUpgradedQuestionLimit();
    const defaultLimit = Number(import.meta.env.VITE_DEFAULT_QUESTION_LIMIT) || 3;
    const upgradedLimit = Number(import.meta.env.VITE_UPGRADED_QUESTION_LIMIT) || 10;
    return hasUpgrade ? upgradedLimit : defaultLimit;
  },
}));
