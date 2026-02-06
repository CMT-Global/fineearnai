import { useState, useEffect, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarSkeleton } from "@/components/layout/SidebarSkeleton";
import { PageLoading } from "@/components/shared/PageLoading";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

/**
 * AppLayout - Persistent layout for main app (Dashboard, Tasks, Wallet, Referrals, etc.)
 * Layout (and Sidebar) stay mounted when navigating between these routes; only the Outlet content changes.
 */
export const AppLayout = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    };
    loadProfile();
  }, [user]);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {profile ? (
        <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />
      ) : (
        <SidebarSkeleton />
      )}
      <main className="flex-1 overflow-auto lg:mt-0 lg:ml-80 mt-16 pb-24 lg:pb-0">
        <Suspense
          fallback={<PageLoading text={t("app.loadingPage")} />}
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};

