import type { WebSocket } from 'ws';
import { QuizSession } from '../models/QuizSession';
import type { Participant } from '../models/Participant';
import type { Question } from '../models/Question';
import type { Response } from '../models/Response';
import { MatchingService } from './MatchingService';
import { BillingService } from './BillingService';
import { VybeLedger } from '../models/VybeLedger';
import { ParticipantUnlockManager } from '../models/ParticipantUnlock';
import { QuotaManager } from '../models/QuotaManager';
import { generateParticipantId, generateQuestionId, generateResponseId } from '../utils/idGenerator';
import type { ClientMessage, ServerMessage, QuizState, ParticipantInfo, MatchResult, MatchTier, UnlockableFeature } from '../../shared/types';
import type { DatabaseInstance } from '../db/database';
import { SessionRepository } from '../db/repositories/SessionRepository';
import { ResponseRepository } from '../db/repositories/ResponseRepository';
import { LedgerRepository } from '../db/repositories/LedgerRepository';
import { UnlockRepository } from '../db/repositories/UnlockRepository';
import { StripeSessionRepository } from '../db/repositories/StripeSessionRepository';
import logger from '../utils/logger';

// Pricing constants
const FEATURE_COSTS: Record<UnlockableFeature, number> = {
  MATCH_PREVIEW: 0,
  MATCH_TOP3: 2,
  MATCH_ALL: 5,
  QUESTION_LIMIT_10: 3,
};

const INITIAL_VYBES = 10;

export class WebSocketHandler {
  private sessions: Map<string, QuizSession> = new Map();
  private connections: Map<WebSocket, { sessionId: string; participantId: string }> = new Map();
  private matchingService: MatchingService = new MatchingService();
  
  // Billing dependencies
  private vybeLedger: VybeLedger;
  private participantUnlock: ParticipantUnlockManager;
  private quotaManager: QuotaManager;
  private billingService: BillingService;

  // DB repositories (optional — undefined when no DB)
  private db?: DatabaseInstance;
  private sessionRepo?: SessionRepository;
  private responseRepo?: ResponseRepository;

  constructor(options?: { vybeLedger?: VybeLedger; db?: DatabaseInstance }) {
    // Initialize DB repositories if database provided
    const db = options?.db;
    this.db = db;
    if (db) {
      this.sessionRepo = new SessionRepository(db);
      this.responseRepo = new ResponseRepository(db);
    }

    const ledgerRepo = db ? new LedgerRepository(db) : undefined;
    const unlockRepo = db ? new UnlockRepository(db) : undefined;

    // Use provided VybeLedger or create new one (with optional DB write-through)
    this.vybeLedger = options?.vybeLedger || new VybeLedger(ledgerRepo);
    this.participantUnlock = new ParticipantUnlockManager(unlockRepo);
    this.quotaManager = new QuotaManager(this.participantUnlock);
    this.billingService = new BillingService({
      vybeLedger: this.vybeLedger,
      participantUnlock: this.participantUnlock,
      quotaManager: this.quotaManager,
    });

    // Hydrate active sessions from DB on startup
    if (this.sessionRepo) {
      this.hydrateFromDB();
    }
  }

  /**
   * Get the StripeSessionRepository (for sharing with StripeService)
   */
  getStripeSessionRepo(): StripeSessionRepository | undefined {
    return this.db ? new StripeSessionRepository(this.db) : undefined;
  }

