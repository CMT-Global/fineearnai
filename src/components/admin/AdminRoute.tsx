import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute Component - Server-side Admin Access Guard
 * 
 * Security layers:
 * 1. Authentication check - ensures user is logged in
 * 2. Admin role validation - validates against user_roles table in database
 * 3. RLS policies - enforced at database level
 * 
 * This component protects admin routes from unauthorized access and logs
 * any unauthorized access attempts for security auditing.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    // First check: Authentication
    if (!authLoading && !user) {
      toast.error("Authentication required. Please log in.");
      navigate("/login");
      return;
    }

    // Second check: Admin role validation
    if (!adminLoading && user && !isAdmin) {
      // Log unauthorized access attempt
      logUnauthorizedAccess(user.id, window.location.pathname);
      
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  // Log unauthorized access attempts to audit_logs table
  const logUnauthorizedAccess = async (userId: string, attemptedPath: string) => {
    try {
      await supabase.from("audit_logs").insert({
        admin_id: userId,
        action_type: "unauthorized_admin_access_attempt",
        details: {
          attempted_path: attemptedPath,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        },
      });
    } catch (error) {
      console.error("Failed to log unauthorized access:", error);
    }
  };

  // Loading state - show spinner while checking authentication and admin status
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Verifying admin access..." />
      </div>
    );
  }

  // If not authenticated or not admin, don't render children
  // (navigation will happen via useEffect)
  if (!user || !isAdmin) {
    return null;
  }

  // User is authenticated and is admin - render protected content
  return <>{children}</>;
};
