import { Router, Request, Response } from 'express';
import type { VybeLedger } from '../models/VybeLedger';
import { ADMIN_USERS } from '../../shared/features';

export function createVybesRoutes(vybeLedger: VybeLedger): Router {
  const router = Router();

  /**
   * GET /api/vybes/balance
   * Get Vybes balance for a participant
   */
  router.get('/balance', (req: Request, res: Response) => {
    const participantId = req.query.participantId as string;

    if (!participantId) {
      res.status(400).json({ error: 'Missing participantId' });
      return;
    }

    const balance = vybeLedger.getBalance(participantId);
    res.json({ balance });
  });

  /**
   * GET /api/vybes/history
   * Get transaction history for a participant
   */
  router.get('/history', (req: Request, res: Response) => {
    const participantId = req.query.participantId as string;

    if (!participantId) {
      res.status(400).json({ error: 'Missing participantId' });
      return;
    }

    const transactions = vybeLedger.getTransactionHistory(participantId);
    res.json({ transactions });
  });

  /**
   * POST /api/vybes/issue
   * Admin only: Issue Vybes directly to a participant
   */
  router.post('/issue', (req: Request, res: Response) => {
    const { adminUsername, participantId, amount } = req.body;

    if (!adminUsername || !participantId || amount === undefined) {
      res.status(400).json({ error: 'Missing adminUsername, participantId, or amount' });
      return;
    }

    if (!ADMIN_USERS.includes(adminUsername as any)) {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    const issueAmount = Number(amount);
    if (isNaN(issueAmount) || issueAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    try {
      vybeLedger.addVybes({
        participantId,
        amount: issueAmount,
        reason: 'ADMIN_ISSUED',
      });
      res.json({ success: true, balance: vybeLedger.getBalance(participantId) });
    } catch (error) {
      res.status(500).json({ error: 'Failed to issue vybes' });
    }
  });

  return router;
}
