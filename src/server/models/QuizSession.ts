import type { Question } from './Question';
import type { Response } from './Response';
import type { Participant } from './Participant';

export interface QuizSessionData {
  sessionId: string;
  ownerId: string;
  status: 'live' | 'active' | 'expired';
  questions: Question[];
  quiz: string[];                          // Ordered list of question IDs
  responses: Response[];                    // Flat array of all responses
  participants: Map<string, Participant>;  // All participants
  createdAt: Date;
  expiresAt: Date;
}

export class QuizSession {
  public readonly sessionId: string;
  public readonly ownerId: string;
  public status: 'live' | 'active' | 'expired';
  public questions: Question[];
  public quiz: string[];
  public responses: Response[];
  public participants: Map<string, Participant>;
  public readonly createdAt: Date;
  public readonly expiresAt: Date;

  constructor(ownerId: string) {
    // TODO make the effect of calling this constructor also be responsible for adding the first participant as the owner
    this.sessionId = this.generateSessionId();
    this.ownerId = ownerId;
    this.status = 'live';
    this.questions = [];
    this.quiz = [];
    this.responses = [];
    this.participants = new Map();
    this.createdAt = new Date();
    this.expiresAt = this.calculateExpirationDate();
  }

  /**
   * Generate a short, shareable session ID (6 chars)
   */
  private generateSessionId(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no i/l/o/0/1/I/L/O to avoid ambiguity
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  /**
   * Calculate expiration date (3 months from creation)
   * TODO is this default or for long running
   */
  private calculateExpirationDate(): Date {
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 3);
    return expires;
  }

  /**
   * Add a participant to the session
   * Validates that only one owner can exist
   */
  addParticipant(participant: Participant): void {
    // If trying to add an owner, check if one already exists
    if (participant.isOwner) {
      const existingOwner = Array.from(this.participants.values()).find(p => p.isOwner);
      if (existingOwner && existingOwner.id !== participant.id) {
        throw new Error('Only one owner is allowed per session');
      }
    }

    this.participants.set(participant.id, participant);
  }

  /**
   * Remove a participant from the session
   */
  removeParticipant(participantId: string): void {
    this.participants.delete(participantId);
  }

  /**
   * Add a question to the session
   * Validates question before adding
   */
  addQuestion(question: Question): void {
    // Validate question ID
    if (!question.id || question.id.trim() === '') {
      throw new Error('Question ID cannot be empty');
    }

    // Check for duplicate ID
    if (this.quiz.includes(question.id)) {
      throw new Error(`Question with ID ${question.id} already exists`);
    }

    // Validate prompt
    if (!question.prompt || question.prompt.trim() === '') {
      throw new Error('Question prompt cannot be empty');
    }

    // Validate options - must be exactly 2
    if (!question.options || question.options.length !== 2) {
      throw new Error('Question must have exactly 2 options');
    }

    this.questions.push(question);
    this.quiz.push(question.id);
  }

  /**
   * Record a response with validation
   */
  recordResponse(response: Response): void {
    // Validate participant ID
    if (!response.participantId || response.participantId.trim() === '') {
      throw new Error('Participant ID cannot be empty');
    }

    // Validate question ID
    if (!response.questionId || response.questionId.trim() === '') {
      throw new Error('Question ID cannot be empty');
    }

    // Validate option chosen
    if (!response.optionChosen || response.optionChosen.trim() === '') {
      throw new Error('Option chosen cannot be empty');
    }

    // Check if participant exists
    if (!this.participants.has(response.participantId)) {
      throw new Error(`Participant ${response.participantId} does not exist`);
    }

    // Check if question exists
    const question = this.questions.find(q => q.id === response.questionId);
    if (!question) {
      throw new Error(`Question ${response.questionId} does not exist`);
    }

    // Validate that option is valid for this question
    if (!question.options.includes(response.optionChosen)) {
      throw new Error(`Option ${response.optionChosen} is not valid for question ${response.questionId}`);
    }

    // Check for duplicate response (same participant + same question)
    const existingResponse = this.responses.find(
      r => r.participantId === response.participantId && r.questionId === response.questionId
    );
    if (existingResponse) {
      throw new Error(`Participant ${response.participantId} has already answered question ${response.questionId}`);
    }

    this.responses.push(response);
  }

  /**
   * Get all responses for a specific participant
   */
  getResponsesForParticipant(participantId: string): Response[] {
    return this.responses.filter(r => r.participantId === participantId);
  }

  /**
   * Get response values for a participant in question order
   * Returns an array of optionChosen values
   */
  getResponseValuesForParticipant(participantId: string): string[] {
    const responseMap = new Map<string, string>();

    this.responses
      .filter(r => r.participantId === participantId)
      .forEach(r => responseMap.set(r.questionId, r.optionChosen));

    return this.quiz.map(qId => responseMap.get(qId) || '');
  }

  /**
   * Get the current state of the quiz session
   */
  getState(): QuizSessionData {
    return {
      sessionId: this.sessionId,
      ownerId: this.ownerId,
      status: this.status,
      questions: this.questions,
      quiz: this.quiz,
      responses: this.responses,
      participants: this.participants,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt
    };
  }

  /**
   * Check if the session has expired
   */
  isExpired(): boolean {
    return Date.now() > this.expiresAt.getTime();
  }

  /**
   * Check if a participant can add questions (must be owner)
   */
  canAddQuestion(participantId: string): boolean {
    const participant = this.participants.get(participantId);
    return participant?.isOwner === true;
  }

  /**
   * Get a question by its ID
   */
  getQuestionById(questionId: string): Question | undefined {
    return this.questions.find(q => q.id === questionId);
  }

  /**
   * Get all questions
   */
  getAllQuestions(): Question[] {
    return this.questions;
  }

  /**
   * Get the total count of questions
   */
  getQuestionCount(): number {
    return this.questions.length;
  }

  /**
   * Get participant by ID
   */
  getParticipantById(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  /**
   * Get all participants as an array
   */
  getAllParticipants(): Participant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get total participant count
   */
  getParticipantCount(): number {
    return this.participants.size;
  }

  /**
   * Get only active participants
   */
  getActiveParticipants(): Participant[] {
    return Array.from(this.participants.values()).filter(p => p.isActive);
  }

  /**
   * Get count of active participants
   */
  getActiveParticipantCount(): number {
    return this.getActiveParticipants().length;
  }

  /**
   * Get total response count
   */
  getResponseCount(): number {
    return this.responses.length;
  }

  /**
   * Get response count for specific participant
   */
  getResponseCountForParticipant(participantId: string): number {
    return this.responses.filter(r => r.participantId === participantId).length;
  }

  /**
   * Check if participant has completed all questions
   */
  hasParticipantCompletedQuiz(participantId: string): boolean {
    const participantResponseCount = this.getResponseCountForParticipant(participantId);
    const totalQuestions = this.questions.length;
    return participantResponseCount === totalQuestions && totalQuestions > 0;
  }
}
