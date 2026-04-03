/**
 * Generate a unique participant ID.
 * Uses timestamp + random string for uniqueness.
 */
export function generateParticipantId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${randomPart}`;
}

/**
 * Generate a unique response ID.
 * Uses timestamp + random string for global uniqueness across restarts.
 */
export function generateResponseId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `r_${timestamp}${randomPart}`;
}

/**
 * Generate a unique question ID.
 * Uses timestamp + random string for global uniqueness across restarts.
 */
export function generateQuestionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `q_${timestamp}${randomPart}`;
}

/**
 * Reset all counters (no-op, kept for test compatibility).
 */
export function resetCounters(): void {
  // No-op: IDs are now timestamp-based and don't use counters.
}
