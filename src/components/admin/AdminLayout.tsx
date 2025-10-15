import { ReactNode, useState, useEffect } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * AdminLayout - Wrapper for all admin pages
 * 
 * Provides:
 * - Dedicated AdminSidebar with vertical navigation
 * - Consistent admin area styling
 * - Proper spacing for mobile and desktop
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    };

    loadProfile();
  }, [user]);

  return (
    <div className="min-h-screen bg-background flex w-full">
      <AdminSidebar 
        profile={profile}
        onSignOut={signOut}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
};
