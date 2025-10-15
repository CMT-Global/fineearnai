import { create } from 'zustand';

interface UserStats {
  userId: string;
  username: string;
  tasksCompletedToday: number;
  dailyLimit: number;
  remainingTasks: number;
  earningsBalance: number;
  depositBalance: number;
  totalEarned: number;
  skipsToday: number;
  skipLimit: number;
  remainingSkips: number;
  membershipPlan: string;
  planExpiresAt: string | null;
  lastUpdated: number;
}

interface UserStore {
  stats: UserStats | null;
  isLoading: boolean;
  lastFetch: number;
  dailyLimitReached: boolean; // Persistent flag to prevent UI flicker
  lastResetDate: string | null; // Track the date of last reset to auto-clear at midnight
  
  // Actions
  setStats: (stats: UserStats) => void;
  updateTaskProgress: (tasksCompleted: number, earningsBalance: number) => void;
  setDailyLimitReached: (reached: boolean) => void;
  clearStats: () => void;
  checkAndResetDaily: () => void; // Check if date changed and reset if needed
  
  // Computed
  isDailyLimitReached: () => boolean;
}

export const useUserStore = create<UserStore>((set, get) => ({
  stats: null,
  isLoading: false,
  lastFetch: 0,
  dailyLimitReached: false,
  lastResetDate: null,
  
  setStats: (stats) => {
    const currentDate = new Date().toISOString().split('T')[0];
    set({ 
      stats: { ...stats, lastUpdated: Date.now() },
      lastFetch: Date.now(),
      isLoading: false,
      lastResetDate: currentDate,
      // Reset limit flag if stats show tasks remaining
      dailyLimitReached: stats.tasksCompletedToday >= stats.dailyLimit
    });
  },
  
  updateTaskProgress: (tasksCompleted, earningsBalance) => set((state) => ({
    stats: state.stats ? {
      ...state.stats,
      tasksCompletedToday: tasksCompleted,
      earningsBalance,
      remainingTasks: state.stats.dailyLimit - tasksCompleted,
      lastUpdated: Date.now()
    } : null,
    // Update limit flag based on new task count
    dailyLimitReached: state.stats ? tasksCompleted >= state.stats.dailyLimit : false
  })),
  
  setDailyLimitReached: (reached) => set({ dailyLimitReached: reached }),
  
  checkAndResetDaily: () => {
    const { lastResetDate, dailyLimitReached } = get();
    const currentDate = new Date().toISOString().split('T')[0];
    
    // If date has changed since last reset and limit was reached, clear the flag
    if (lastResetDate && lastResetDate !== currentDate && dailyLimitReached) {
      console.log('🔄 Date changed - clearing daily limit flag', { lastResetDate, currentDate });
      set({ 
        dailyLimitReached: false,
        lastResetDate: currentDate 
      });
    }
  },
  
  clearStats: () => set({ 
    stats: null, 
    isLoading: false, 
    lastFetch: 0,
    dailyLimitReached: false,
    lastResetDate: null
  }),
  
  isDailyLimitReached: () => {
    const { stats, dailyLimitReached } = get();
    return dailyLimitReached || (stats ? stats.tasksCompletedToday >= stats.dailyLimit : false);
  }
}));
