import { ReactNode, useState, useEffect, useRef } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * AdminLayout - Wrapper for all admin pages
 * 
 * Provides:
 * - Dedicated AdminSidebar with vertical navigation
 * - Consistent admin area styling with distinct theme
 * - Proper spacing for mobile and desktop
 * - Smooth animations on load
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const previousPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      }
      setIsLoading(false);
    };

    loadProfile();
  }, [user]);

  // Prevent scroll to top when navigating between admin routes
  useEffect(() => {
    const isRestoringRef = { current: false };
    let restoreTimeout: NodeJS.Timeout | null = null;
    let preventScrollHandler: (() => void) | null = null;
    
    // Save scroll position for previous path
    if (previousPathRef.current !== location.pathname) {
      const previousScroll = window.scrollY;
      if (previousScroll > 0) {
        scrollPositionsRef.current.set(previousPathRef.current, previousScroll);
      }
      
      // Restore scroll position for current path if it exists
      const savedScroll = scrollPositionsRef.current.get(location.pathname);
      if (savedScroll !== undefined && savedScroll > 0) {
        isRestoringRef.current = true;
        
        // Prevent any scroll to top during restoration
        preventScrollHandler = () => {
          if (isRestoringRef.current && window.scrollY < savedScroll - 10) {
            window.scrollTo({ top: savedScroll, behavior: 'instant' });
          }
        };
        
        // Add scroll listener to prevent scroll to top
        window.addEventListener('scroll', preventScrollHandler, { passive: false });
        
        // Aggressively restore scroll position
        const restoreScroll = () => {
          window.scrollTo({ top: savedScroll, behavior: 'instant' });
        };
        
        // Multiple attempts to restore scroll
        restoreScroll();
        requestAnimationFrame(restoreScroll);
        setTimeout(restoreScroll, 0);
        setTimeout(restoreScroll, 10);
        setTimeout(restoreScroll, 25);
        setTimeout(restoreScroll, 50);
        setTimeout(restoreScroll, 100);
        setTimeout(restoreScroll, 200);
        
        // Stop preventing after restoration period
        restoreTimeout = setTimeout(() => {
          isRestoringRef.current = false;
          if (preventScrollHandler) {
            window.removeEventListener('scroll', preventScrollHandler);
          }
        }, 300);
      }
      
      previousPathRef.current = location.pathname;
    } else {
      // Save current scroll position for current path
      const currentScroll = window.scrollY;
      if (currentScroll > 0) {
        scrollPositionsRef.current.set(location.pathname, currentScroll);
      }
    }
    
    return () => {
      if (restoreTimeout) {
        clearTimeout(restoreTimeout);
      }
      if (preventScrollHandler) {
        window.removeEventListener('scroll', preventScrollHandler);
      }
      isRestoringRef.current = false;
    };
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background w-full animate-fade-in text-foreground">
      <AdminSidebar 
        profile={profile}
        onSignOut={signOut}
      />
      
      {/* Main Content Area */}
      <main className="pt-16 lg:pt-0 lg:ml-80 bg-background min-h-screen">
        {children}
      </main>
    </div>
  );
};
