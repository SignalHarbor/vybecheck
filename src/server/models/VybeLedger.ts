import type { LedgerEntry, TransactionReason } from '../../shared/types';
import type { LedgerRepository } from '../db/repositories/LedgerRepository';

/**
 * VybeLedger - Manages Vybes transactions and balance calculation
 *
 * Stores all transactions in a ledger format (append-only).
 * Balance is calculated by summing all transactions for a participant.
 * Optionally writes through to a LedgerRepository for persistence.
 */
export class VybeLedger {
  private ledger: LedgerEntry[] = [];
  private nextId = 1;
  private repo?: LedgerRepository;

  constructor(repo?: LedgerRepository) {
    this.repo = repo;
    // Hydrate from DB if repository provided
    if (repo) {
      const rows = repo.getAll();
      for (const row of rows) {
        const entry = {
          id: row.id,
          participantId: row.participant_id,
          amount: row.amount,
          reason: row.reason as TransactionReason,
          createdAt: new Date(row.created_at),
        };
        this.ledger.push(entry);
        // Keep nextId ahead of existing entries
        const idNum = parseInt(row.id.replace('txn-', ''));
        if (!isNaN(idNum) && idNum >= this.nextId) {
          this.nextId = idNum + 1;
        }
      }
    }
  }

  /**
   * Add a transaction (positive or negative)
   * @param participantId - Participant ID
   * @param amount - Transaction amount (positive for adding, negative for deducting)
   * @param reason - Transaction reason
   * @returns The created ledger entry
   */
  addTransaction(
    participantId: string,
    amount: number,
    reason: TransactionReason
  ): LedgerEntry {
    const entry: LedgerEntry = {
      id: `txn-${this.nextId++}`,
      participantId,
      amount,
      reason,
      createdAt: new Date(),
    };

    this.ledger.push(entry);

    // Write-through to DB
    if (this.repo) {
      this.repo.addTransaction({
        id: entry.id,
        participantId: entry.participantId,
        amount: entry.amount,
        reason: entry.reason,
        createdAt: entry.createdAt,
      });
    }

    return entry;
  }

  /**
   * Add Vybes to a participant's balance (convenience method)
   * @param params - Transaction parameters
   */
  addVybes(params: {
    participantId: string;
    amount: number;
    reason: TransactionReason;
  }): LedgerEntry {
    const { participantId, amount, reason } = params;

    if (amount < 0) {
      throw new Error('Transaction amount cannot be negative');
    }

    return this.addTransaction(participantId, amount, reason);
  }

  /**
   * Deduct Vybes from a participant's balance (convenience method)
   * @param params - Transaction parameters
   */
  deductVybes(params: {
    participantId: string;
    amount: number;
    reason: TransactionReason;
  }): LedgerEntry {
    const { participantId, amount, reason } = params;

    if (amount <= 0) {
      throw new Error('Transaction amount must be positive');
    }

    return this.addTransaction(participantId, -amount, reason);
  }

  /**
   * Get current balance for a participant
   * @param participantId - Participant ID
   * @returns Current Vybes balance
   */
  getBalance(participantId: string): number {
    return this.ledger
      .filter((entry) => entry.participantId === participantId)
      .reduce((sum, entry) => sum + entry.amount, 0);
  }

  /**
   * Get transaction history for a participant (sorted newest first)
   * @param participantId - Participant ID
   * @returns Array of ledger entries
   */
  getTransactionHistory(participantId: string): LedgerEntry[] {
    return this.ledger
      .filter((entry) => entry.participantId === participantId)
      .sort((a, b) => {
        // Sort by timestamp first (newest first)
        const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;

        // If timestamps are identical, sort by ID (higher ID = newer)
        const idA = parseInt(a.id.replace('txn-', ''));
        const idB = parseInt(b.id.replace('txn-', ''));
        return idB - idA;
      });
  }

  /**
   * Get transactions filtered by reason (sorted newest first)
   * @param participantId - Participant ID
   * @param reason - Transaction reason to filter by
   * @returns Array of ledger entries
   */
  getTransactionsByReason(
    participantId: string,
    reason: TransactionReason
  ): LedgerEntry[] {
    return this.ledger
      .filter(
        (entry) =>
          entry.participantId === participantId && entry.reason === reason
      )
      .sort((a, b) => {
        // Sort by timestamp first (newest first)
        const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;

        // If timestamps are identical, sort by ID (higher ID = newer)
        const idA = parseInt(a.id.replace('txn-', ''));
        const idB = parseInt(b.id.replace('txn-', ''));
        return idB - idA;
      });
  }

  /**
   * Get all transactions across all participants
   * @returns Array of all ledger entries
   */
  getAllTransactions(): LedgerEntry[] {
    return [...this.ledger];
  }

  /**
   * Get all transactions for a participant (alias for getTransactionHistory)
   * @param participantId - Participant ID
   * @returns Array of ledger entries
   */
  getTransactions(participantId: string): LedgerEntry[] {
    return this.getTransactionHistory(participantId);
  }

  /**
   * Check if participant has sufficient balance
   * @param params - Check parameters
   * @returns True if balance is sufficient
   */
  hasSufficientBalance(params: {
    participantId: string;
    amount: number;
  }): boolean {
    const { participantId, amount } = params;
    const balance = this.getBalance(participantId);
    return balance >= amount;
  }
}
