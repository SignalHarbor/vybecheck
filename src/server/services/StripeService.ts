import Stripe from 'stripe';
import type { VybeLedger } from '../models/VybeLedger';
import type { StripeSessionRepository } from '../db/repositories/StripeSessionRepository';
import logger from '../utils/logger';
import { getAnalyticsServer } from '../utils/analytics';

// Pack configuration - replace with your actual Stripe Price IDs
export interface VybePack {
  id: string;
  name: string;
  vybes: number;
  priceUsd: number;
  stripePriceId: string;
}

// Returns packs with Stripe Price IDs from environment
function getVybePacks(): VybePack[] {
  return [
    {
      id: 'starter',
      name: 'Starter Pack',
      vybes: 20,
      priceUsd: 5,
      stripePriceId: process.env.STRIPE_PRICE_STARTER || '',
    },
    {
      id: 'pro',
      name: 'Pro Pack',
      vybes: 50,
      priceUsd: 10,
      stripePriceId: process.env.STRIPE_PRICE_PRO || '',
    },
    {
      id: 'ultimate',
      name: 'Ultimate Pack',
      vybes: 120,
      priceUsd: 20,
      stripePriceId: process.env.STRIPE_PRICE_ULTIMATE || '',
    },
  ];
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}

export interface WebhookResult {
  success: boolean;
  participantId?: string;
  vybesAdded?: number;
  error?: string;
}

export class StripeService {
  private stripe: Stripe;
  private vybeLedger: VybeLedger;
  private webhookSecret: string;
  private appUrl: string;
  private stripeSessionRepo?: StripeSessionRepository;

  // Track processed session IDs to prevent duplicate credits (idempotency)
  // Falls back to in-memory Set when no DB is available
  private processedSessions: Set<string> = new Set();

  constructor(params: {
    secretKey: string;
    webhookSecret: string;
    vybeLedger: VybeLedger;
    appUrl: string;
    stripeSessionRepo?: StripeSessionRepository;
  }) {
    this.stripe = new Stripe(params.secretKey);
    this.webhookSecret = params.webhookSecret;
    this.vybeLedger = params.vybeLedger;
    this.appUrl = params.appUrl;
    this.stripeSessionRepo = params.stripeSessionRepo;
  }

  /**
   * Get pack by ID
   */
  getPack(packId: string): VybePack | undefined {
    return getVybePacks().find(p => p.id === packId);
  }

  /**
   * Get all available packs
   */
  getAllPacks(): VybePack[] {
    return getVybePacks();
  }

  /**
   * Create a Stripe Checkout Session
   */
  async createCheckoutSession(params: {
    packId: string;
    participantId: string;
  }): Promise<CheckoutSessionResult> {
    const { packId, participantId } = params;

    const pack = this.getPack(packId);
    if (!pack) {
      throw new Error(`Invalid pack ID: ${packId}`);
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: pack.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        participantId,
        packId,
        vybes: pack.vybes.toString(),
      },
      success_url: `${this.appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appUrl}/purchase/cancel`,
    });

    if (!session.url) {
      throw new Error('Failed to create checkout session URL');
    }

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Verify and process Stripe webhook
   */
  async handleWebhook(params: {
    payload: Buffer;
    signature: string;
  }): Promise<WebhookResult> {
    const { payload, signature } = params;

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
    } catch (err: any) {
      logger.error({ err }, 'Webhook signature verification failed');
      return { success: false, error: 'Invalid signature' };
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return this.handleCheckoutCompleted(session);
    }

    // Acknowledge other events without processing
    return { success: true };
  }

  /**
   * Handle successful checkout
   */
  private handleCheckoutCompleted(session: Stripe.Checkout.Session): WebhookResult {
    const { participantId, vybes } = session.metadata || {};

    if (!participantId || !vybes) {
      logger.error({ sessionId: session.id }, 'Missing metadata in checkout session');
      return { success: false, error: 'Missing metadata' };
    }

    // Idempotency check - prevent duplicate credits (DB + in-memory)
    const alreadyProcessed = this.stripeSessionRepo
      ? this.stripeSessionRepo.isProcessed(session.id)
      : this.processedSessions.has(session.id);
    if (alreadyProcessed) {
      logger.info({ sessionId: session.id }, 'Checkout session already processed');
      return { success: true, participantId, vybesAdded: 0 };
    }

    const vybesAmount = parseInt(vybes, 10);
    if (isNaN(vybesAmount) || vybesAmount <= 0) {
      logger.error({ vybes, sessionId: session.id }, 'Invalid vybes amount in checkout');
      return { success: false, error: 'Invalid vybes amount' };
    }

    // Credit the Vybes
    try {
      this.vybeLedger.addVybes({
        participantId,
        amount: vybesAmount,
        reason: 'PURCHASE_VYBES',
      });

      // Mark session as processed (DB + in-memory)
      if (this.stripeSessionRepo) {
        this.stripeSessionRepo.markProcessed(session.id);
      }
      this.processedSessions.add(session.id);

      logger.info({ participantId, vybesAmount }, 'Credited Vybes from purchase');

      // Fire authoritative purchase event from the server — single source of truth
      const posthog = getAnalyticsServer();
      if (posthog) {
        posthog.capture({
          distinctId: participantId,
          event: 'purchase_completed',
          properties: {
            pack_id: session.metadata?.packId,
            vybes_granted: vybesAmount,
            stripe_session_id: session.id,
          },
        });
      }

      return {
        success: true,
        participantId,
        vybesAdded: vybesAmount,
      };
    } catch (err: any) {
      logger.error({ err }, 'Failed to credit Vybes');
      return { success: false, error: 'Failed to credit Vybes' };
    }
  }

  /**
   * Verify a checkout session (for success page verification)
   * Also credits Vybes if paid and not already processed (handles server restart)
   */
  async verifySession(sessionId: string): Promise<{
    paid: boolean;
    participantId?: string;
    vybes?: number;
    credited?: boolean;
  }> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        const { participantId, vybes } = session.metadata || {};
        const vybesAmount = vybes ? parseInt(vybes, 10) : undefined;

        // Credit Vybes if not already processed (idempotent)
        let credited = false;
        const alreadyVerified = this.stripeSessionRepo
          ? this.stripeSessionRepo.isProcessed(sessionId)
          : this.processedSessions.has(sessionId);
        if (participantId && vybesAmount && !alreadyVerified) {
          try {
            this.vybeLedger.addVybes({
              participantId,
              amount: vybesAmount,
              reason: 'PURCHASE_VYBES',
            });
            if (this.stripeSessionRepo) {
              this.stripeSessionRepo.markProcessed(sessionId);
            }
            this.processedSessions.add(sessionId);
            credited = true;
            logger.info({ participantId, vybesAmount }, 'Credited Vybes via session verification');
          } catch (err: any) {
            logger.error({ err }, 'Failed to credit Vybes during verification');
          }
        }

        return {
          paid: true,
          participantId,
          vybes: vybesAmount,
          credited,
        };
      }

      return { paid: false };
    } catch (err) {
      logger.error({ err }, 'Failed to verify Stripe session');
      return { paid: false };
    }
  }
}
