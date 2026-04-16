/**
 * Parse a user-entered "session" value, which may be either a raw session ID
 * or a full join URL (e.g. "https://vybecheck.fly.dev/?join=<id>").
 *
 * For URL input we ONLY accept hosts on an allowlist:
 *   - localhost / 127.0.0.1 (dev)
 *   - the current window origin
 *   - hosts derived from VITE_SERVER_URL, VITE_WS_URL, VITE_APP_URL
 *   - any hosts listed in VITE_ALLOWED_JOIN_HOSTS (comma-separated)
 *
 * If the URL is valid and allowed, we strip it down to just the session id
 * (either from `?join=<id>` or the `/join/<id>` path form).
 */

function hostnameFromUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    // Normalize websocket URLs so URL() can parse them consistently.
    const normalized = raw.replace(/^wss?:\/\//i, (m) => (m.toLowerCase() === 'wss://' ? 'https://' : 'http://'));
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

export function getAllowedJoinHosts(): string[] {
  const hosts = new Set<string>(['localhost', '127.0.0.1']);

  // Derive from standard env URLs
  for (const envUrl of [
    import.meta.env.VITE_SERVER_URL,
    import.meta.env.VITE_WS_URL,
    import.meta.env.VITE_APP_URL,
  ]) {
    const h = hostnameFromUrl(envUrl);
    if (h) hosts.add(h);
  }

  // Explicit extra allowlist: comma-separated host names
  const extra = import.meta.env.VITE_ALLOWED_JOIN_HOSTS as string | undefined;
  if (extra) {
    for (const h of extra.split(',').map((s) => s.trim()).filter(Boolean)) {
      hosts.add(h);
    }
  }

  // The current origin is always trusted (you're already running there).
  if (typeof window !== 'undefined' && window.location?.hostname) {
    hosts.add(window.location.hostname);
  }

  return Array.from(hosts);
}

export interface ParsedJoinInput {
  /** The clean session ID if the input was usable, otherwise null. */
  sessionId: string | null;
  /** Populated only when the input was a URL that we rejected. */
  error?: string;
}

const URL_LIKE_RE = /^(https?:)?\/\//i;

/**
 * Parse raw user input (or a prefilled value) into a clean session id.
 * - Empty input => { sessionId: null }
 * - Plain id    => { sessionId: <trimmed> }
 * - URL input   => validates host against allowlist and extracts id
 */
export function parseJoinInput(raw: string | null | undefined): ParsedJoinInput {
  if (!raw) return { sessionId: null };
  const trimmed = raw.trim();
  if (!trimmed) return { sessionId: null };

  // Heuristic: treat as URL only if it looks like one. This keeps plain
  // session ids (which are timestamp_rand strings) from being URL-parsed.
  const looksLikeUrl = URL_LIKE_RE.test(trimmed) || /[?/]/.test(trimmed);
  if (!looksLikeUrl) {
    return { sessionId: trimmed };
  }

  let url: URL;
  try {
    // Base origin lets us parse protocol-relative or path-only inputs.
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    url = new URL(trimmed, base);
  } catch {
    return { sessionId: null, error: 'That doesn\u2019t look like a valid join link.' };
  }

  const allowed = getAllowedJoinHosts();
  if (!allowed.includes(url.hostname)) {
    return {
      sessionId: null,
      error: `Join links from "${url.hostname}" are not allowed.`,
    };
  }

  // ?join=<id>
  const queryId = url.searchParams.get('join');
  if (queryId && queryId.trim()) return { sessionId: queryId.trim() };

  // /join/<id>
  const pathMatch = url.pathname.match(/^\/join\/([^/]+)\/?$/);
  if (pathMatch) return { sessionId: decodeURIComponent(pathMatch[1]) };

  return { sessionId: null, error: 'No session id found in that link.' };
}
