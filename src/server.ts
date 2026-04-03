import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WebSocketHandler } from './server/services/WebSocketHandler';
import { StripeService } from './server/services/StripeService';
import { createPaymentRoutes, createWebhookHandler } from './server/routes/payment';
import { createVybesRoutes } from './server/routes/vybes';
import { createAIRoutes } from './server/routes/ai';
import { createAuthRoutes } from './server/routes/auth';
import { AuthService } from './server/services/AuthService';
import { initDatabase } from './server/db/database';
import logger from './server/utils/logger';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const db = initDatabase();
logger.info('Database initialized');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const wsHandler = new WebSocketHandler({ db });

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Initialize Stripe service (shares VybeLedger and StripeSessionRepo with WebSocket handler)
const stripeService = new StripeService({
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  vybeLedger: wsHandler.getVybeLedger(),
  appUrl: APP_URL,
  stripeSessionRepo: wsHandler.getStripeSessionRepo(),
});

// Stripe webhook needs raw body - must be before express.json()
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), createWebhookHandler(stripeService));

// JSON parsing for other routes
app.use(express.json());

// Serve static files from dist directory (for production)
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Payment routes
app.use('/api', createPaymentRoutes(stripeService));

// Vybes routes (balance, history)
app.use('/api/vybes', createVybesRoutes(wsHandler.getVybeLedger()));

// AI routes (transcription + question generation)
app.use('/api/ai', createAIRoutes());

// Auth routes (Twitter OAuth)
const authService = new AuthService(db);
app.use('/api/auth', createAuthRoutes(authService));

// SPA catch-all: serve index.html for any non-API routes (client-side routing)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  wsHandler.handleConnection(ws);
});

server.listen(PORT, () => {
  logger.info({ port: PORT, appUrl: APP_URL }, 'Server started');
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.warn('STRIPE_SECRET_KEY not set');
  }
});
