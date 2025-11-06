import { useState, useEffect, useCallback } from "react";
import { CompleteApplicationData } from "@/lib/partner-application-validation";

// Phase 3: Draft expiry configuration
const DRAFT_EXPIRY_HOURS = 48;
const DRAFT_EXPIRY_MS = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000; // 48 hours in milliseconds

interface ApplicationDraft {
  section: number;
  timestamp: number;
  data: Partial<CompleteApplicationData>;
}

interface DraftAgeInfo {
  hoursAgo: number;
  minutesAgo: number;
  daysAgo: number;
  isExpired: boolean;
  expiresInHours: number;
}

export const usePartnerApplicationDraft = (userId: string) => {
  const storageKey = `partner-application-draft-${userId}`;
  
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [hasExistingDraft, setHasExistingDraft] = useState(false);
  const [draftAge, setDraftAge] = useState<DraftAgeInfo | null>(null);

  // Phase 3: Calculate draft age
  const calculateDraftAge = useCallback((timestamp: number): DraftAgeInfo => {
    const now = Date.now();
    const ageMs = now - timestamp;
    const ageMinutes = Math.floor(ageMs / (60 * 1000));
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const expiresInMs = DRAFT_EXPIRY_MS - ageMs;
    const expiresInHours = Math.max(0, Math.floor(expiresInMs / (60 * 60 * 1000)));
    const isExpired = ageMs > DRAFT_EXPIRY_MS;

    return {
      hoursAgo: ageHours,
      minutesAgo: ageMinutes,
      daysAgo: ageDays,
      isExpired,
      expiresInHours,
    };
  }, []);

  // Phase 3: Check if draft is expired
  const isDraftExpired = useCallback((timestamp: number): boolean => {
    const age = Date.now() - timestamp;
    return age > DRAFT_EXPIRY_MS;
  }, []);

  // Phase 3: Load draft on mount with expiry check
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ApplicationDraft;
        
        // Check if draft is expired
        if (isDraftExpired(parsed.timestamp)) {
          console.log("[Draft] Found expired draft, cleaning up...");
          localStorage.removeItem(storageKey);
          setDraft(null);
          setHasExistingDraft(false);
          setDraftAge(null);
        } else {
          console.log("[Draft] Loaded valid draft from storage");
          setDraft(parsed);
          setHasExistingDraft(true);
          setDraftAge(calculateDraftAge(parsed.timestamp));
        }
      }
    } catch (error) {
      console.error("[Draft] Error loading draft:", error);
      localStorage.removeItem(storageKey);
      setDraft(null);
      setHasExistingDraft(false);
      setDraftAge(null);
    }
  }, [storageKey, isDraftExpired, calculateDraftAge]);

  // Phase 3: Save draft with timestamp
  const saveDraft = useCallback((
    section: number,
    data: Partial<CompleteApplicationData>
  ) => {
    try {
      const draftData: ApplicationDraft = {
        section,
        timestamp: Date.now(),
        data,
      };
      
      // Try to save to localStorage with error handling
      try {
        localStorage.setItem(storageKey, JSON.stringify(draftData));
        setDraft(draftData);
        setDraftAge(calculateDraftAge(draftData.timestamp));
        console.log("[Draft] Saved successfully");
      } catch (storageError) {
        // Handle localStorage quota exceeded
        if (storageError instanceof DOMException && 
            (storageError.name === 'QuotaExceededError' || storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          console.warn("[Draft] localStorage quota exceeded, clearing old data...");
          // Try to clear and save again
          localStorage.removeItem(storageKey);
          localStorage.setItem(storageKey, JSON.stringify(draftData));
          setDraft(draftData);
          setDraftAge(calculateDraftAge(draftData.timestamp));
        } else {
          throw storageError;
        }
      }
    } catch (error) {
      console.error("[Draft] Error saving draft:", error);
    }
  }, [storageKey, calculateDraftAge]);

  // Phase 3: Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setDraft(null);
      setHasExistingDraft(false);
      setDraftAge(null);
      console.log("[Draft] Cleared successfully");
    } catch (error) {
      console.error("[Draft] Error clearing draft:", error);
    }
  }, [storageKey]);

  // Get draft data
  const getDraftData = useCallback((): Partial<CompleteApplicationData> => {
    return draft?.data || {};
  }, [draft]);

  // Get draft section
  const getDraftSection = useCallback((): number => {
    return draft?.section || 0;
  }, [draft]);

  // Phase 3: useBeforeUnload to save draft before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If there's draft data, ensure it's saved
      if (draft) {
        console.log("[Draft] Saving before page unload...");
        // The draft should already be saved via the debounced save in the parent component
        // This is just a safety check
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [draft]);

  // Phase 3: Cleanup expired drafts on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && draft) {
        // Check if draft expired while user was away
        if (isDraftExpired(draft.timestamp)) {
          console.log("[Draft] Draft expired while away, cleaning up...");
          clearDraft();
        } else {
          // Update draft age display
          setDraftAge(calculateDraftAge(draft.timestamp));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [draft, isDraftExpired, calculateDraftAge, clearDraft]);

  return {
    draft,
    hasExistingDraft,
    draftAge,
    saveDraft,
    clearDraft,
    getDraftData,
    getDraftSection,
  };
};
