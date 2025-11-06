import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/PageLayout";
import { PartnerWizard } from "@/components/partner/PartnerWizard";
import { PartnerApplicationWizard } from "@/components/partner/PartnerApplicationWizard";
import { useIsPartner, usePartnerApplication } from "@/hooks/usePartner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { QueryErrorBoundary } from "@/components/shared/QueryErrorBoundary";

const BecomePartner = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [showApplicationWizard, setShowApplicationWizard] = useState(false);
  
  const { data: isPartner, isLoading: checkingPartner, error: partnerError, refetch: refetchPartner } = useIsPartner();
  const { data: application, isLoading: loadingApplication, error: applicationError, refetch: refetchApplication } = usePartnerApplication();
  const { data: profile } = useProfile(user?.id || '');

  // Handle errors - show error UI with retry
  if (partnerError || applicationError) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <QueryErrorBoundary 
          error={partnerError || applicationError || new Error('Unknown error')} 
          reset={() => {
            refetchPartner();
            refetchApplication();
          }}
        />
      </PageLayout>
    );
  }

  const handleIntroWizardComplete = () => {
    setShowApplicationWizard(true);
  };

  const handleApplicationComplete = () => {
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['partner-application'] });
    queryClient.invalidateQueries({ queryKey: ['is-partner'] });
    // Navigate to application status page
    navigate('/partner/application-status', { replace: true });
  };

  const handleApplicationCancel = () => {
    navigate('/dashboard', { replace: true });
  };

  // Show loading state while data is being fetched
  if (checkingPartner || loadingApplication) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </PageLayout>
    );
  }

  // Immediate redirect for approved partners - with loading state to prevent flash
  if (isPartner) {
    navigate('/partner/dashboard', { replace: true });
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Redirecting to dashboard..." />
        </div>
      </PageLayout>
    );
  }

  // Immediate redirect for users with existing applications - with loading state
  if (application) {
    navigate('/partner/application-status', { replace: true });
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading your application..." />
        </div>
      </PageLayout>
    );
  }

  // Only render wizards for new users without applications or partner status
  return (
    <PageLayout profile={profile} onSignOut={signOut}>
      {/* Intro Wizard - Benefits of becoming a partner */}
      {!showApplicationWizard && (
        <PartnerWizard
          open={true} 
          onComplete={handleIntroWizardComplete}
          onClose={() => navigate('/dashboard', { replace: true })}
        />
      )}

      {/* Application Wizard - Multi-step form */}
      {showApplicationWizard && (
        <PartnerApplicationWizard
          onComplete={handleApplicationComplete}
          onCancel={handleApplicationCancel}
        />
      )}
    </PageLayout>
  );
};

export default BecomePartner;
