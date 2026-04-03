/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
 * Uses browser crypto.subtle — no external dependencies.
 */

/**
 * Generate a random code verifier string (43-128 chars, URL-safe).
 */
export function generateCodeVerifier(length = 128): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array).slice(0, length);
}

/**
 * Generate a code challenge from a code verifier using SHA-256.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Base64url encode a Uint8Array (no padding, URL-safe).
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
