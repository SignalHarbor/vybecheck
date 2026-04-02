import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initTestDatabase, type DatabaseInstance } from '../../src/server/db/database';
import { SessionRepository } from '../../src/server/db/repositories/SessionRepository';
import { ResponseRepository } from '../../src/server/db/repositories/ResponseRepository';
import { LedgerRepository } from '../../src/server/db/repositories/LedgerRepository';
import { UnlockRepository } from '../../src/server/db/repositories/UnlockRepository';
import { StripeSessionRepository } from '../../src/server/db/repositories/StripeSessionRepository';
import { VybeLedger } from '../../src/server/models/VybeLedger';
import { ParticipantUnlockManager } from '../../src/server/models/ParticipantUnlock';
import { QuizSession } from '../../src/server/models/QuizSession';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Persistence Integration', () => {
  let dbPath: string;

  beforeEach(() => {
    // Use a temp file so we can close and re-open the DB
    dbPath = path.join(os.tmpdir(), `vybecheck-test-${Date.now()}.db`);
  });

  afterEach(() => {
    // Clean up temp file
    try { fs.unlinkSync(dbPath); } catch {}
    try { fs.unlinkSync(dbPath + '-wal'); } catch {}
    try { fs.unlinkSync(dbPath + '-shm'); } catch {}
  });

  function openDB(): DatabaseInstance {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, twitter_id TEXT UNIQUE, username TEXT, display_name TEXT,
        profile_image_url TEXT, access_token TEXT, refresh_token TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('live', 'active', 'expired')),
        results_released INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
        user_id TEXT REFERENCES users(id), username TEXT,
        is_owner INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
        joined_at TEXT NOT NULL, last_active_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
        prompt TEXT NOT NULL, option_a TEXT NOT NULL, option_b TEXT NOT NULL,
        timer INTEGER, sort_order INTEGER NOT NULL, added_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        participant_id TEXT NOT NULL REFERENCES participants(id),
        question_id TEXT NOT NULL REFERENCES questions(id),
        session_id TEXT NOT NULL REFERENCES sessions(id),
        option_chosen TEXT NOT NULL, answered_at TEXT NOT NULL,
        UNIQUE(participant_id, question_id)
      );
      CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY, participant_id TEXT NOT NULL,
        amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feature_unlocks (
        id TEXT PRIMARY KEY, participant_id TEXT NOT NULL,
        resource_id TEXT NOT NULL, feature TEXT NOT NULL,
        created_at TEXT NOT NULL, UNIQUE(participant_id, resource_id, feature)
      );
      CREATE TABLE IF NOT EXISTS processed_stripe_sessions (
        session_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL
      );
    `);
    return db;
  }

  test('session, questions, and responses survive DB close and reopen', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // --- Phase 1: Write data ---
    const db1 = openDB();
    const sessionRepo1 = new SessionRepository(db1);
    const responseRepo1 = new ResponseRepository(db1);

    sessionRepo1.createSession({ id: 'SESS01', ownerId: 'p1', status: 'live', resultsReleased: false, createdAt: now, expiresAt: expires });
    sessionRepo1.addParticipant({ id: 'p1', sessionId: 'SESS01', username: '@owner', isOwner: true, isActive: true, joinedAt: now, lastActiveAt: now });
    sessionRepo1.addParticipant({ id: 'p2', sessionId: 'SESS01', username: '@joiner', isOwner: false, isActive: true, joinedAt: now, lastActiveAt: now });
    sessionRepo1.addQuestion({ id: 'q1', sessionId: 'SESS01', prompt: 'Is BTC the future?', options: ['Agree', 'Disagree'], sortOrder: 0, addedAt: now });
    sessionRepo1.addQuestion({ id: 'q2', sessionId: 'SESS01', prompt: 'ETH > BTC?', options: ['Yes', 'No'], sortOrder: 1, addedAt: now });
    responseRepo1.create({ id: 'r1', participantId: 'p1', questionId: 'q1', sessionId: 'SESS01', optionChosen: 'Agree', answeredAt: now });
    responseRepo1.create({ id: 'r2', participantId: 'p2', questionId: 'q1', sessionId: 'SESS01', optionChosen: 'Disagree', answeredAt: now });

    sessionRepo1.updateStatus('SESS01', 'active');

    db1.close();

    // --- Phase 2: Reopen and verify ---
    const db2 = openDB();
    const sessionRepo2 = new SessionRepository(db2);
    const responseRepo2 = new ResponseRepository(db2);

    const session = sessionRepo2.findById('SESS01');
    expect(session).toBeDefined();
    expect(session!.status).toBe('active');

    const participants = sessionRepo2.getParticipantsBySession('SESS01');
    expect(participants.length).toBe(2);

    const questions = sessionRepo2.getQuestionsBySession('SESS01');
    expect(questions.length).toBe(2);
    expect(questions[0].prompt).toBe('Is BTC the future?');

    const responses = responseRepo2.findBySession('SESS01');
    expect(responses.length).toBe(2);
    expect(responses.find(r => r.participant_id === 'p1')!.option_chosen).toBe('Agree');

    db2.close();
  });

  test('VybeLedger write-through persists across restart', () => {
    // --- Phase 1: Write via VybeLedger ---
    const db1 = openDB();
    const ledgerRepo1 = new LedgerRepository(db1);
    const ledger1 = new VybeLedger(ledgerRepo1);

    ledger1.addVybes({ participantId: 'p1', amount: 10, reason: 'INITIAL_VYBES' });
    ledger1.deductVybes({ participantId: 'p1', amount: 3, reason: 'UNLOCK_MATCH_TOP3' });

    expect(ledger1.getBalance('p1')).toBe(7);
    db1.close();

    // --- Phase 2: Reconstruct from DB ---
    const db2 = openDB();
    const ledgerRepo2 = new LedgerRepository(db2);
    const ledger2 = new VybeLedger(ledgerRepo2);

    // Should hydrate from DB
    expect(ledger2.getBalance('p1')).toBe(7);
    expect(ledger2.getTransactionHistory('p1').length).toBe(2);
    db2.close();
  });

  test('ParticipantUnlockManager write-through persists across restart', () => {
    // --- Phase 1: Write ---
    const db1 = openDB();
    const unlockRepo1 = new UnlockRepository(db1);
    const manager1 = new ParticipantUnlockManager(unlockRepo1);

    manager1.createUnlock('p1', 'session:S1', 'MATCH_ALL');
    expect(manager1.hasUnlock('p1', 'session:S1', 'MATCH_ALL')).toBe(true);
    db1.close();

    // --- Phase 2: Reconstruct ---
    const db2 = openDB();
    const unlockRepo2 = new UnlockRepository(db2);
    const manager2 = new ParticipantUnlockManager(unlockRepo2);

    expect(manager2.hasUnlock('p1', 'session:S1', 'MATCH_ALL')).toBe(true);
    // Tier hierarchy should still work
    expect(manager2.hasUnlock('p1', 'session:S1', 'MATCH_TOP3')).toBe(true);
    expect(manager2.hasUnlock('p1', 'session:S1', 'MATCH_PREVIEW')).toBe(true);
    db2.close();
  });

  test('Stripe idempotency tracking persists across restart', () => {
    const db1 = openDB();
    const stripeRepo1 = new StripeSessionRepository(db1);
    stripeRepo1.markProcessed('cs_test_abc');
    db1.close();

    const db2 = openDB();
    const stripeRepo2 = new StripeSessionRepository(db2);
    expect(stripeRepo2.isProcessed('cs_test_abc')).toBe(true);
    expect(stripeRepo2.isProcessed('cs_test_other')).toBe(false);
    db2.close();
  });

  test('QuizSession.fromDB hydrates correctly', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const session = QuizSession.fromDB({
      sessionId: 'TEST01',
      ownerId: 'owner1',
      status: 'active',
      resultsReleased: true,
      createdAt: now,
      expiresAt: expires,
    });

    expect(session.sessionId).toBe('TEST01');
    expect(session.ownerId).toBe('owner1');
    expect(session.status).toBe('active');
    expect(session.resultsReleased).toBe(true);
    expect(session.questions).toEqual([]);
    expect(session.participants.size).toBe(0);
  });
});
