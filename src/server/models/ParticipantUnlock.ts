import type { FeatureUnlock, UnlockableFeature } from '../../shared/types';
import type { UnlockRepository } from '../db/repositories/UnlockRepository';

/**
 * ParticipantUnlockManager - Manages feature unlocks per participant per resource
 *
 * Tracks which features have been unlocked by participants.
 * Implements tier hierarchy: MATCH_ALL > MATCH_TOP3 > MATCH_PREVIEW
 * Optionally writes through to an UnlockRepository for persistence.
 */
export class ParticipantUnlockManager {
  private nextId = 1;
  private unlocks: FeatureUnlock[] = [];
  private repo?: UnlockRepository;

  constructor(repo?: UnlockRepository) {
    this.repo = repo;
    // Hydrate from DB if repository provided
    if (repo) {
      const rows = repo.getAll();
      for (const row of rows) {
        const entry: FeatureUnlock = {
          id: row.id,
          participantId: row.participant_id,
          resourceId: row.resource_id,
          feature: row.feature as UnlockableFeature,
          createdAt: new Date(row.created_at),
        };
        this.unlocks.push(entry);
        const idNum = parseInt(row.id.replace('unlock-', ''));
        if (!isNaN(idNum) && idNum >= this.nextId) {
          this.nextId = idNum + 1;
        }
      }
    }
  }

  // Feature tier hierarchy
  private readonly TIER_HIERARCHY: Record<UnlockableFeature, UnlockableFeature[]> = {
    MATCH_ALL: ['MATCH_ALL', 'MATCH_TOP3', 'MATCH_PREVIEW'],
    MATCH_TOP3: ['MATCH_TOP3', 'MATCH_PREVIEW'],
    MATCH_PREVIEW: ['MATCH_PREVIEW'],
    QUESTION_LIMIT_10: ['QUESTION_LIMIT_10'],
  };

  /**
   * Create an unlock for a participant (idempotent)
   * @param participantId - Participant ID
   * @param resourceId - Resource ID (format: "session:{sessionId}")
   * @param feature - Feature to unlock
   * @returns The created or existing unlock
   */
  createUnlock(
    participantId: string,
    resourceId: string,
    feature: UnlockableFeature
  ): FeatureUnlock {
    // Validate feature
    const validFeatures: UnlockableFeature[] = [
      'MATCH_PREVIEW',
      'MATCH_TOP3',
      'MATCH_ALL',
      'QUESTION_LIMIT_10',
    ];
    if (!validFeatures.includes(feature)) {
      throw new Error(`Invalid feature: ${feature}`);
    }

    // Check if already unlocked (idempotent)
    const existing = this.unlocks.find(
      (u) =>
        u.participantId === participantId &&
        u.resourceId === resourceId &&
        u.feature === feature
    );

    if (existing) {
      return existing; // Already unlocked, return existing
    }

    const unlock: FeatureUnlock = {
      id: `unlock-${this.nextId++}`,
      participantId,
      resourceId,
      feature,
      createdAt: new Date(),
    };

    this.unlocks.push(unlock);

    // Write-through to DB
    if (this.repo) {
      this.repo.create({
        id: unlock.id,
        participantId: unlock.participantId,
        resourceId: unlock.resourceId,
        feature: unlock.feature,
        createdAt: unlock.createdAt,
      });
    }

    return unlock;
  }

  /**
   * Unlock a feature for a participant (alias for createUnlock)
   * @param params - Unlock parameters
   */
  unlockFeature(params: {
    participantId: string;
    resourceId: string;
    feature: UnlockableFeature;
  }): void {
    const { participantId, resourceId, feature } = params;
    this.createUnlock(participantId, resourceId, feature);
  }

  /**
   * Check if participant has specific unlock (with tier hierarchy)
   * @param participantId - Participant ID
   * @param resourceId - Resource ID
   * @param feature - Feature to check
   * @returns True if participant has access (direct or via tier hierarchy)
   */
  hasUnlock(
    participantId: string,
    resourceId: string,
    feature: UnlockableFeature
  ): boolean {
    // Check for direct unlock or higher tier unlock
    for (const unlock of this.unlocks) {
      if (
        unlock.participantId === participantId &&
        unlock.resourceId === resourceId
      ) {
        // Check if this unlock grants access via tier hierarchy
        const grantedFeatures = this.TIER_HIERARCHY[unlock.feature] || [];
        if (grantedFeatures.includes(feature)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if participant has any unlock for a resource
   * @param participantId - Participant ID
   * @param resourceId - Resource ID
   * @returns True if participant has any unlock for this resource
   */
  hasAnyUnlock(participantId: string, resourceId: string): boolean {
    return this.unlocks.some(
      (u) => u.participantId === participantId && u.resourceId === resourceId
    );
  }

  /**
   * Check if participant has access to a feature (alias for hasUnlock, with free feature logic)
   * @param params - Access check parameters
   * @returns True if participant has access (direct or via tier hierarchy)
   */
  hasFeatureAccess(params: {
    participantId: string;
    resourceId: string;
    feature: UnlockableFeature;
  }): boolean {
    const { participantId, resourceId, feature } = params;

    // Free feature (MATCH_PREVIEW costs 0)
    if (feature === 'MATCH_PREVIEW') {
      return true;
    }

    return this.hasUnlock(participantId, resourceId, feature);
  }

  /**
   * Get all unlocks for a participant
   * @param participantId - Participant ID
   * @returns Array of unlocks
   */
  getUnlocksForParticipant(participantId: string): FeatureUnlock[] {
    return this.unlocks.filter((u) => u.participantId === participantId);
  }

  /**
   * Get all unlocks for a specific resource
   * @param resourceId - Resource ID
   * @returns Array of unlocks
   */
  getUnlocksByResource(resourceId: string): FeatureUnlock[] {
    return this.unlocks.filter((u) => u.resourceId === resourceId);
  }

  /**
   * Get all unlocks for a participant (with optional resource filter)
   * @param params - Query parameters
   * @returns Array of unlocks
   */
  getUnlocks(params: {
    participantId: string;
    resourceId?: string;
  }): FeatureUnlock[] {
    const { participantId, resourceId } = params;

    return this.unlocks.filter((u) => {
      if (u.participantId !== participantId) return false;
      if (resourceId && u.resourceId !== resourceId) return false;
      return true;
    });
  }

  /**
   * Check if a feature is already unlocked (exact match, no tier hierarchy)
   * @param params - Check parameters
   * @returns True if exactly this feature is unlocked
   */
  isFeatureUnlocked(params: {
    participantId: string;
    resourceId: string;
    feature: UnlockableFeature;
  }): boolean {
    const { participantId, resourceId, feature } = params;

    return this.unlocks.some(
      (u) =>
        u.participantId === participantId &&
        u.resourceId === resourceId &&
        u.feature === feature
    );
  }
}

// Backward compatibility alias
export { ParticipantUnlockManager as ParticipantUnlock };
