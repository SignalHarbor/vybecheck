import type { DatabaseInstance } from '../database';

export class StripeSessionRepository {
  constructor(private db: DatabaseInstance) {}

  markProcessed(sessionId: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO processed_stripe_sessions (session_id, processed_at)
      VALUES (?, ?)
    `).run(sessionId, new Date().toISOString());
  }

  isProcessed(sessionId: string): boolean {
    const row = this.db.prepare(
      'SELECT session_id FROM processed_stripe_sessions WHERE session_id = ?'
    ).get(sessionId);
    return row !== undefined;
  }
}
