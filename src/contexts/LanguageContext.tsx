import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SupportedLanguage, SUPPORTED_LANGUAGES, isSupportedLanguage } from '@/lib/country-language-map';
import i18n from '@/lib/i18n';

/**
 * Language Context Provider
 * 
 * Global state management for language preferences
 * Features:
 * - Auto-detects language from IP address on first visit
 * - Loads user's preferred language from profile (if logged in)
 * - Falls back to localStorage cache
 * - Allows manual override
 * - Syncs with i18next
 */

interface LanguageContextType {
  userLanguage: SupportedLanguage;
  isLoading: boolean;
  error: string | null;
  isAutoDetected: boolean;
  updateUserLanguage: (newLanguage: SupportedLanguage) => Promise<void>;
  detectLanguageFromIP: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'i18nextLng';
const DETECTED_LANGUAGE_KEY = 'detected_language';
const DETECTED_LANGUAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DetectedLanguageCache {
  language: SupportedLanguage;
  expiresAt: number;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [userLanguage, setUserLanguage] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(false);

  /**
   * Changes the language and updates i18next
   */
  const changeLanguage = useCallback((lang: SupportedLanguage) => {
    setUserLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    setIsAutoDetected(false);
  }, []);

  /**
   * Detects language from IP address
   */
  const detectLanguageFromIP = useCallback(async () => {
    // Check cache first
    const cachedData = localStorage.getItem(DETECTED_LANGUAGE_KEY);
    if (cachedData) {
      try {
        const cached: DetectedLanguageCache = JSON.parse(cachedData);
        if (Date.now() < cached.expiresAt && isSupportedLanguage(cached.language)) {
          if (!import.meta.env.PROD) {
            console.log(`✅ Using cached detected language: ${cached.language}`);
          }
          changeLanguage(cached.language);
          setIsAutoDetected(true);
          return;
        }
      } catch (e) {
        console.error('Error parsing cached language:', e);
        localStorage.removeItem(DETECTED_LANGUAGE_KEY);
      }
    }

    try {
      if (!import.meta.env.PROD) {
        console.log('🌍 Detecting language from IP address...');
      }

      const { data, error: detectError } = await supabase.functions.invoke('detect-user-language');

      if (detectError) {
        throw detectError;
      }

      if (data?.language && isSupportedLanguage(data.language)) {
        const detectedLang = data.language;
        
        // Cache the result
        const cacheData: DetectedLanguageCache = {
          language: detectedLang,
          expiresAt: Date.now() + DETECTED_LANGUAGE_TTL_MS,
        };
        localStorage.setItem(DETECTED_LANGUAGE_KEY, JSON.stringify(cacheData));

        if (!import.meta.env.PROD) {
          console.log(`✅ Detected language: ${detectedLang} (from ${data.country_name || 'unknown'})`);
        }

        changeLanguage(detectedLang);
        setIsAutoDetected(true);

        // Save to profile if user is logged in
        if (user?.id) {
          await supabase
            .from('profiles')
            .update({ preferred_language: detectedLang })
            .eq('id', user.id);
        }
      } else {
        // Fallback to English
        changeLanguage('en');
        setIsAutoDetected(false);
      }
    } catch (err: any) {
      console.error('Error detecting language from IP:', err);
      setError(err.message || 'Failed to detect language');
      // Fallback to English
      changeLanguage('en');
      setIsAutoDetected(false);
    }
  }, [user?.id, changeLanguage]);

  /**
   * Updates user's language preference
   */
  const updateUserLanguage = useCallback(async (newLanguage: SupportedLanguage) => {
    if (!isSupportedLanguage(newLanguage)) {
      throw new Error(`Unsupported language: ${newLanguage}`);
    }

    if (!import.meta.env.PROD) {
      console.log(`🔄 Updating user language to ${newLanguage}...`);
    }

    setIsLoading(true);
    setError(null);

    try {
      // Update in database if logged in
      if (user?.id) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ preferred_language: newLanguage })
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }

        if (!import.meta.env.PROD) {
          console.log(`✅ Updated user language to ${newLanguage}`);
        }
      }

      // Update local state and i18next
      changeLanguage(newLanguage);
      setIsAutoDetected(false);
    } catch (err: any) {
      console.error('Error updating language:', err);
      setError(err.message || 'Failed to update language');
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, changeLanguage]);

  // Initialize on mount or user change
  useEffect(() => {
    const initializeLanguage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Priority 1: Check localStorage (user's manual selection)
        const storedLang = localStorage.getItem(STORAGE_KEY);
        if (storedLang && isSupportedLanguage(storedLang)) {
          if (!import.meta.env.PROD) {
            console.log(`📦 Using stored language from localStorage: ${storedLang}`);
          }
          changeLanguage(storedLang);
          setIsAutoDetected(false);
          setIsLoading(false);
          return;
        }

        // Priority 2: Check user profile (if logged in)
        if (user?.id) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('preferred_language')
            .eq('id', user.id)
            .single();

          if (!profileError && profile?.preferred_language && isSupportedLanguage(profile.preferred_language)) {
            if (!import.meta.env.PROD) {
              console.log(`👤 Using user preferred language from profile: ${profile.preferred_language}`);
            }
            changeLanguage(profile.preferred_language);
            setIsAutoDetected(false);
            setIsLoading(false);
            return;
          }
        }

        // Priority 3: Auto-detect from IP
        await detectLanguageFromIP();
      } catch (err: any) {
        console.error('Error initializing language:', err);
        setError(err.message || 'Failed to initialize language');
        // Fallback to English
        changeLanguage('en');
        setIsAutoDetected(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeLanguage();
  }, [user?.id, changeLanguage, detectLanguageFromIP]);

  const value: LanguageContextType = {
    userLanguage,
    isLoading,
    error,
    isAutoDetected,
    updateUserLanguage,
    detectLanguageFromIP,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
