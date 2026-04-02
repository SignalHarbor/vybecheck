import { describe, test, expect, beforeEach } from 'vitest';
import { initTestDatabase, type DatabaseInstance } from '../../src/server/db/database';
import { SessionRepository } from '../../src/server/db/repositories/SessionRepository';
import { ResponseRepository } from '../../src/server/db/repositories/ResponseRepository';
import { LedgerRepository } from '../../src/server/db/repositories/LedgerRepository';
import { UnlockRepository } from '../../src/server/db/repositories/UnlockRepository';
import { StripeSessionRepository } from '../../src/server/db/repositories/StripeSessionRepository';
import { UserRepository } from '../../src/server/db/repositories/UserRepository';

describe('SessionRepository', () => {
  let db: DatabaseInstance;
  let repo: SessionRepository;

  beforeEach(() => {
    db = initTestDatabase();
    repo = new SessionRepository(db);
  });

  test('should create and find a session', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    repo.createSession({
      id: 'ABC123',
      ownerId: 'owner1',
      status: 'live',
      resultsReleased: false,
      createdAt: now,
      expiresAt: expires,
    });

    const found = repo.findById('ABC123');
    expect(found).toBeDefined();
    expect(found!.id).toBe('ABC123');
    expect(found!.owner_id).toBe('owner1');
    expect(found!.status).toBe('live');
    expect(found!.results_released).toBe(0);
  });

  test('should return undefined for non-existent session', () => {
    expect(repo.findById('NOPE')).toBeUndefined();
  });

  test('should find active sessions', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    repo.createSession({ id: 'S1', ownerId: 'o1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });
    repo.createSession({ id: 'S2', ownerId: 'o2', status: 'active', resultsReleased: false, createdAt: now, expiresAt: expires });
    repo.createSession({ id: 'S3', ownerId: 'o3', status: 'expired', resultsReleased: false, createdAt: now, expiresAt: expires });

    const active = repo.findActive();
    expect(active.length).toBe(2);
    expect(active.map(s => s.id).sort()).toEqual(['S1', 'S2']);
  });

  test('should update session status', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    repo.createSession({ id: 'S1', ownerId: 'o1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });

    repo.updateStatus('S1', 'active');
    expect(repo.findById('S1')!.status).toBe('active');
  });

  test('should update results released', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    repo.createSession({ id: 'S1', ownerId: 'o1', status: 'active', resultsReleased: false, createdAt: now, expiresAt: expires });

    repo.updateResultsReleased('S1', true);
    expect(repo.findById('S1')!.results_released).toBe(1);
  });

  test('should add and retrieve participants', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    repo.createSession({ id: 'S1', ownerId: 'p1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });

    repo.addParticipant({
      id: 'p1',
      sessionId: 'S1',
      username: '@alice',
      isOwner: true,
      isActive: true,
      joinedAt: now,
      lastActiveAt: now,
    });

    repo.addParticipant({
      id: 'p2',
      sessionId: 'S1',
      username: '@bob',
      isOwner: false,
      isActive: true,
      joinedAt: now,
      lastActiveAt: now,
    });

    const participants = repo.getParticipantsBySession('S1');
    expect(participants.length).toBe(2);
    expect(participants.find(p => p.id === 'p1')!.is_owner).toBe(1);
    expect(participants.find(p => p.id === 'p2')!.is_owner).toBe(0);
  });

  test('should update participant active status', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    repo.createSession({ id: 'S1', ownerId: 'p1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });
    repo.addParticipant({ id: 'p1', sessionId: 'S1', username: null, isOwner: true, isActive: true, joinedAt: now, lastActiveAt: now });

    repo.updateParticipantActive('p1', false);
    const participants = repo.getParticipantsBySession('S1');
    expect(participants[0].is_active).toBe(0);
  });

  test('should add and retrieve questions in order', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    repo.createSession({ id: 'S1', ownerId: 'p1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });

    repo.addQuestion({ id: 'q1', sessionId: 'S1', prompt: 'Q1?', options: ['Yes', 'No'], sortOrder: 0, addedAt: now });
    repo.addQuestion({ id: 'q2', sessionId: 'S1', prompt: 'Q2?', options: ['A', 'B'], timer: 10, sortOrder: 1, addedAt: now });

    const questions = repo.getQuestionsBySession('S1');
    expect(questions.length).toBe(2);
    expect(questions[0].id).toBe('q1');
    expect(questions[1].id).toBe('q2');
    expect(questions[1].timer).toBe(10);
  });

  test('should convert row to Question model', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    repo.createSession({ id: 'S1', ownerId: 'p1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });
    repo.addQuestion({ id: 'q1', sessionId: 'S1', prompt: 'Test?', options: ['Agree', 'Disagree'], sortOrder: 0, addedAt: now });

    const rows = repo.getQuestionsBySession('S1');
    const question = SessionRepository.rowToQuestion(rows[0]);
    expect(question.id).toBe('q1');
    expect(question.prompt).toBe('Test?');
    expect(question.options).toEqual(['Agree', 'Disagree']);
  });

  test('should convert row to Participant model with null connection', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    repo.createSession({ id: 'S1', ownerId: 'p1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });
    repo.addParticipant({ id: 'p1', sessionId: 'S1', username: '@alice', isOwner: true, isActive: true, joinedAt: now, lastActiveAt: now });

    const rows = repo.getParticipantsBySession('S1');
    const participant = SessionRepository.rowToParticipant(rows[0]);
    expect(participant.id).toBe('p1');
    expect(participant.username).toBe('@alice');
    expect(participant.isOwner).toBe(true);
    expect(participant.connection).toBeNull();
  });
});

describe('ResponseRepository', () => {
  let db: DatabaseInstance;
  let repo: ResponseRepository;
  let sessionRepo: SessionRepository;

  beforeEach(() => {
    db = initTestDatabase();
    repo = new ResponseRepository(db);
    sessionRepo = new SessionRepository(db);

    // Set up a session with a participant and question
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    sessionRepo.createSession({ id: 'S1', ownerId: 'p1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });
    sessionRepo.addParticipant({ id: 'p1', sessionId: 'S1', username: null, isOwner: true, isActive: true, joinedAt: now, lastActiveAt: now });
    sessionRepo.addQuestion({ id: 'q1', sessionId: 'S1', prompt: 'Test?', options: ['Yes', 'No'], sortOrder: 0, addedAt: now });
  });

  test('should create and find responses by session', () => {
    repo.create({
      id: 'r1',
      participantId: 'p1',
      questionId: 'q1',
      sessionId: 'S1',
      optionChosen: 'Yes',
      answeredAt: new Date(),
    });

    const responses = repo.findBySession('S1');
    expect(responses.length).toBe(1);
    expect(responses[0].option_chosen).toBe('Yes');
  });

  test('should find responses by participant', () => {
    repo.create({ id: 'r1', participantId: 'p1', questionId: 'q1', sessionId: 'S1', optionChosen: 'No', answeredAt: new Date() });

    const responses = repo.findByParticipant('p1');
    expect(responses.length).toBe(1);
    expect(responses[0].participant_id).toBe('p1');
  });

  test('should enforce unique participant+question constraint', () => {
    repo.create({ id: 'r1', participantId: 'p1', questionId: 'q1', sessionId: 'S1', optionChosen: 'Yes', answeredAt: new Date() });

    expect(() => {
      repo.create({ id: 'r2', participantId: 'p1', questionId: 'q1', sessionId: 'S1', optionChosen: 'No', answeredAt: new Date() });
    }).toThrow();
  });

  test('should convert row to Response model', () => {
    const now = new Date();
    repo.create({ id: 'r1', participantId: 'p1', questionId: 'q1', sessionId: 'S1', optionChosen: 'Yes', answeredAt: now });

    const rows = repo.findBySession('S1');
    const response = ResponseRepository.rowToResponse(rows[0]);
    expect(response.id).toBe('r1');
    expect(response.participantId).toBe('p1');
    expect(response.optionChosen).toBe('Yes');
  });
});

describe('LedgerRepository', () => {
  let db: DatabaseInstance;
  let repo: LedgerRepository;

  beforeEach(() => {
    db = initTestDatabase();
    repo = new LedgerRepository(db);
  });

  test('should add transaction and get balance', () => {
    repo.addTransaction({ id: 'txn-1', participantId: 'p1', amount: 10, reason: 'INITIAL_VYBES', createdAt: new Date() });
    expect(repo.getBalance('p1')).toBe(10);
  });

  test('should handle negative transactions (deductions)', () => {
    repo.addTransaction({ id: 'txn-1', participantId: 'p1', amount: 10, reason: 'INITIAL_VYBES', createdAt: new Date() });
    repo.addTransaction({ id: 'txn-2', participantId: 'p1', amount: -5, reason: 'UNLOCK_MATCH_ALL', createdAt: new Date() });
    expect(repo.getBalance('p1')).toBe(5);
  });

  test('should return 0 balance for unknown participant', () => {
    expect(repo.getBalance('nobody')).toBe(0);
  });

  test('should get history ordered newest first', () => {
    const t1 = new Date('2024-01-01');
    const t2 = new Date('2024-01-02');
    repo.addTransaction({ id: 'txn-1', participantId: 'p1', amount: 10, reason: 'INITIAL_VYBES', createdAt: t1 });
    repo.addTransaction({ id: 'txn-2', participantId: 'p1', amount: -3, reason: 'UNLOCK_MATCH_TOP3', createdAt: t2 });

    const history = repo.getHistory('p1');
    expect(history.length).toBe(2);
    expect(history[0].id).toBe('txn-2'); // newest first
  });

  test('should get all transactions', () => {
    repo.addTransaction({ id: 'txn-1', participantId: 'p1', amount: 10, reason: 'INITIAL_VYBES', createdAt: new Date() });
    repo.addTransaction({ id: 'txn-2', participantId: 'p2', amount: 10, reason: 'INITIAL_VYBES', createdAt: new Date() });
    expect(repo.getAll().length).toBe(2);
  });

  test('should convert row to LedgerEntry', () => {
    repo.addTransaction({ id: 'txn-1', participantId: 'p1', amount: 10, reason: 'INITIAL_VYBES', createdAt: new Date() });
    const rows = repo.getAll();
    const entry = LedgerRepository.rowToLedgerEntry(rows[0]);
    expect(entry.id).toBe('txn-1');
    expect(entry.participantId).toBe('p1');
    expect(entry.amount).toBe(10);
    expect(entry.reason).toBe('INITIAL_VYBES');
    expect(entry.createdAt).toBeInstanceOf(Date);
  });
});

describe('UnlockRepository', () => {
  let db: DatabaseInstance;
  let repo: UnlockRepository;

  beforeEach(() => {
    db = initTestDatabase();
    repo = new UnlockRepository(db);
  });

  test('should create and check unlock', () => {
    repo.create({ id: 'u1', participantId: 'p1', resourceId: 'session:S1', feature: 'MATCH_ALL', createdAt: new Date() });
    expect(repo.hasUnlock('p1', 'session:S1', 'MATCH_ALL')).toBe(true);
    expect(repo.hasUnlock('p1', 'session:S1', 'MATCH_TOP3')).toBe(false); // tier hierarchy is in ParticipantUnlockManager, not repo
  });

  test('should be idempotent (INSERT OR IGNORE)', () => {
    repo.create({ id: 'u1', participantId: 'p1', resourceId: 'session:S1', feature: 'MATCH_ALL', createdAt: new Date() });
    // Should not throw
    repo.create({ id: 'u2', participantId: 'p1', resourceId: 'session:S1', feature: 'MATCH_ALL', createdAt: new Date() });
    expect(repo.getAll().length).toBe(1);
  });

  test('should get unlocks by participant', () => {
    repo.create({ id: 'u1', participantId: 'p1', resourceId: 'session:S1', feature: 'MATCH_ALL', createdAt: new Date() });
    repo.create({ id: 'u2', participantId: 'p1', resourceId: 'session:S2', feature: 'MATCH_TOP3', createdAt: new Date() });

    expect(repo.getUnlocks('p1').length).toBe(2);
    expect(repo.getUnlocks('p1', 'session:S1').length).toBe(1);
  });

  test('should convert row to FeatureUnlock', () => {
    repo.create({ id: 'u1', participantId: 'p1', resourceId: 'session:S1', feature: 'MATCH_ALL', createdAt: new Date() });
    const rows = repo.getAll();
    const unlock = UnlockRepository.rowToFeatureUnlock(rows[0]);
    expect(unlock.id).toBe('u1');
    expect(unlock.feature).toBe('MATCH_ALL');
  });
});

describe('StripeSessionRepository', () => {
  let db: DatabaseInstance;
  let repo: StripeSessionRepository;

  beforeEach(() => {
    db = initTestDatabase();
    repo = new StripeSessionRepository(db);
  });

  test('should mark session as processed and check', () => {
    expect(repo.isProcessed('cs_test_123')).toBe(false);
    repo.markProcessed('cs_test_123');
    expect(repo.isProcessed('cs_test_123')).toBe(true);
  });

  test('should be idempotent (INSERT OR IGNORE)', () => {
    repo.markProcessed('cs_test_123');
    repo.markProcessed('cs_test_123'); // should not throw
    expect(repo.isProcessed('cs_test_123')).toBe(true);
  });
});

describe('UserRepository', () => {
  let db: DatabaseInstance;
  let repo: UserRepository;

  beforeEach(() => {
    db = initTestDatabase();
    repo = new UserRepository(db);
  });

  test('should upsert and find by Twitter ID', () => {
    const user = repo.upsertByTwitterId({
      id: 'user-1',
      twitterId: '12345',
      username: 'alice',
      displayName: 'Alice',
      profileImageUrl: 'https://example.com/alice.jpg',
    });

    expect(user.id).toBe('user-1');
    expect(user.username).toBe('alice');

    const found = repo.findByTwitterId('12345');
    expect(found).toBeDefined();
    expect(found!.display_name).toBe('Alice');
  });

  test('should find by internal ID', () => {
    repo.upsertByTwitterId({ id: 'user-1', twitterId: '12345', username: 'alice', displayName: 'Alice' });

    const found = repo.findById('user-1');
    expect(found).toBeDefined();
    expect(found!.twitter_id).toBe('12345');
  });

  test('should return undefined for non-existent user', () => {
    expect(repo.findById('nope')).toBeUndefined();
    expect(repo.findByTwitterId('nope')).toBeUndefined();
  });

  test('should update existing user on upsert (same Twitter ID)', () => {
    repo.upsertByTwitterId({ id: 'user-1', twitterId: '12345', username: 'alice_old', displayName: 'Alice Old' });
    const updated = repo.upsertByTwitterId({ id: 'user-2', twitterId: '12345', username: 'alice_new', displayName: 'Alice New' });

    // Should keep original id but update fields
    expect(updated.id).toBe('user-1'); // original ID preserved
    expect(updated.username).toBe('alice_new');
    expect(updated.display_name).toBe('Alice New');
  });
});
