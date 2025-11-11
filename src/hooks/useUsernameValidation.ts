import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";

interface UsernameValidationResult {
  isAvailable: boolean | null;
  isChecking: boolean;
  error: string | null;
}

/**
 * Hook to validate username availability in real-time
 * Uses debouncing to avoid excessive API calls
 * 
 * @param username - The username to validate
 * @param context - 'registration' checks if username is available (not taken)
 *                  'lookup' checks if username exists (is taken)
 */
export function useUsernameValidation(
  username: string, 
  context: 'registration' | 'lookup' = 'registration'
): UsernameValidationResult {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedUsername = useDebounce(username, 500);

  useEffect(() => {
    // Reset state if username is empty or invalid format
    if (!debouncedUsername || debouncedUsername.length < 3) {
      setIsAvailable(null);
      setIsChecking(false);
      setError(null);
      return;
    }

    // Validate format before checking database
    const isValidFormat = /^[a-zA-Z0-9_]+$/.test(debouncedUsername);
    if (!isValidFormat) {
      setIsAvailable(false);
      setIsChecking(false);
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    // Check database for availability
    const checkUsername = async () => {
      setIsChecking(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", debouncedUsername)
          .maybeSingle();

        if (queryError) {
          console.error("Error checking username:", queryError);
          setError("Unable to check username availability");
          setIsAvailable(null);
          return;
        }

        // If data exists, username is taken
        const available = !data;
        setIsAvailable(available);
        
        if (context === 'registration' && !available) {
          setError(`Username "${debouncedUsername}" is already taken`);
        } else if (context === 'lookup' && available) {
          setError(`Username "${debouncedUsername}" not found. Please check spelling.`);
        }
      } catch (err) {
        console.error("Unexpected error checking username:", err);
        setError("An error occurred while checking username");
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    };

    checkUsername();
  }, [debouncedUsername]);

  return { isAvailable, isChecking, error };
}
