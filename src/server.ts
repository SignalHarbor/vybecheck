import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WebSocketHandler } from './server/services/WebSocketHandler';
import { StripeService } from './server/services/StripeService';
import { createPaymentRoutes, createWebhookHandler } from './server/routes/payment';
import { createVybesRoutes } from './server/routes/vybes';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const wsHandler = new WebSocketHandler();

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Initialize Stripe service (shares VybeLedger with WebSocket handler)
const stripeService = new StripeService({
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  vybeLedger: wsHandler.getVybeLedger(),
  appUrl: APP_URL,
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

// SPA catch-all: serve index.html for any non-API routes (client-side routing)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  wsHandler.handleConnection(ws);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`App URL: ${APP_URL}`);
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Warning: STRIPE_SECRET_KEY not set');
  }
});
