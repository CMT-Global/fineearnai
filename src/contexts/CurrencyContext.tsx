import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Currency Context Provider
 * 
 * Global state management for currency conversion
 * Features:
 * - Fetches user's preferred currency on mount
 * - Caches exchange rate in localStorage (24h TTL)
 * - Provides conversion utilities to all components
 * - Handles errors gracefully with USD fallback
 */

interface CurrencyContextType {
  userCurrency: string;
  exchangeRate: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshRate: () => Promise<void>;
  updateUserCurrency: (newCurrency: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CACHE_KEY_PREFIX = 'currency_rate_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedRate {
  rate: number;
  currency: string;
  expiresAt: number;
  userId: string;
}

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [userCurrency, setUserCurrency] = useState<string>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchExchangeRate = useCallback(async (currency: string, userId: string) => {
    console.log(`💱 Fetching exchange rate for ${currency}...`);

    // USD always has rate of 1
    if (currency === 'USD') {
      setExchangeRate(1);
      setUserCurrency('USD');
      setIsLoading(false);
      setLastUpdated(new Date());
      return;
    }

    // Check localStorage cache first
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}_${currency}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const cached: CachedRate = JSON.parse(cachedData);
        
        // Validate cache
        if (
          cached.expiresAt > Date.now() &&
          cached.userId === userId &&
          cached.currency === currency
        ) {
          console.log(`✅ Using cached rate for ${currency}: ${cached.rate}`);
          setExchangeRate(cached.rate);
          setUserCurrency(currency);
          setIsLoading(false);
          setLastUpdated(new Date());
          return;
        } else {
          console.log(`🔄 Cache expired or invalid for ${currency}`);
        }
      } catch (e) {
        console.error('Error parsing cached rate:', e);
        localStorage.removeItem(cacheKey);
      }
    }

    // Cache miss - fetch from backend
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('convert-usd-to-local', {
        body: { targetCurrencyCode: currency }
      });

      if (fetchError) {
        throw fetchError;
      }

      if (data?.exchangeRate) {
        const rate = data.exchangeRate;
        console.log(`✅ Fetched exchange rate for ${currency}: ${rate}`);

        // Cache the rate
        const cacheData: CachedRate = {
          rate,
          currency,
          expiresAt: Date.now() + CACHE_TTL_MS,
          userId,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));

        setExchangeRate(rate);
        setUserCurrency(currency);
        setError(null);
        setLastUpdated(new Date());
      } else {
        throw new Error('Invalid response from currency conversion API');
      }
    } catch (err: any) {
      console.error('Error fetching exchange rate:', err);
      setError(err.message || 'Failed to fetch exchange rate');
      
      // Fallback to USD
      setExchangeRate(1);
      setUserCurrency('USD');
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRate = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    // Clear cache to force fresh fetch
    const cacheKey = `${CACHE_KEY_PREFIX}${user.id}_${userCurrency}`;
    localStorage.removeItem(cacheKey);

    await fetchExchangeRate(userCurrency, user.id);
  }, [user?.id, userCurrency, fetchExchangeRate]);

  const updateUserCurrency = useCallback(async (newCurrency: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const currencyCode = newCurrency.toUpperCase();
    console.log(`🔄 Updating user currency to ${currencyCode}...`);

    setIsLoading(true);
    setError(null);

    try {
      // Update in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ preferred_currency: currencyCode })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`✅ Updated user currency to ${currencyCode}`);

      // Fetch new exchange rate
      await fetchExchangeRate(currencyCode, user.id);
    } catch (err: any) {
      console.error('Error updating currency:', err);
      setError(err.message || 'Failed to update currency');
      setIsLoading(false);
      throw err;
    }
  }, [user?.id, fetchExchangeRate]);

  // Initialize on mount or user change
  useEffect(() => {
    const initializeCurrency = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      console.log('🔧 Initializing currency context for user:', user.id);

      try {
        // Fetch user profile to get preferred currency
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('preferred_currency')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        const preferredCurrency = profile?.preferred_currency || 'USD';
        console.log(`👤 User preferred currency: ${preferredCurrency}`);

        await fetchExchangeRate(preferredCurrency, user.id);
      } catch (err: any) {
        console.error('Error initializing currency:', err);
        setError(err.message || 'Failed to initialize currency');
        
        // Fallback to USD
        setExchangeRate(1);
        setUserCurrency('USD');
        setIsLoading(false);
      }
    };

    initializeCurrency();
  }, [user?.id, fetchExchangeRate]);

  const value: CurrencyContextType = {
    userCurrency,
    exchangeRate,
    isLoading,
    error,
    lastUpdated,
    refreshRate,
    updateUserCurrency,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
