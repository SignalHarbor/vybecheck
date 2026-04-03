import { Router, Request, Response } from 'express';
import type { AuthService } from '../services/AuthService';

export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();

  const clientId = process.env.VITE_TWITTER_CLIENT_ID || '';
  const clientSecret = process.env.VITE_TWITTER_CLIENT_SECRET || '';

  /**
   * POST /api/auth/twitter/token
   * Exchange OAuth 2.0 authorization code for access token + user profile.
   */
  router.post('/twitter/token', async (req: Request, res: Response) => {
    try {
      const { code, codeVerifier, redirectUri } = req.body;

      if (!code || !codeVerifier || !redirectUri) {
        res.status(400).json({ error: 'Missing code, codeVerifier, or redirectUri' });
        return;
      }

      if (!clientId) {
        res.status(500).json({ error: 'VITE_TWITTER_CLIENT_ID not configured' });
        return;
      }

      const result = await authService.exchangeCodeForUser({
        code,
        codeVerifier,
        redirectUri,
        clientId,
        clientSecret: clientSecret || undefined,
      });

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('Auth error:', message);
      res.status(401).json({ error: message });
    }
  });

  /**
   * GET /api/auth/me
   * Validate JWT and return user profile.
   */
  router.get('/me', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    const user = authService.verifyAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    res.json({ user });
  });

  return router;
}
