import { useState, useEffect, useCallback } from "react";
import { CompleteApplicationData } from "@/lib/partner-application-validation";

interface ApplicationDraft {
  section: number;
  timestamp: number;
  data: Partial<CompleteApplicationData>;
}

export const usePartnerApplicationDraft = (userId: string) => {
  const storageKey = `partner-application-draft-${userId}`;
  
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [hasExistingDraft, setHasExistingDraft] = useState(false);

  // Load draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ApplicationDraft;
        setDraft(parsed);
        setHasExistingDraft(true);
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // Save draft (debounced in parent component)
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
      localStorage.setItem(storageKey, JSON.stringify(draftData));
      setDraft(draftData);
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  }, [storageKey]);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setDraft(null);
      setHasExistingDraft(false);
    } catch (error) {
      console.error("Error clearing draft:", error);
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

  return {
    draft,
    hasExistingDraft,
    saveDraft,
    clearDraft,
    getDraftData,
    getDraftSection,
  };
};
