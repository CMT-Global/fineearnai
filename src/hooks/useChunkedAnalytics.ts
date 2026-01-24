import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange, CountryStats, TopReferrer } from "./useAdminAnalytics";

const CHUNK_SIZE = 20;

// Type definitions for paginated RPC functions
interface GetCountryStatsParams extends Record<string, unknown> {
  p_start_date: string;
  p_end_date: string;
  p_limit: number;
  p_offset: number;
}

interface GetCountryStatsResult {
  country_code: string;
  country_name: string;
  user_count: number;
  total_deposits: number;
  percentage: number;
  total_count: number;
}

interface GetTopReferrersParams extends Record<string, unknown> {
  p_start_date: string;
  p_end_date: string;
  p_limit: number;
  p_offset: number;
}

interface GetTopReferrersResult {
  user_id: string;
  username: string;
  country_code: string;
  country_name: string;
  referral_count: number;
  total_commission: number;
  total_referral_deposits: number;
  rank: number;
  total_count: number;
}

interface ChunkedDataOptions {
  countryLimit?: number;
  countryOffset?: number;
  referrerLimit?: number;
  referrerOffset?: number;
}

/**
 * Hook for fetching analytics data in chunks
 * This allows progressive loading to improve performance
 */
export const useChunkedAnalytics = (
  dateRange?: DateRange,
  initialOptions?: ChunkedDataOptions
) => {
  const [countryOffset, setCountryOffset] = useState(initialOptions?.countryOffset || 0);
  const [referrerOffset, setReferrerOffset] = useState(initialOptions?.referrerOffset || 0);
  const [accumulatedCountries, setAccumulatedCountries] = useState<CountryStats[]>([]);
  const [accumulatedReferrers, setAccumulatedReferrers] = useState<TopReferrer[]>([]);
  const [countryTotalCount, setCountryTotalCount] = useState<number>(0);
  const [referrerTotalCount, setReferrerTotalCount] = useState<number>(0);

  // Fetch country stats chunk
  const countryQuery = useQuery<CountryStats[], Error>({
    queryKey: ["country-stats-chunk", dateRange, countryOffset],
    queryFn: async (): Promise<CountryStats[]> => {
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];
      const startDate = dateRange?.startDate || new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const params: GetCountryStatsParams = {
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: CHUNK_SIZE,
        p_offset: countryOffset,
      };
      
      // Type assertion needed because generated types don't include pagination params yet
      // The function signature in the database includes p_limit and p_offset, but the generated types don't
      const result = await (supabase.rpc as unknown as (
        fn: string,
        args: GetCountryStatsParams
      ) => Promise<{ data: GetCountryStatsResult[] | null; error: { message: string } | null }>)(
        "get_country_stats",
        params
      );

      if (result.error) {
        throw new Error(`Failed to fetch country stats: ${result.error.message}`);
      }

      if (!result.data) {
        return [];
      }

      // Map the database result to our CountryStats type
      return result.data.map((item): CountryStats => ({
        country_code: item.country_code,
        country_name: item.country_name,
        user_count: Number(item.user_count),
        total_deposits: Number(item.total_deposits),
        percentage: Number(item.percentage),
        total_count: item.total_count,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch referrers chunk
  const referrersQuery = useQuery<TopReferrer[], Error>({
    queryKey: ["referrers-chunk", dateRange, referrerOffset],
    queryFn: async (): Promise<TopReferrer[]> => {
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];
      const startDate = dateRange?.startDate || new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const params: GetTopReferrersParams = {
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: CHUNK_SIZE,
        p_offset: referrerOffset,
      };
      
      // Type assertion needed because generated types don't include pagination params yet
      // The function signature in the database includes p_limit and p_offset, but the generated types don't
      const result = await (supabase.rpc as unknown as (
        fn: string,
        args: GetTopReferrersParams
      ) => Promise<{ data: GetTopReferrersResult[] | null; error: { message: string } | null }>)(
        "get_top_referrers",
        params
      );

      if (result.error) {
        throw new Error(`Failed to fetch top referrers: ${result.error.message}`);
      }

      if (!result.data) {
        return [];
      }

      // Map the database result to our TopReferrer type
      return result.data.map((item): TopReferrer => ({
        user_id: item.user_id,
        username: item.username,
        country_code: item.country_code,
        country_name: item.country_name,
        referral_count: Number(item.referral_count),
        total_commission: Number(item.total_commission),
        total_referral_deposits: Number(item.total_referral_deposits),
        rank: Number(item.rank),
        total_count: item.total_count,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Accumulate country data
  useEffect(() => {
    if (countryQuery.data && countryQuery.data.length > 0) {
      if (countryOffset === 0) {
        // First chunk - replace
        setAccumulatedCountries(countryQuery.data);
        setCountryTotalCount(countryQuery.data[0]?.total_count || 0);
      } else {
        // Subsequent chunks - append
        setAccumulatedCountries(prev => [...prev, ...countryQuery.data]);
      }
    }
  }, [countryQuery.data, countryOffset]);

  // Accumulate referrer data
  useEffect(() => {
    if (referrersQuery.data && referrersQuery.data.length > 0) {
      if (referrerOffset === 0) {
        // First chunk - replace
        setAccumulatedReferrers(referrersQuery.data);
        setReferrerTotalCount(referrersQuery.data[0]?.total_count || 0);
      } else {
        // Subsequent chunks - append
        setAccumulatedReferrers(prev => [...prev, ...referrersQuery.data]);
      }
    }
  }, [referrersQuery.data, referrerOffset]);

  // Load more countries
  const loadMoreCountries = useCallback(() => {
    if (countryTotalCount && accumulatedCountries.length < countryTotalCount) {
      setCountryOffset(prev => prev + CHUNK_SIZE);
    }
  }, [countryTotalCount, accumulatedCountries.length]);

  // Load more referrers
  const loadMoreReferrers = useCallback(() => {
    if (referrerTotalCount && accumulatedReferrers.length < referrerTotalCount) {
      setReferrerOffset(prev => prev + CHUNK_SIZE);
    }
  }, [referrerTotalCount, accumulatedReferrers.length]);

  // Reset offsets and accumulated data when date range changes
  const resetOffsets = useCallback(() => {
    setCountryOffset(0);
    setReferrerOffset(0);
    setAccumulatedCountries([]);
    setAccumulatedReferrers([]);
    setCountryTotalCount(0);
    setReferrerTotalCount(0);
  }, []);

  return {
    countryStats: accumulatedCountries,
    referrers: accumulatedReferrers,
    isLoadingCountries: countryQuery.isLoading && countryOffset === 0,
    isLoadingMoreCountries: countryQuery.isLoading && countryOffset > 0,
    isLoadingReferrers: referrersQuery.isLoading && referrerOffset === 0,
    isLoadingMoreReferrers: referrersQuery.isLoading && referrerOffset > 0,
    countryError: countryQuery.error,
    referrerError: referrersQuery.error,
    hasMoreCountries: countryTotalCount > 0 && accumulatedCountries.length < countryTotalCount,
    hasMoreReferrers: referrerTotalCount > 0 && accumulatedReferrers.length < referrerTotalCount,
    loadMoreCountries,
    loadMoreReferrers,
    resetOffsets,
    countryTotalCount,
    referrerTotalCount,
  } as const;
};

// Export return type for use in other components
export type UseChunkedAnalyticsReturn = ReturnType<typeof useChunkedAnalytics>;
