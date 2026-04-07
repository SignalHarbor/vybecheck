// Shared types between client and server

import type { Question } from '../server/models/Question';
import type { Participant } from '../server/models/Participant';
import type { Response } from '../server/models/Response';
import type { ParticipantProgress } from '../server/models/QuizSession';

// Match tiers for tiered access
export type MatchTier = 'PREVIEW' | 'TOP3' | 'ALL';

// Client → Server Messages
export type ClientMessage =
  | { type: 'session:create'; data: { username?: string } }
  | { type: 'session:join'; data: { sessionId: string; username?: string } }
  | { type: 'session:reconnect'; data: { sessionId: string; participantId: string } }
  | { type: 'session:leave' }
  | { type: 'session:start' }
  | { type: 'session:release-results' }
  | { type: 'question:add'; data: { prompt: string; options: [string, string]; timer?: number; ownerResponse?: string } }
  | { type: 'question:unlock-limit' }
  | { type: 'response:submit'; data: { questionId: string; optionChosen: string } }
  | { type: 'matches:get'; data?: { tier?: MatchTier } }
  | { type: 'credits:balance' }
  | { type: 'credits:history' }
  | { type: 'ping'; timestamp: number };

// Server → Client Messages
export type ServerMessage =
  | { type: 'session:created'; data: { sessionId: string; participantId: string; vybesBalance: number } }
  | { type: 'session:joined'; data: { sessionId: string; participantId: string; isOwner: boolean; vybesBalance: number } }
  | { type: 'session:reconnected'; data: { sessionId: string; participantId: string; isOwner: boolean; vybesBalance: number } }
  | { type: 'session:started' }
  | { type: 'session:results-released' }
  | { type: 'quiz:state'; data: QuizState }
  | { type: 'question:added'; data: { question: Question } }
  | { type: 'question:limit-reached'; data: { current: number; max: number; upgradeCost: number } }
  | { type: 'question:limit-unlocked'; data: { newLimit: number; vybesBalance: number } }
  | { type: 'participant:joined'; data: ParticipantInfo }
  | { type: 'participant:left'; data: { participantId: string } }
  | { type: 'response:recorded'; data: { participantId: string; questionId: string } }
  | { type: 'matches:result'; data: { tier: MatchTier; matches: MatchResult[]; cost: number; vybesBalance: number } }
  | { type: 'credits:balance'; data: { balance: number } }
  | { type: 'credits:history'; data: { transactions: LedgerEntry[] } }
  | { type: 'credits:insufficient'; data: { feature: UnlockableFeature; required: number; current: number } }
  | { type: 'notification'; message: string }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; message: string };

// Simplified types for client
export interface QuizState {
  sessionId: string;
  ownerId: string;
  status: 'live' | 'active' | 'expired';
  questions: Question[];
  participants: ParticipantInfo[];
  participantCount: number;
  activeParticipantCount: number;
  myResponses: string[]; // Response values in question order
  myCompletionStatus: boolean; // Has participant completed all questions
  questionLimit: number; // Server-authoritative question limit for this session
  resultsReleased: boolean;
  participantProgress?: ParticipantProgress[]; // Owner-only: completion % per participant
}

export interface ParticipantInfo {
  id: string;
  username: string | null;
  isOwner: boolean;
  isActive: boolean;
}

export interface MatchResult {
  participantId: string;
  username: string | null;
  matchPercentage: number;
}

// Vybes Monetization Types
export type UnlockableFeature =
  | 'MATCH_PREVIEW'
  | 'MATCH_TOP3'
  | 'MATCH_ALL'
  | 'QUESTION_LIMIT_10';

export type TransactionReason =
  | 'INITIAL_VYBES'
  | 'PURCHASE_VYBES'
  | 'UNLOCK_MATCH_TOP3'
  | 'UNLOCK_MATCH_ALL'
  | 'UNLOCK_QUESTION_LIMIT'
  | 'ADMIN_ISSUED';

export interface VybeTransaction {
  participantId: string;
  amount: number;
  reason: TransactionReason;
  timestamp: Date;
}

export interface LedgerEntry {
  id: string;
  participantId: string;
  amount: number;
  reason: TransactionReason;
  createdAt: Date;
}

export interface FeatureUnlock {
  id: string;
  participantId: string;
  resourceId: string; // Format: "session:{sessionId}"
  feature: UnlockableFeature;
  createdAt: Date;
}

export interface PurchaseResult {
  granted: boolean;
  charged: boolean;
  balance: number;
  error?: 'INSUFFICIENT_VYBES' | 'NOT_OWNER' | 'ALREADY_UNLOCKED';
}

export type {
  Participant,
  Question,
  ParticipantProgress
}
