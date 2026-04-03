import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { LoadingScreen } from '../components/LoadingScreen';

const PKCE_STORAGE_KEY = 'vybecheck_pkce';

let callbackHandled = false;

export function AuthCallback() {
  const { setAuthFromCallback } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (callbackHandled) {
      console.log('[AuthCallback] Already handled, skipping duplicate mount');
      return;
    }
    callbackHandled = true;
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      console.log('[AuthCallback] Starting callback handler');
      console.log('[AuthCallback] Current URL:', window.location.href);

      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');

      console.log('[AuthCallback] code:', code ? `${code.slice(0, 16)}...` : 'MISSING');
      console.log('[AuthCallback] state:', state ? `${state.slice(0, 16)}...` : 'MISSING');
      console.log('[AuthCallback] error:', errorParam);

      // Twitter may return an error (e.g. user denied)
      if (errorParam) {
        setError(`Twitter auth error: ${errorParam}`);
        redirectToHome();
        return;
      }

      if (!code || !state) {
        console.error('[AuthCallback] Missing code or state in URL params');
        setError('Missing authorization code or state');
        redirectToHome();
        return;
      }

      // Retrieve stored PKCE params
      const storedRaw = sessionStorage.getItem(PKCE_STORAGE_KEY);
      console.log('[AuthCallback] PKCE from sessionStorage:', storedRaw ? 'FOUND' : 'MISSING');

      if (!storedRaw) {
        console.error('[AuthCallback] No PKCE data in sessionStorage — was it cleared or did the session change?');
        setError('Missing PKCE data — please try signing in again');
        redirectToHome();
        return;
      }

      const stored = JSON.parse(storedRaw) as { codeVerifier: string; state: string };
      console.log('[AuthCallback] Stored state:', stored.state?.slice(0, 16) + '...');
      console.log('[AuthCallback] URL state:', state.slice(0, 16) + '...');
      console.log('[AuthCallback] State match:', stored.state === state);

      // Validate state (CSRF protection)
      if (stored.state !== state) {
        console.error('[AuthCallback] State mismatch!', { stored: stored.state, received: state });
        setError('State mismatch — possible CSRF attack');
        redirectToHome();
        return;
      }

      // Clean up PKCE storage
      sessionStorage.removeItem(PKCE_STORAGE_KEY);

      const redirectUri = import.meta.env.VITE_TWITTER_REDIRECT_URI || `${window.location.origin}/auth/callback`;
      console.log('[AuthCallback] redirectUri for token exchange:', redirectUri);
      console.log('[AuthCallback] codeVerifier length:', stored.codeVerifier.length);

      // Exchange code for token (use relative URL so Vite proxy handles it in dev)
      console.log('[AuthCallback] Sending token exchange request...');
      const response = await fetch('/api/auth/twitter/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          codeVerifier: stored.codeVerifier,
          redirectUri,
        }),
      });

      console.log('[AuthCallback] Token exchange response status:', response.status);

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[AuthCallback] Token exchange failed:', body);
        setError(body.error || 'Authentication failed');
        redirectToHome();
        return;
      }

      const { token, user } = await response.json();
      console.log('[AuthCallback] Auth success! User:', user.username);

      // Update auth store with real Twitter identity
      setAuthFromCallback({
        token,
        twitterId: user.twitterId,
        username: user.username,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
      });

      // Navigate to home (which will show lab page since user is now signed in)
      window.location.href = '/';
    } catch (err) {
      console.error('Auth callback error:', err);
      setError('Something went wrong during sign-in');
      redirectToHome();
    }
  }

  function redirectToHome() {
    setTimeout(() => {
      window.location.href = '/';
    }, 3000);
  }

  if (error) {
    return (
      <div className="w-screen max-w-app h-screen mx-auto bg-gray-100 flex flex-col items-center justify-center p-8">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white py-4 px-6 rounded-xl text-center font-medium shadow-[0_4px_16px_rgba(239,68,68,0.3)] max-w-sm">
          {error}
        </div>
        <p className="text-gray-400 text-sm mt-4">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-app h-screen mx-auto bg-gray-100 flex flex-col overflow-hidden shadow-app relative">
      <LoadingScreen message="Signing in with Twitter..." />
    </div>
  );
}
