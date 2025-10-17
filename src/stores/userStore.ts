import { create } from 'zustand';

/**
 * ✅ Phase 2 Complete: Minimal UI State Store
 * 
 * Database is now the single source of truth for task resets.
 * CRON job handles daily resets at midnight UTC.
 * 
 * This store is kept for future UI preferences only:
 * - Theme settings
 * - Notification preferences
 * - UI layout preferences
 * - etc.
 */
interface UserStore {
  // Reserved for future UI preferences
  // e.g., theme: 'light' | 'dark';
  // e.g., notificationsEnabled: boolean;
  
  // Actions
  clearUIState: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  // Currently empty - ready for future UI state
  
  clearUIState: () => set({})
}));
