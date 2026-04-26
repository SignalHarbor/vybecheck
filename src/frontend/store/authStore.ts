import { create } from 'zustand';
import type { UnlockableFeature, LedgerEntry } from '../../shared/types';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../utils/pkce';
import { analytics } from '../utils/analytics';

const AUTH_STORAGE_KEY = 'vybecheck_auth';
const PKCE_STORAGE_KEY = 'vybecheck_pkce';

interface StoredAuthState {
  isSignedIn: boolean;
  twitterUsername: string | null;
  twitterId: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  authToken: string | null;
}

const getStoredAuth = (): StoredAuthState => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        isSignedIn: parsed.isSignedIn || false,
        twitterUsername: parsed.twitterUsername || null,
        twitterId: parsed.twitterId || null,
        displayName: parsed.displayName || null,
        profileImageUrl: parsed.profileImageUrl || null,
        authToken: parsed.authToken || null,
      };
    }
  } catch {
    // Ignore
  }
  return { isSignedIn: false, twitterUsername: null, twitterId: null, displayName: null, profileImageUrl: null, authToken: null };
};

const saveAuth = (state: StoredAuthState) => {
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
  twitterId: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  authToken: string | null;
  featureUnlocks: UnlockableFeature[];
  vybesBalance: number;
  transactionHistory: LedgerEntry[];
  signInWithTwitter: () => void;
  signOut: () => void;
  setSignedIn: (username: string) => void;
  setAuthFromCallback: (params: { token: string; twitterId: string; username: string; displayName: string; profileImageUrl: string | null }) => void;
  revalidateSession: () => Promise<void>;
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
  twitterId: storedAuth.twitterId,
  displayName: storedAuth.displayName,
  profileImageUrl: storedAuth.profileImageUrl,
  authToken: storedAuth.authToken,
  featureUnlocks: [],
  vybesBalance: 0,
  transactionHistory: [],

  signInWithTwitter: async () => {
    set({ isSigningIn: true });
    analytics.capture('sign_in_initiated');

    try {
      const clientId = import.meta.env.VITE_TWITTER_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_TWITTER_REDIRECT_URI || `${window.location.origin}/auth/callback`;

      console.log('[PKCE] Starting OAuth flow');
      console.log('[PKCE] clientId:', clientId ? `${clientId.slice(0, 8)}...` : 'MISSING');
      console.log('[PKCE] redirectUri:', redirectUri);

      if (!clientId) {
        console.error('[PKCE] VITE_TWITTER_CLIENT_ID not set');
        set({ isSigningIn: false });
        return;
      }

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      console.log('[PKCE] Generated codeVerifier length:', codeVerifier.length);
      console.log('[PKCE] Generated codeChallenge:', codeChallenge.slice(0, 16) + '...');
      console.log('[PKCE] Generated state:', state.slice(0, 16) + '...');

      // Store PKCE params in localStorage (sessionStorage is unreliable on mobile browsers
      // during cross-origin redirects like Twitter OAuth)
      localStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify({ codeVerifier, state }));

      // Verify storage worked
      const stored = localStorage.getItem(PKCE_STORAGE_KEY);
      console.log('[PKCE] Stored in sessionStorage:', stored ? 'YES' : 'NO');

      // Build Twitter OAuth 2.0 authorize URL
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'tweet.read users.read offline.access',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
      console.log('[PKCE] Redirecting to:', authUrl);

      // Redirect to Twitter
      window.location.href = authUrl;
    } catch (err) {
      console.error('[PKCE] Failed to initiate Twitter OAuth:', err);
      analytics.capture('sign_in_failed', { error: String(err) });
      set({ isSigningIn: false });
    }
  },

  signOut: () => {
    analytics.capture('signed_out', { twitter_username: get().twitterUsername });
    analytics.reset();
    const cleared: StoredAuthState = {
      isSignedIn: false, twitterUsername: null, twitterId: null,
      displayName: null, profileImageUrl: null, authToken: null,
    };
    saveAuth(cleared);
    set({ ...cleared, featureUnlocks: [] });
  },

  setSignedIn: (username) => {
    const current = getStoredAuth();
    const updated = { ...current, isSignedIn: true, twitterUsername: username };
    saveAuth(updated);
    set({ isSignedIn: true, twitterUsername: username });
  },

  setAuthFromCallback: ({ token, twitterId, username, displayName, profileImageUrl }) => {
    const stored: StoredAuthState = {
      isSignedIn: true,
      twitterUsername: `@${username}`,
      twitterId,
      displayName,
      profileImageUrl,
      authToken: token,
    };
    saveAuth(stored);
    set({
      isSignedIn: true,
      isSigningIn: false,
      twitterUsername: `@${username}`,
      twitterId,
      displayName,
      profileImageUrl,
      authToken: token,
      featureUnlocks: [],
    });
    analytics.identify(twitterId, { username: `@${username}`, display_name: displayName });
    analytics.capture('sign_in_completed', { twitter_username: `@${username}` });
  },

  revalidateSession: async () => {
    const { authToken } = get();
    if (!authToken) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.ok) {
        const { user } = await res.json();
        set({
          isSignedIn: true,
          twitterUsername: `@${user.username}`,
          twitterId: user.twitterId,
          displayName: user.displayName,
          profileImageUrl: user.profileImageUrl,
        });
        analytics.identify(user.twitterId, { username: `@${user.username}`, display_name: user.displayName });
      } else {
        // Token expired or invalid — clear auth
        get().signOut();
      }
    } catch {
      // Network error — keep existing state, don't sign out
      console.warn('Failed to revalidate session');
    }
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
