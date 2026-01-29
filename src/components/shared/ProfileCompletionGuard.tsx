import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletion, isProfileCompletionAllowedPath } from "@/hooks/useProfileCompletion";
import { LoadingSpinner } from "./LoadingSpinner";

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects authenticated users with profile_completed = false to /profile-wizard.
 * Only /profile-wizard, /settings, and /how-it-works are allowed when incomplete.
 * Auth-only routes (login, signup, etc.) are not wrapped by this guard.
 */
export function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { profileCompleted, loading: profileLoading } = useProfileCompletion(user?.id ?? undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) return;

    const allowed = isProfileCompletionAllowedPath(pathname);
    if (allowed) return;

    if (!profileCompleted) {
      navigate("/profile-wizard", { replace: true });
    }
  }, [user, authLoading, profileCompleted, profileLoading, pathname, navigate]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profileCompleted && !isProfileCompletionAllowedPath(pathname)) {
    return null;
  }

  return <>{children}</>;
}
