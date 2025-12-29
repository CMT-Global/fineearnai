/**
 * Hook to sync i18n language with user's preferred language
 * Forces re-render when language changes to ensure UI updates
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';

export function useLanguageSync() {
  const { i18n, ready } = useTranslation();
  const { userLanguage, isLoading: isLanguageLoading } = useLanguage();
  const [languageKey, setLanguageKey] = useState(0); // Force re-render key
  const [lastSyncedLang, setLastSyncedLang] = useState<string | null>(null);

  // Listen for i18n language changes to force re-render
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      if (!import.meta.env.PROD) {
        console.log('🔔 useLanguageSync: languageChanged event fired', { lng });
      }
      setLanguageKey(prev => prev + 1);
      setLastSyncedLang(lng);
    };
    
    // Subscribe to language changes
    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  useEffect(() => {
    // Wait for both i18n and language context to be ready
    if (isLanguageLoading || !ready) {
      if (!import.meta.env.PROD) {
        console.log('⏳ useLanguageSync: Waiting for language to load...', {
          isLanguageLoading,
          ready,
          currentI18nLang: i18n.language,
          userLanguage
        });
      }
      return;
    }
    
    // Normalize language codes (handle 'en-US' -> 'en')
    const currentLang = i18n.language?.split('-')[0] || 'en';
    const targetLang = userLanguage || 'en';
    
    // Suppressed: Only log in development if needed for debugging
    // if (!import.meta.env.PROD) {
    //   console.log('🔄 useLanguageSync: Checking language sync', {
    //     currentLang,
    //     targetLang,
    //     i18nLanguage: i18n.language,
    //     userLanguage,
    //     needsUpdate: currentLang !== targetLang
    //   });
    // }
    
    // Ensure i18n language is synced with userLanguage from context
    if (currentLang !== targetLang) {
      i18n.changeLanguage(targetLang).then(() => {
        // Verify translations are loaded
        const hasResource = i18n.hasResourceBundle(targetLang, 'translation');
        if (!import.meta.env.PROD) {
          console.log('✅ useLanguageSync: Language changed successfully', {
            from: currentLang,
            to: targetLang,
            newI18nLang: i18n.language,
            hasResourceBundle: hasResource,
            isInitialized: i18n.isInitialized
          });
        }
        // Force component re-render by updating key
        setLanguageKey(prev => prev + 1);
      }).catch((err) => {
        console.error('❌ useLanguageSync: Error changing i18n language:', err);
      });
    } else {
      // Languages are already in sync
      if (!import.meta.env.PROD && languageKey === 0) {
        console.log('✅ useLanguageSync: Languages are in sync', {
          i18nLanguage: i18n.language,
          userLanguage,
          currentLang,
          targetLang
        });
      }
      // Even if language matches, update key to ensure fresh render when language context updates
      // This handles the case where the language was already correct but context just finished loading
      // Also update key when language changes to ensure component re-renders
      // IMPORTANT: Always update key if language changed from last sync to force re-render
      if (languageKey === 0 || lastSyncedLang !== targetLang) {
        setLanguageKey(prev => prev + 1);
        setLastSyncedLang(targetLang);
      }
    }
  }, [userLanguage, isLanguageLoading, i18n, ready]);

  return { languageKey };
}