  /**
   * Hydrate in-memory sessions from the database on startup.
   */
  private hydrateFromDB(): void {
    if (!this.sessionRepo || !this.responseRepo) return;

    const activeSessionRows = this.sessionRepo.findActive();
    for (const row of activeSessionRows) {
      // Reconstruct QuizSession from DB rows
      const session = QuizSession.fromDB({
        sessionId: row.id,
        ownerId: row.owner_id,
        status: row.status,
        resultsReleased: row.results_released === 1,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
      });

      // Load participants
      const participantRows = this.sessionRepo.getParticipantsBySession(row.id);
      for (const pRow of participantRows) {
        const participant = SessionRepository.rowToParticipant(pRow);
        // Mark all as inactive on startup (no WebSocket yet)
        participant.isActive = false;
        session.addParticipant(participant);
      }

      // Load questions
      const questionRows = this.sessionRepo.getQuestionsBySession(row.id);
      for (const qRow of questionRows) {
        const question = SessionRepository.rowToQuestion(qRow);
        session.addQuestion(question);
      }

      // Load responses
      const responseRows = this.responseRepo.findBySession(row.id);
      for (const rRow of responseRows) {
        const response = ResponseRepository.rowToResponse(rRow);
        session.responses.push(response); // Direct push to avoid re-validation
      }

      this.sessions.set(session.sessionId, session);
    }

    logger.info({ count: activeSessionRows.length }, 'Hydrated sessions from database');
  }

  /**
   * Get the VybeLedger instance (for sharing with other services)
   */
  getVybeLedger(): VybeLedger {
    return this.vybeLedger;
  }

