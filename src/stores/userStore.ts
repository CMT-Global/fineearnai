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
  
  // Actions
  setStats: (stats: UserStats) => void;
  updateTaskProgress: (tasksCompleted: number, earningsBalance: number) => void;
  clearStats: () => void;
  
  // Computed
  isDailyLimitReached: () => boolean;
}

export const useUserStore = create<UserStore>((set, get) => ({
  stats: null,
  isLoading: false,
  lastFetch: 0,
  
  setStats: (stats) => set({ 
    stats: { ...stats, lastUpdated: Date.now() },
    lastFetch: Date.now(),
    isLoading: false
  }),
  
  updateTaskProgress: (tasksCompleted, earningsBalance) => set((state) => ({
    stats: state.stats ? {
      ...state.stats,
      tasksCompletedToday: tasksCompleted,
      earningsBalance,
      remainingTasks: state.stats.dailyLimit - tasksCompleted,
      lastUpdated: Date.now()
    } : null
  })),
  
  clearStats: () => set({ stats: null, isLoading: false, lastFetch: 0 }),
  
  isDailyLimitReached: () => {
    const { stats } = get();
    return stats ? stats.tasksCompletedToday >= stats.dailyLimit : false;
  }
}));
