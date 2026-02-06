import { ReactNode, useState, useEffect, useRef, Suspense } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, Outlet } from "react-router-dom";
import { PageLoading } from "@/components/shared/PageLoading";
import { useTranslation } from "react-i18next";

interface AdminLayoutProps {
  children?: ReactNode;
}

/**
 * AdminLayout - Wrapper for all admin pages
 *
 * When used with nested routes, renders <Outlet /> so the layout stays mounted
 * when switching admin pages (avoids full remount + profile refetch + extra loading).
 * Supports optional children for backward compatibility.
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const location = useLocation();
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const previousPathRef = useRef<string>(location.pathname);
  const useOutlet = children === undefined;

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setIsLoadingProfile(false);
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
      setIsLoadingProfile(false);
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

  // Only full-page load when we have no user (AdminRoute ensures we have user when mounting).
  // When user exists, show layout immediately; profile loads in background and sidebar handles null.
  if (!user) {
    return <PageLoading text={t("app.loadingPage")} />;
  }

  const mainContent = useOutlet ? (
    <Suspense
      fallback={<PageLoading text={t("app.loadingPage")} />}
    >
      <Outlet />
    </Suspense>
  ) : (
    children
  );

  return (
    <div className="min-h-screen bg-background w-full animate-fade-in text-foreground">
      <AdminSidebar profile={profile} onSignOut={signOut} />
      <main className="pt-16 lg:pt-0 lg:ml-80 bg-background min-h-screen">
        {mainContent}
      </main>
    </div>
  );
};
