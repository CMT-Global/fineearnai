import { create } from 'zustand';

/**
 * ✅ Phase 3: Zustand optimized for UI state only
 * 
 * This store manages ONLY client-side UI state.
 * ALL server data is now handled by React Query hooks.
 * 
 * Responsibilities:
 * - Track daily limit flag to prevent UI flicker after task completion
 * - Auto-reset limit flag at midnight (date change detection)
 * - Persist UI preferences (theme, notifications, etc. - future use)
 */
interface UserStore {
  // UI State (NOT from server)
  dailyLimitReached: boolean; // Persistent flag to prevent UI flicker
  lastResetDate: string | null; // Track the date of last reset to auto-clear at midnight
  
  // Actions
  setDailyLimitReached: (reached: boolean) => void;
  checkAndResetDaily: () => void; // Check if date changed and reset if needed
  clearUIState: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  dailyLimitReached: false,
  lastResetDate: null,
  
  setDailyLimitReached: (reached) => {
    const currentDate = new Date().toISOString().split('T')[0];
    console.log('🎯 Setting dailyLimitReached:', reached);
    set({ 
      dailyLimitReached: reached,
      lastResetDate: currentDate
    });
  },
  
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
    } else if (!lastResetDate) {
      // Initialize lastResetDate if not set
      set({ lastResetDate: currentDate });
    }
  },
  
  clearUIState: () => set({ 
    dailyLimitReached: false,
    lastResetDate: null
  })
}));