  handleConnection(ws: WebSocket) {
    logger.info('Client connected');

    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        logger.error({ err: error }, 'Error parsing WebSocket message');
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      logger.error({ err: error }, 'WebSocket connection error');
    });
  }

  private handleMessage(ws: WebSocket, message: ClientMessage) {
    switch (message.type) {
      case 'session:create':
        this.handleSessionCreate(ws, message.data);
        break;
      case 'session:join':
        this.handleSessionJoin(ws, message.data);
        break;
      case 'session:reconnect':
        this.handleSessionReconnect(ws, message.data);
        break;
      case 'session:start':
        this.handleSessionStart(ws);
        break;
      case 'session:release-results':
        this.handleSessionReleaseResults(ws);
        break;
      case 'question:add':
        this.handleQuestionAdd(ws, message.data);
        break;
      case 'question:unlock-limit':
        this.handleQuestionUnlockLimit(ws);
        break;
      case 'response:submit':
        this.handleResponseSubmit(ws, message.data);
        break;
      case 'matches:get':
        this.handleMatchesGet(ws, message.data);
        break;
      case 'credits:balance':
        this.handleCreditsBalance(ws);
        break;
      case 'credits:history':
        this.handleCreditsHistory(ws);
        break;
      case 'ping':
        this.send(ws, { type: 'pong', timestamp: Date.now() });
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private handleSessionCreate(ws: WebSocket, data: { username?: string }) {
    // Prevent creating more than one session per connection
    const existing = this.connections.get(ws);
    if (existing) {
      const existingSession = this.sessions.get(existing.sessionId);
      if (existingSession && existingSession.status !== 'expired') {
        this.sendError(ws, 'You already have an active session');
        return;
      }
    }

    const participantId = generateParticipantId();
    const session = new QuizSession(participantId);

    const owner: Participant = {
      id: participantId,
      username: data.username || null,
      connection: ws,
      isOwner: true,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true
    };

    session.addParticipant(owner);
    this.sessions.set(session.sessionId, session);
    this.connections.set(ws, { sessionId: session.sessionId, participantId });

    // Persist to DB
    if (this.sessionRepo) {
      this.sessionRepo.createSession({
        id: session.sessionId,
        ownerId: session.ownerId,
        status: session.status,
        resultsReleased: session.resultsReleased,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      });
      this.sessionRepo.addParticipant({
        id: owner.id,
        sessionId: session.sessionId,
        username: owner.username,
        isOwner: owner.isOwner,
        isActive: owner.isActive,
        joinedAt: owner.joinedAt,
        lastActiveAt: owner.lastActiveAt,
      });
    }

    // Grant initial Vybes
    this.grantInitialVybes(participantId);
    const vybesBalance = this.billingService.getBalance(participantId);

    this.send(ws, {
      type: 'session:created',
      data: { sessionId: session.sessionId, participantId, vybesBalance }
    });

    this.sendQuizState(ws, session, participantId);
  }

  private handleSessionJoin(ws: WebSocket, data: { sessionId: string; username?: string }) {
    const session = this.sessions.get(data.sessionId);

    if (!session) {
      this.sendError(ws, `Session ${data.sessionId} not found`);
      return;
    }

    const participantId = generateParticipantId();
    const participant: Participant = {
      id: participantId,
      username: data.username || `guest_${participantId.slice(0, 6)}`,
      connection: ws,
      isOwner: false,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true
    };

    session.addParticipant(participant);
    this.connections.set(ws, { sessionId: session.sessionId, participantId });

    // Persist participant to DB
    if (this.sessionRepo) {
      this.sessionRepo.addParticipant({
        id: participant.id,
        sessionId: session.sessionId,
        username: participant.username,
        isOwner: participant.isOwner,
        isActive: participant.isActive,
        joinedAt: participant.joinedAt,
        lastActiveAt: participant.lastActiveAt,
      });
    }

    // Grant initial Vybes
    this.grantInitialVybes(participantId);
    const vybesBalance = this.billingService.getBalance(participantId);

    this.send(ws, {
      type: 'session:joined',
      data: { sessionId: session.sessionId, participantId, isOwner: false, vybesBalance }
    });

    this.sendQuizState(ws, session, participantId);
    this.broadcastToSession(session, {
      type: 'participant:joined',
      data: this.toParticipantInfo(participant)
    }, ws);
  }

  private handleSessionReconnect(ws: WebSocket, data: { sessionId: string; participantId: string }) {
    const session = this.sessions.get(data.sessionId);

    if (!session) {
      this.sendError(ws, `Session ${data.sessionId} not found`);
      return;
    }

    const participant = session.participants.get(data.participantId);
    if (!participant) {
      this.sendError(ws, `Participant ${data.participantId} not found in session`);
      return;
    }

    // Reattach WebSocket connection
    participant.connection = ws;
    participant.isActive = true;
    participant.lastActiveAt = new Date();
    this.connections.set(ws, { sessionId: session.sessionId, participantId: participant.id });

    // Persist reconnect to DB
    if (this.sessionRepo) {
      this.sessionRepo.updateParticipantActive(participant.id, true);
    }

    const vybesBalance = this.billingService.getBalance(participant.id);

    this.send(ws, {
      type: 'session:reconnected',
      data: {
        sessionId: session.sessionId,
        participantId: participant.id,
        isOwner: participant.isOwner,
        vybesBalance,
      },
    });

    this.sendQuizState(ws, session, participant.id);

    // Notify other participants
    this.broadcastToSession(session, {
      type: 'participant:joined',
      data: this.toParticipantInfo(participant),
    }, ws);

    logger.info({ participantId: participant.id, sessionId: session.sessionId }, 'Participant reconnected');
  }

  private handleQuestionAdd(ws: WebSocket, data: { prompt: string; options: [string, string]; timer?: number; ownerResponse?: string }) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const session = this.sessions.get(connectionInfo.sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    const isOwner = session.canAddQuestion(connectionInfo.participantId);
    if (!isOwner) {
      this.sendError(ws, 'Only owner can add questions');
      return;
    }

    // Check quota limit
    const currentQuestionCount = session.questions.length;
    const canAdd = this.quotaManager.canAddQuestion({
      participantId: connectionInfo.participantId,
      sessionId: session.sessionId,
      currentCount: currentQuestionCount,
      isOwner: true,
    });

    if (!canAdd) {
      const maxLimit = this.quotaManager.getQuestionLimit(connectionInfo.participantId, session.sessionId);
      this.send(ws, {
        type: 'question:limit-reached',
        data: {
          current: currentQuestionCount,
          max: maxLimit,
          upgradeCost: FEATURE_COSTS.QUESTION_LIMIT_10,
        },
      });
      return;
    }

    const question: Question = {
      id: generateQuestionId(),
      prompt: data.prompt,
      options: data.options,
      timer: data.timer,
      addedAt: new Date()
    };

    try {
      session.addQuestion(question);

      // Persist question to DB
      if (this.sessionRepo) {
        this.sessionRepo.addQuestion({
          id: question.id,
          sessionId: session.sessionId,
          prompt: question.prompt,
          options: question.options,
          timer: question.timer,
          sortOrder: session.quiz.length - 1,
          addedAt: question.addedAt,
        });
      }
      
      // If owner provided a response, record it
      if (data.ownerResponse) {
        const ownerResponse: Response = {
          id: generateResponseId(),
          participantId: connectionInfo.participantId,
          questionId: question.id,
          sessionId: session.sessionId,
          optionChosen: data.ownerResponse,
          answeredAt: new Date()
        };
        session.recordResponse(ownerResponse);

        // Persist owner response to DB
        if (this.responseRepo) {
          this.responseRepo.create({
            id: ownerResponse.id,
            participantId: ownerResponse.participantId,
            questionId: ownerResponse.questionId,
            sessionId: ownerResponse.sessionId,
            optionChosen: ownerResponse.optionChosen,
            answeredAt: ownerResponse.answeredAt,
          });
        }
      }
      
      this.broadcastToSession(session, {
        type: 'question:added',
        data: { question }
      });
      
      // Send updated quiz state to owner (includes their response if recorded)
      this.sendQuizState(ws, session, connectionInfo.participantId);
      
      this.broadcastToSession(session, {
        type: 'notification',
        message: 'New question added!'
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error, sessionId: session.sessionId }, 'Failed to add question');
      this.sendError(ws, 'Failed to add question');
    }
  }

  private handleQuestionUnlockLimit(ws: WebSocket) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const session = this.sessions.get(connectionInfo.sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    const isOwner = session.canAddQuestion(connectionInfo.participantId);
    if (!isOwner) {
      this.sendError(ws, 'Only owner can unlock question limit');
      return;
    }

    const resourceId = `session:${session.sessionId}`;
    const result = this.billingService.purchaseOrVerifyAccess({
      participantId: connectionInfo.participantId,
      resourceId,
      feature: 'QUESTION_LIMIT_10',
      cost: FEATURE_COSTS.QUESTION_LIMIT_10,
      isOwner: true,
    });

    if (result.error === 'INSUFFICIENT_VYBES') {
      this.send(ws, {
        type: 'credits:insufficient',
        data: {
          feature: 'QUESTION_LIMIT_10',
          required: FEATURE_COSTS.QUESTION_LIMIT_10,
          current: result.balance,
        },
      });
      return;
    }

    if (result.granted) {
      const newLimit = this.quotaManager.getQuestionLimit(connectionInfo.participantId, session.sessionId);
      this.send(ws, {
        type: 'question:limit-unlocked',
        data: {
          newLimit,
          vybesBalance: result.balance,
        },
      });
    }
  }

  private handleResponseSubmit(ws: WebSocket, data: { questionId: string; optionChosen: string }) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const session = this.sessions.get(connectionInfo.sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    const response: Response = {
      id: generateResponseId(),
      participantId: connectionInfo.participantId,
      questionId: data.questionId,
      sessionId: session.sessionId,
      optionChosen: data.optionChosen,
      answeredAt: new Date()
    };

    try {
      session.recordResponse(response);

      // Persist response to DB
      if (this.responseRepo) {
        this.responseRepo.create({
          id: response.id,
          participantId: response.participantId,
          questionId: response.questionId,
          sessionId: response.sessionId,
          optionChosen: response.optionChosen,
          answeredAt: response.answeredAt,
        });
      }

      this.sendQuizState(ws, session, connectionInfo.participantId);
      this.broadcastToSession(session, {
        type: 'response:recorded',
        data: { participantId: connectionInfo.participantId, questionId: data.questionId }
      }, ws);

      // Send updated progress to the owner so they see real-time completion
      const owner = Array.from(session.participants.values()).find(p => p.isOwner);
      if (owner && owner.connection && owner.id !== connectionInfo.participantId && owner.isActive) {
        this.sendQuizState(owner.connection, session, owner.id);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error, sessionId: session.sessionId }, 'Failed to record response');
      this.sendError(ws, 'Failed to submit response');
    }
  }

  private handleSessionStart(ws: WebSocket) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const session = this.sessions.get(connectionInfo.sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    if (!session.canAddQuestion(connectionInfo.participantId)) {
      this.sendError(ws, 'Only owner can start the session');
      return;
    }

    try {
      session.startSession();

      // Persist status change to DB
      if (this.sessionRepo) {
        this.sessionRepo.updateStatus(session.sessionId, session.status);
      }

      this.broadcastToSession(session, { type: 'session:started' });
      // Send updated quiz state to all participants
      for (const participant of session.participants.values()) {
        if (participant.connection && participant.isActive) {
          this.sendQuizState(participant.connection, session, participant.id);
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error, sessionId: session.sessionId }, 'Failed to start session');
      this.sendError(ws, 'Failed to start session');
    }
  }

  private handleSessionReleaseResults(ws: WebSocket) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const session = this.sessions.get(connectionInfo.sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    if (!session.canAddQuestion(connectionInfo.participantId)) {
      this.sendError(ws, 'Only owner can release results');
      return;
    }

    try {
      session.releaseResults();

      // Persist results release to DB
      if (this.sessionRepo) {
        this.sessionRepo.updateResultsReleased(session.sessionId, true);
        this.sessionRepo.updateStatus(session.sessionId, session.status);
      }

      this.broadcastToSession(session, { type: 'session:results-released' });
      // Send updated quiz state to all participants
      for (const participant of session.participants.values()) {
        if (participant.connection && participant.isActive) {
          this.sendQuizState(participant.connection, session, participant.id);
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error, sessionId: session.sessionId }, 'Failed to release results');
      this.sendError(ws, 'Failed to release results');
    }
  }

  private handleMatchesGet(ws: WebSocket, data?: { tier?: MatchTier }) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const session = this.sessions.get(connectionInfo.sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    // Gate results on owner releasing them (owner can always see)
    const isOwner = session.canAddQuestion(connectionInfo.participantId);
    if (!session.resultsReleased && !isOwner) {
      this.sendError(ws, 'Results have not been released yet. Please wait for the host.');
      return;
    }

    const tier: MatchTier = data?.tier || 'PREVIEW';
    const resourceId = `session:${session.sessionId}`;

    // Map tier to feature
    const featureMap: Record<MatchTier, UnlockableFeature> = {
      PREVIEW: 'MATCH_PREVIEW',
      TOP3: 'MATCH_TOP3',
      ALL: 'MATCH_ALL',
    };
    const feature = featureMap[tier];
    const cost = FEATURE_COSTS[feature];

    // Check billing (idempotent - won't charge twice)
    const result = this.billingService.purchaseOrVerifyAccess({
      participantId: connectionInfo.participantId,
      resourceId,
      feature,
      cost,
    });

    if (result.error === 'INSUFFICIENT_VYBES') {
      this.send(ws, {
        type: 'credits:insufficient',
        data: {
          feature,
          required: cost,
          current: result.balance,
        },
      });
      return;
    }

    // Get all matches and slice based on tier
    const allMatches = this.matchingService.getMatchesForParticipant(connectionInfo.participantId, session);
    const matchResults: MatchResult[] = allMatches.map(m => ({
      participantId: m.participantId,
      username: session.participants.get(m.participantId)?.username || null,
      matchPercentage: m.matchPercentage
    }));

    // Slice results based on tier
    let tieredMatches: MatchResult[];
    switch (tier) {
      case 'PREVIEW':
        // Return 2 matches from the middle
        const midStart = Math.floor(matchResults.length / 2) - 1;
        tieredMatches = matchResults.slice(Math.max(0, midStart), midStart + 2);
        break;
      case 'TOP3':
        tieredMatches = matchResults.slice(0, 3);
        break;
      case 'ALL':
        tieredMatches = matchResults;
        break;
      default:
        tieredMatches = [];
    }

    this.send(ws, {
      type: 'matches:result',
      data: {
        tier,
        matches: tieredMatches,
        cost: result.charged ? cost : 0,
        vybesBalance: result.balance,
      },
    });
  }

  private handleCreditsBalance(ws: WebSocket) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const balance = this.billingService.getBalance(connectionInfo.participantId);
    this.send(ws, {
      type: 'credits:balance',
      data: { balance },
    });
  }

  private handleCreditsHistory(ws: WebSocket) {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      this.sendError(ws, 'Not in a session');
      return;
    }

    const transactions = this.billingService.getTransactionHistory(connectionInfo.participantId);
    this.send(ws, {
      type: 'credits:history',
      data: { transactions },
    });
  }

  /**
   * Grant initial Vybes to new participants (idempotent)
   */
  private grantInitialVybes(participantId: string) {
    // Check if participant already has transactions (prevent duplicate grants)
    const existingTransactions = this.vybeLedger.getTransactionHistory(participantId);
    if (existingTransactions.length === 0) {
      this.billingService.addVybes({
        participantId,
        amount: INITIAL_VYBES,
        reason: 'INITIAL_VYBES',
      });
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      const session = this.sessions.get(connectionInfo.sessionId);
      if (session) {
        const participant = session.participants.get(connectionInfo.participantId);
        if (participant) {
          participant.isActive = false;

          // Persist disconnect to DB
          if (this.sessionRepo) {
            this.sessionRepo.updateParticipantActive(connectionInfo.participantId, false);
          }

          this.broadcastToSession(session, {
            type: 'participant:left',
            data: { participantId: connectionInfo.participantId }
          });
        }
      }
      this.connections.delete(ws);
    }
    logger.info({ participantId: connectionInfo?.participantId }, 'Client disconnected');
  }

  private sendQuizState(ws: WebSocket, session: QuizSession, participantId: string) {
    const isOwner = session.canAddQuestion(participantId);

    const quizState: QuizState = {
      sessionId: session.sessionId,
      ownerId: session.ownerId,
      status: session.status,
      questions: session.questions,
      participants: Array.from(session.participants.values()).map(p => this.toParticipantInfo(p)),
      participantCount: session.getParticipantCount(),
      activeParticipantCount: session.getActiveParticipantCount(),
      myResponses: session.getResponseValuesForParticipant(participantId),
      myCompletionStatus: session.hasParticipantCompletedQuiz(participantId),
      questionLimit: this.quotaManager.getQuestionLimit(participantId, session.sessionId),
      resultsReleased: session.resultsReleased,
      // Only send participant progress to the owner
      participantProgress: isOwner ? session.getParticipantProgress() : undefined,
    };

    this.send(ws, { type: 'quiz:state', data: quizState });
  }

  private broadcastToSession(session: QuizSession, message: ServerMessage, exclude?: WebSocket) {
    for (const participant of session.participants.values()) {
      if (participant.connection && participant.connection !== exclude && participant.isActive) {
        this.send(participant.connection, message);
      }
    }
  }

  private toParticipantInfo(participant: Participant): ParticipantInfo {
    return {
      id: participant.id,
      username: participant.username,
      isOwner: participant.isOwner,
      isActive: participant.isActive
    };
  }

  private send(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, message: string) {
    this.send(ws, { type: 'error', message });
  }
}
