import type { DatabaseInstance } from '../database';
import type { Response } from '../../models/Response';

export interface ResponseRow {
  id: string;
  participant_id: string;
  question_id: string;
  session_id: string;
  option_chosen: string;
  answered_at: string;
}

export class ResponseRepository {
  constructor(private db: DatabaseInstance) {}

  create(params: {
    id: string;
    participantId: string;
    questionId: string;
    sessionId: string;
    optionChosen: string;
    answeredAt: Date;
  }): void {
    this.db.prepare(`
      INSERT INTO responses (id, participant_id, question_id, session_id, option_chosen, answered_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.participantId,
      params.questionId,
      params.sessionId,
      params.optionChosen,
      params.answeredAt.toISOString()
    );
  }

  findBySession(sessionId: string): ResponseRow[] {
    return this.db.prepare('SELECT * FROM responses WHERE session_id = ?').all(sessionId) as ResponseRow[];
  }

  findByParticipant(participantId: string): ResponseRow[] {
    return this.db.prepare('SELECT * FROM responses WHERE participant_id = ?').all(participantId) as ResponseRow[];
  }

  static rowToResponse(row: ResponseRow): Response {
    return {
      id: row.id,
      participantId: row.participant_id,
      questionId: row.question_id,
      sessionId: row.session_id,
      optionChosen: row.option_chosen,
      answeredAt: new Date(row.answered_at),
    };
  }
}
