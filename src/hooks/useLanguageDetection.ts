/**
 * useLanguageDetection Hook
 * 
 * Hook for language detection logic
 * This is mainly used by LanguageContext, but can be used independently if needed
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupportedLanguage, isSupportedLanguage } from '@/lib/country-language-map';

const DETECTED_LANGUAGE_KEY = 'detected_language';
const DETECTED_LANGUAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DetectedLanguageCache {
  language: SupportedLanguage;
  expiresAt: number;
}

/**
 * Hook for language detection from IP address
 */
export function useLanguageDetection() {
  /**
   * Detects language from IP address
   * Returns cached result if available and not expired
   */
  const detectLanguageFromIP = useCallback(async (): Promise<SupportedLanguage | null> => {
    // Check cache first
    const cachedData = localStorage.getItem(DETECTED_LANGUAGE_KEY);
    if (cachedData) {
      try {
        const cached: DetectedLanguageCache = JSON.parse(cachedData);
        if (Date.now() < cached.expiresAt && isSupportedLanguage(cached.language)) {
          if (!import.meta.env.PROD) {
            console.log(`✅ Using cached detected language: ${cached.language}`);
          }
          return cached.language;
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

        return detectedLang;
      }

      return null;
    } catch (err: any) {
      console.error('Error detecting language from IP:', err);
      return null;
    }
  }, []);

  /**
   * Clears the cached detected language
   */
  const clearDetectedLanguageCache = useCallback(() => {
    localStorage.removeItem(DETECTED_LANGUAGE_KEY);
  }, []);

  return {
    detectLanguageFromIP,
    clearDetectedLanguageCache,
  };
}
