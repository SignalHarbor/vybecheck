import { create } from 'zustand';

export interface DraftQuestion {
  id: string;
  prompt: string;
  options: [string, string];
  ownerResponse?: string; // Owner's answer to this question
  isAIGenerated?: boolean;
}

interface DraftStore {
  draftQuestions: DraftQuestion[];
  addDraft: (prompt: string, options: [string, string], ownerResponse?: string, isAIGenerated?: boolean) => string;
  removeDraft: (id: string) => void;
  setOwnerResponse: (id: string, response: string) => void;
  clearDrafts: () => void;
  reorderDrafts: (startIndex: number, endIndex: number) => void;
}

let draftCounter = 0;

export const useDraftStore = create<DraftStore>((set) => ({
  draftQuestions: [],
  
  addDraft: (prompt, options, ownerResponse, isAIGenerated) => {
    draftCounter++;
    const draft: DraftQuestion = {
      id: `draft-${Date.now()}-${draftCounter}`,
      prompt,
      options,
      ownerResponse,
      isAIGenerated,
    };
    set((state) => ({ 
      draftQuestions: [...state.draftQuestions, draft] 
    }));
    return draft.id;
  },
  
  removeDraft: (id) => {
    set((state) => ({
      draftQuestions: state.draftQuestions.filter(q => q.id !== id),
    }));
  },
  
  setOwnerResponse: (id, response) => {
    set((state) => ({
      draftQuestions: state.draftQuestions.map(q =>
        q.id === id ? { ...q, ownerResponse: response } : q
      ),
    }));
  },
  
  clearDrafts: () => set({ draftQuestions: [] }),
  
  reorderDrafts: (startIndex, endIndex) => {
    set((state) => {
      const result = Array.from(state.draftQuestions);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { draftQuestions: result };
    });
  },
}));
