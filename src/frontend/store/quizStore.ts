import { create } from 'zustand';
import type { QuizState, MatchResult, MatchTier } from '../../shared/types';

const PARTICIPANT_STORAGE_KEY = 'vybecheck_participantId';
const SESSION_STORAGE_KEY = 'vybecheck_sessionId';
const OWNER_STORAGE_KEY = 'vybecheck_isOwner';

interface MatchState {
  matches: MatchResult[];
  tier: MatchTier;
  cost: number;
  isLoading: boolean;
}

interface QuestionLimitState {
  isAtLimit: boolean;
  current: number;
  max: number;
  upgradeCost: number;
}

interface QuizStore {
  sessionId: string;
  participantId: string;
  isOwner: boolean;
  quizState: QuizState | null;
  matchState: MatchState;
  questionLimitState: QuestionLimitState | null;
  
  setSessionId: (sessionId: string) => void;
  setParticipantId: (participantId: string) => void;
  setIsOwner: (isOwner: boolean) => void;
  setQuizState: (quizState: QuizState | null) => void;
  updateQuizState: (updater: (prev: QuizState | null) => QuizState | null) => void;
  setMatchState: (state: Partial<MatchState>) => void;
  setMatchesLoading: (isLoading: boolean) => void;
  setQuestionLimitState: (state: QuestionLimitState | null) => void;
  clearQuestionLimitState: () => void;
  reset: () => void;
  
  // Legacy compatibility
  matches: MatchResult[];
  setMatches: (matches: MatchResult[]) => void;
}

const initialMatchState: MatchState = {
  matches: [],
  tier: 'PREVIEW',
  cost: 0,
  isLoading: false,
};

// Hydrate from localStorage
const getStoredParticipantId = (): string => {
  try {
    return localStorage.getItem(PARTICIPANT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const getStoredSessionId = (): string => {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const getStoredIsOwner = (): boolean => {
  try {
    return localStorage.getItem(OWNER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useQuizStore = create<QuizStore>((set, get) => ({
  sessionId: getStoredSessionId(),
  participantId: getStoredParticipantId(),
  isOwner: getStoredIsOwner(),
  quizState: null,
  matchState: initialMatchState,
  questionLimitState: null,
  
  // Legacy compatibility getter
  get matches() {
    return get().matchState.matches;
  },
  
  setSessionId: (sessionId) => {
    try {
      if (sessionId) {
        localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    set({ sessionId });
  },
  
  setParticipantId: (participantId) => {
    try {
      if (participantId) {
        localStorage.setItem(PARTICIPANT_STORAGE_KEY, participantId);
      } else {
        localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    set({ participantId });
  },
  
  setIsOwner: (isOwner) => {
    try {
      if (isOwner) {
        localStorage.setItem(OWNER_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(OWNER_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    set({ isOwner });
  },
  
  setQuizState: (quizState) => set({ quizState }),
  
  updateQuizState: (updater) => set((state) => ({ 
    quizState: updater(state.quizState) 
  })),
  
  setMatchState: (newState) => set((state) => ({
    matchState: { ...state.matchState, ...newState },
  })),
  
  setMatchesLoading: (isLoading) => set((state) => ({
    matchState: { ...state.matchState, isLoading },
  })),
  
  // Legacy compatibility setter
  setMatches: (matches) => set((state) => ({
    matchState: { ...state.matchState, matches },
  })),
  
  setQuestionLimitState: (questionLimitState) => set({ questionLimitState }),
  
  clearQuestionLimitState: () => set({ questionLimitState: null }),
  
  reset: () => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
      localStorage.removeItem(OWNER_STORAGE_KEY);
    } catch {
      // Ignore
    }
    set({
      sessionId: '',
      participantId: '',
      isOwner: false,
      quizState: null,
      matchState: initialMatchState,
      questionLimitState: null,
    });
  },
}));
