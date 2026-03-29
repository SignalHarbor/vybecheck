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

  constructor(options?: { vybeLedger?: VybeLedger }) {
    // Use provided VybeLedger or create new one
    this.vybeLedger = options?.vybeLedger || new VybeLedger();
    this.participantUnlock = new ParticipantUnlockManager();
    this.quotaManager = new QuotaManager(this.participantUnlock);
    this.billingService = new BillingService({
      vybeLedger: this.vybeLedger,
      participantUnlock: this.participantUnlock,
      quotaManager: this.quotaManager,
    });
  }

  /**
   * Get the VybeLedger instance (for sharing with other services)
   */
  getVybeLedger(): VybeLedger {
    return this.vybeLedger;
  }

  handleConnection(ws: WebSocket) {
    console.log('Client connected');

    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Error parsing message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
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
      username: data.username || null,
      connection: ws,
      isOwner: false,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      isActive: true
    };

    session.addParticipant(participant);
    this.connections.set(ws, { sessionId: session.sessionId, participantId });

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
    } catch (error: any) {
      this.sendError(ws, error.message);
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
      this.sendQuizState(ws, session, connectionInfo.participantId);
      this.broadcastToSession(session, {
        type: 'response:recorded',
        data: { participantId: connectionInfo.participantId, questionId: data.questionId }
      }, ws);
    } catch (error: any) {
      this.sendError(ws, error.message);
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
          this.broadcastToSession(session, {
            type: 'participant:left',
            data: { participantId: connectionInfo.participantId }
          });
        }
      }
      this.connections.delete(ws);
    }
    console.log('Client disconnected');
  }

  private sendQuizState(ws: WebSocket, session: QuizSession, participantId: string) {
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
