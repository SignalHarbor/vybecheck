import { Router, Request, Response } from 'express';
import type { StripeService } from '../services/StripeService';
import logger from '../utils/logger';

export function createPaymentRoutes(stripeService: StripeService): Router {
  const router = Router();

  /**
   * POST /api/checkout
   * Create a Stripe Checkout Session
   */
  router.post('/checkout', async (req: Request, res: Response) => {
    try {
      const { packId, participantId } = req.body;

      if (!packId || !participantId) {
        res.status(400).json({ error: 'Missing packId or participantId' });
        return;
      }

      const pack = stripeService.getPack(packId);
      if (!pack) {
        res.status(400).json({ error: 'Invalid pack ID' });
        return;
      }

      const result = await stripeService.createCheckoutSession({
        packId,
        participantId,
      });

      res.json({ url: result.url, sessionId: result.sessionId });
    } catch (err: unknown) {
      logger.error({ err }, 'Checkout session creation failed');
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  /**
   * GET /api/checkout/verify
   * Verify a checkout session status
   */
  router.get('/checkout/verify', async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.session_id as string;

      if (!sessionId) {
        res.status(400).json({ error: 'Missing session_id' });
        return;
      }

      const result = await stripeService.verifySession(sessionId);
      res.json(result);
    } catch (err: unknown) {
      logger.error({ err }, 'Checkout verification failed');
      res.status(500).json({ error: 'Failed to verify session' });
    }
  });

  /**
   * GET /api/packs
   * Get available Vybe packs
   */
  router.get('/packs', (_req: Request, res: Response) => {
    const packs = stripeService.getAllPacks().map(pack => ({
      id: pack.id,
      name: pack.name,
      vybes: pack.vybes,
      priceUsd: pack.priceUsd,
    }));
    res.json({ packs });
  });

  return router;
}

/**
 * Stripe webhook handler - needs raw body, so it's separate
 */
export function createWebhookHandler(stripeService: StripeService) {
  return async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    try {
      const result = await stripeService.handleWebhook({
        payload: req.body, // raw Buffer
        signature,
      });

      if (result.success) {
        res.json({ received: true });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (err: unknown) {
      logger.error({ err }, 'Stripe webhook processing failed');
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };
}
