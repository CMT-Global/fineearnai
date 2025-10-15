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
  
  // Actions
  setStats: (stats: UserStats) => void;
  updateTaskProgress: (tasksCompleted: number, earningsBalance: number) => void;
  setDailyLimitReached: (reached: boolean) => void;
  clearStats: () => void;
  
  // Computed
  isDailyLimitReached: () => boolean;
}

export const useUserStore = create<UserStore>((set, get) => ({
  stats: null,
  isLoading: false,
  lastFetch: 0,
  dailyLimitReached: false,
  
  setStats: (stats) => set({ 
    stats: { ...stats, lastUpdated: Date.now() },
    lastFetch: Date.now(),
    isLoading: false,
    // Reset limit flag if stats show tasks remaining
    dailyLimitReached: stats.tasksCompletedToday >= stats.dailyLimit
  }),
  
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
  
  clearStats: () => set({ 
    stats: null, 
    isLoading: false, 
    lastFetch: 0,
    dailyLimitReached: false 
  }),
  
  isDailyLimitReached: () => {
    const { stats, dailyLimitReached } = get();
    return dailyLimitReached || (stats ? stats.tasksCompletedToday >= stats.dailyLimit : false);
  }
}));
