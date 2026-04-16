import { create } from 'zustand';

export type PageType = 'start' | 'lab' | 'quiz' | 'lobby' | 'vybes';

const ACTIVE_PAGE_KEY = 'vybecheck_activePage';
const DARK_MODE_KEY   = 'vybecheck_dark_mode';

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

const getStoredDarkMode = (): boolean => {
  try {
    return localStorage.getItem(DARK_MODE_KEY) === '1';
  } catch {
    return false;
  }
};

// Apply dark class to <html> and keep DOM in sync
const applyDarkMode = (dark: boolean) => {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(DARK_MODE_KEY, dark ? '1' : '0');
  } catch {
    // Ignore
  }
};

// Initialise on store creation (runs once)
const initialDark = getStoredDarkMode();
applyDarkMode(initialDark);

interface UIStore {
  activePage: PageType;
  notification: string;
  error: string;
  info: string;
  isDarkMode: boolean;
  
  setActivePage: (page: PageType) => void;
  toggleDarkMode: () => void;
  showNotification: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  clearNotification: () => void;
  clearError: () => void;
  clearInfo: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  activePage: getStoredActivePage(),
  notification: '',
  error: '',
  info: '',
  isDarkMode: initialDark,
  
  setActivePage: (page) => {
    try {
      localStorage.setItem(ACTIVE_PAGE_KEY, page);
    } catch {
      // Ignore
    }
    set({ activePage: page });
  },

  toggleDarkMode: () => {
    const next = !get().isDarkMode;
    applyDarkMode(next);
    set({ isDarkMode: next });
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
