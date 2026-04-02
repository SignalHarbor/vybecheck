import type { DatabaseInstance } from '../database';
import type { Question } from '../../models/Question';
import type { Participant } from '../../models/Participant';

export interface SessionRow {
  id: string;
  owner_id: string;
  status: 'live' | 'active' | 'expired';
  results_released: number;
  created_at: string;
  expires_at: string;
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  user_id: string | null;
  username: string | null;
  is_owner: number;
  is_active: number;
  joined_at: string;
  last_active_at: string;
}

export interface QuestionRow {
  id: string;
  session_id: string;
  prompt: string;
  option_a: string;
  option_b: string;
  timer: number | null;
  sort_order: number;
  added_at: string;
}

export class SessionRepository {
  constructor(private db: DatabaseInstance) {}

  createSession(params: {
    id: string;
    ownerId: string;
    status: 'live' | 'active' | 'expired';
    resultsReleased: boolean;
    createdAt: Date;
    expiresAt: Date;
  }): void {
    this.db.prepare(`
      INSERT INTO sessions (id, owner_id, status, results_released, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.ownerId,
      params.status,
      params.resultsReleased ? 1 : 0,
      params.createdAt.toISOString(),
      params.expiresAt.toISOString()
    );
  }

  findById(id: string): SessionRow | undefined {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  }

  findActive(): SessionRow[] {
    return this.db.prepare(
      "SELECT * FROM sessions WHERE status IN ('live', 'active')"
    ).all() as SessionRow[];
  }

  updateStatus(id: string, status: 'live' | 'active' | 'expired'): void {
    this.db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id);
  }

  updateResultsReleased(id: string, released: boolean): void {
    this.db.prepare('UPDATE sessions SET results_released = ? WHERE id = ?').run(released ? 1 : 0, id);
  }

  // --- Participant methods ---

  addParticipant(params: {
    id: string;
    sessionId: string;
    username: string | null;
    isOwner: boolean;
    isActive: boolean;
    joinedAt: Date;
    lastActiveAt: Date;
  }): void {
    this.db.prepare(`
      INSERT INTO participants (id, session_id, username, is_owner, is_active, joined_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.sessionId,
      params.username,
      params.isOwner ? 1 : 0,
      params.isActive ? 1 : 0,
      params.joinedAt.toISOString(),
      params.lastActiveAt.toISOString()
    );
  }

  getParticipantsBySession(sessionId: string): ParticipantRow[] {
    return this.db.prepare('SELECT * FROM participants WHERE session_id = ?').all(sessionId) as ParticipantRow[];
  }

  updateParticipantActive(participantId: string, isActive: boolean): void {
    this.db.prepare('UPDATE participants SET is_active = ?, last_active_at = ? WHERE id = ?')
      .run(isActive ? 1 : 0, new Date().toISOString(), participantId);
  }

  // --- Question methods ---

  addQuestion(params: {
    id: string;
    sessionId: string;
    prompt: string;
    options: [string, string];
    timer?: number;
    sortOrder: number;
    addedAt: Date;
  }): void {
    this.db.prepare(`
      INSERT INTO questions (id, session_id, prompt, option_a, option_b, timer, sort_order, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.sessionId,
      params.prompt,
      params.options[0],
      params.options[1],
      params.timer ?? null,
      params.sortOrder,
      params.addedAt.toISOString()
    );
  }

  getQuestionsBySession(sessionId: string): QuestionRow[] {
    return this.db.prepare(
      'SELECT * FROM questions WHERE session_id = ? ORDER BY sort_order'
    ).all(sessionId) as QuestionRow[];
  }

  // --- Hydration helpers ---

  /**
   * Convert a QuestionRow back to a Question model object.
   */
  static rowToQuestion(row: QuestionRow): Question {
    return {
      id: row.id,
      prompt: row.prompt,
      options: [row.option_a, row.option_b],
      timer: row.timer ?? undefined,
      addedAt: new Date(row.added_at),
    };
  }

  /**
   * Convert a ParticipantRow back to a Participant model object.
   * WebSocket connection is null (runtime-only, re-attached on reconnect).
   */
  static rowToParticipant(row: ParticipantRow): Participant {
    return {
      id: row.id,
      username: row.username,
      connection: null,
      isOwner: row.is_owner === 1,
      joinedAt: new Date(row.joined_at),
      lastActiveAt: new Date(row.last_active_at),
      isActive: row.is_active === 1,
    };
  }
}
