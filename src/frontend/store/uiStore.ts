import { create } from 'zustand';

export type PageType = 'start' | 'lab' | 'quiz' | 'lobby' | 'vybes';

const ACTIVE_PAGE_KEY = 'vybecheck_activePage';

const getStoredActivePage = (): PageType => {
  try {
    const stored = localStorage.getItem(ACTIVE_PAGE_KEY);
    if (stored && ['start', 'lab', 'quiz', 'lobby', 'vybes'].includes(stored)) {
      return stored as PageType;
    }
  } catch {
    // Ignore
  }
  return 'start';
};

interface UIStore {
  activePage: PageType;
  notification: string;
  error: string;
  info: string;
  
  setActivePage: (page: PageType) => void;
  showNotification: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  clearNotification: () => void;
  clearError: () => void;
  clearInfo: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePage: getStoredActivePage(),
  notification: '',
  error: '',
  info: '',
  
  setActivePage: (page) => {
    try {
      localStorage.setItem(ACTIVE_PAGE_KEY, page);
    } catch {
      // Ignore
    }
    set({ activePage: page });
  },
  
  showNotification: (message, duration = 3000) => {
    set({ notification: message });
    if (duration > 0) {
      setTimeout(() => set({ notification: '' }), duration);
    }
  },
  
  showError: (message, duration = 5000) => {
    set({ error: message });
    if (duration > 0) {
      setTimeout(() => set({ error: '' }), duration);
    }
  },

  showInfo: (message, duration = 3000) => {
    set({ info: message });
    if (duration > 0) {
      setTimeout(() => set({ info: '' }), duration);
    }
  },
  
  clearNotification: () => set({ notification: '' }),
  
  clearError: () => set({ error: '' }),

  clearInfo: () => set({ info: '' }),
}));
