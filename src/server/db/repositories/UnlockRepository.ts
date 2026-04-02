import type { DatabaseInstance } from '../database';
import type { FeatureUnlock, UnlockableFeature } from '../../../shared/types';

export interface UnlockRow {
  id: string;
  participant_id: string;
  resource_id: string;
  feature: string;
  created_at: string;
}

export class UnlockRepository {
  constructor(private db: DatabaseInstance) {}

  create(params: {
    id: string;
    participantId: string;
    resourceId: string;
    feature: UnlockableFeature;
    createdAt: Date;
  }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO feature_unlocks (id, participant_id, resource_id, feature, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      params.id,
      params.participantId,
      params.resourceId,
      params.feature,
      params.createdAt.toISOString()
    );
  }

  hasUnlock(participantId: string, resourceId: string, feature: UnlockableFeature): boolean {
    const row = this.db.prepare(
      'SELECT id FROM feature_unlocks WHERE participant_id = ? AND resource_id = ? AND feature = ?'
    ).get(participantId, resourceId, feature);
    return row !== undefined;
  }

  getUnlocks(participantId: string, resourceId?: string): UnlockRow[] {
    if (resourceId) {
      return this.db.prepare(
        'SELECT * FROM feature_unlocks WHERE participant_id = ? AND resource_id = ?'
      ).all(participantId, resourceId) as UnlockRow[];
    }
    return this.db.prepare(
      'SELECT * FROM feature_unlocks WHERE participant_id = ?'
    ).all(participantId) as UnlockRow[];
  }

  getAll(): UnlockRow[] {
    return this.db.prepare('SELECT * FROM feature_unlocks').all() as UnlockRow[];
  }

  static rowToFeatureUnlock(row: UnlockRow): FeatureUnlock {
    return {
      id: row.id,
      participantId: row.participant_id,
      resourceId: row.resource_id,
      feature: row.feature as UnlockableFeature,
      createdAt: new Date(row.created_at),
    };
  }
}
