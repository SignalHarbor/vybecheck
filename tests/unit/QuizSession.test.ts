import { describe, test, expect, beforeEach } from 'vitest';
import { QuizSession } from '../../src/server/models/QuizSession';
import type { Participant } from '../../src/server/models/Participant';

describe('QuizSession - Slice 1: Single-Session, Single-Owner Setup', () => {
  let ownerId: string;
  let quizSession: QuizSession;

  beforeEach(() => {
    ownerId = 'owner123';
    quizSession = new QuizSession(ownerId);
  });

  describe('Session Creation', () => {
    test('should create new quiz session with unique ID', () => {
      expect(quizSession.sessionId).toBeDefined();
      expect(quizSession.sessionId).toMatch(/^[a-zA-Z0-9]+$/); // alphanumeric mixed case
      expect(quizSession.sessionId.length).toBeGreaterThan(5);
    });

    test('should set owner ID correctly', () => {
      expect(quizSession.ownerId).toBe(ownerId);
    });

    test('should initialize with "live" status', () => {
      expect(quizSession.status).toBe('live');
    });

    test('should set createdAt timestamp', () => {
      expect(quizSession.createdAt).toBeInstanceOf(Date);
      expect(quizSession.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('should set expiresAt to 3 months from creation', () => {
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

      // Allow 1 second tolerance for test execution time
      const diff = Math.abs(quizSession.expiresAt.getTime() - threeMonthsFromNow.getTime());
      expect(diff).toBeLessThan(1000);
    });

    test('should initialize empty questions array', () => {
      expect(quizSession.questions).toEqual([]);
    });

    test('should initialize empty quiz (question IDs) array', () => {
      expect(quizSession.quiz).toEqual([]);
    });

    test('should initialize empty responses array', () => {
      expect(quizSession.responses).toEqual([]);
    });

    test('should initialize empty participants map', () => {
      expect(quizSession.participants).toBeInstanceOf(Map);
      expect(quizSession.participants.size).toBe(0);
    });
  });

  describe('Owner Participant Management', () => {
    test('should add owner as participant', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: null,
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);

      expect(quizSession.participants.size).toBe(1);
      expect(quizSession.participants.has(ownerId)).toBe(true);

      const addedParticipant = quizSession.participants.get(ownerId);
      expect(addedParticipant?.isOwner).toBe(true);
      expect(addedParticipant?.id).toBe(ownerId);
    });

    test('should retrieve participant by ID', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: 'OwnerUser',
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);
      const retrieved = quizSession.participants.get(ownerId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.username).toBe('OwnerUser');
      expect(retrieved?.isOwner).toBe(true);
    });

    test('should mark participant as owner correctly', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: null,
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);

      expect(quizSession.participants.get(ownerId)?.isOwner).toBe(true);
    });
    test('should not allow multiple owners', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: 'FirstOwner',
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);

      // Attempt to add a second owner
      const secondOwner: Participant = {
        id: 'owner456',
        username: 'SecondOwner',
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      // Should throw error when trying to add second owner
      expect(() => quizSession.addParticipant(secondOwner)).toThrow('Only one owner is allowed per session');

      // Verify only the first owner exists
      expect(quizSession.participants.size).toBe(1);
      expect(quizSession.participants.has(ownerId)).toBe(true);
      expect(quizSession.participants.has('owner456')).toBe(false);
    });

    test('should allow adding non-owner participants after owner', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: 'Owner',
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);

      const regularParticipant: Participant = {
        id: 'participant123',
        username: 'Regular',
        connection: null,
        isOwner: false,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      // Should successfully add non-owner participant
      expect(() => quizSession.addParticipant(regularParticipant)).not.toThrow();
      expect(quizSession.participants.size).toBe(2);
      expect(quizSession.participants.get('participant123')?.isOwner).toBe(false);
    });
  });

  describe('Session State', () => {
    test('should return complete session state', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: 'TestOwner',
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);
      const state = quizSession.getState();

      expect(state.sessionId).toBe(quizSession.sessionId);
      expect(state.ownerId).toBe(ownerId);
      expect(state.status).toBe('live');
      expect(state.questions).toEqual([]);
      expect(state.quiz).toEqual([]);
      expect(state.responses).toEqual([]);
      expect(state.participants).toBeInstanceOf(Map);
      expect(state.participants.size).toBe(1);
      expect(state.createdAt).toBeInstanceOf(Date);
      expect(state.expiresAt).toBeInstanceOf(Date);
    });

    test('should not be expired immediately after creation', () => {
      expect(quizSession.isExpired()).toBe(false);
    });
  });

  describe('Owner Permission Checks', () => {
    test('should identify owner correctly with canAddQuestion', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: null,
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);

      expect(quizSession.canAddQuestion(ownerId)).toBe(true);
    });

    test('should reject non-owner with canAddQuestion', () => {
      const ownerParticipant: Participant = {
        id: ownerId,
        username: null,
        connection: null,
        isOwner: true,
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      };

      quizSession.addParticipant(ownerParticipant);

      // Test with ID that is not the owner
      expect(quizSession.canAddQuestion('nonOwner456')).toBe(false);
    });

    test('should reject if participant does not exist', () => {
      // No participants added
      expect(quizSession.canAddQuestion('anyone')).toBe(false);
    });
  });
});
