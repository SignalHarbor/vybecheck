import type { DatabaseInstance } from '../database';
import type { LedgerEntry, TransactionReason } from '../../../shared/types';

export interface LedgerRow {
  id: string;
  participant_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export class LedgerRepository {
  constructor(private db: DatabaseInstance) {}

  addTransaction(params: {
    id: string;
    participantId: string;
    amount: number;
    reason: TransactionReason;
    createdAt: Date;
  }): void {
    this.db.prepare(`
      INSERT INTO ledger (id, participant_id, amount, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.participantId,
      params.amount,
      params.reason,
      params.createdAt.toISOString()
    );
  }

  getBalance(participantId: string): number {
    const row = this.db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as balance FROM ledger WHERE participant_id = ?'
    ).get(participantId) as { balance: number };
    return row.balance;
  }

  getHistory(participantId: string): LedgerRow[] {
    return this.db.prepare(
      'SELECT * FROM ledger WHERE participant_id = ? ORDER BY created_at DESC, id DESC'
    ).all(participantId) as LedgerRow[];
  }

  getAll(): LedgerRow[] {
    return this.db.prepare('SELECT * FROM ledger ORDER BY created_at ASC').all() as LedgerRow[];
  }

  static rowToLedgerEntry(row: LedgerRow): LedgerEntry {
    return {
      id: row.id,
      participantId: row.participant_id,
      amount: row.amount,
      reason: row.reason as TransactionReason,
      createdAt: new Date(row.created_at),
    };
  }
}
