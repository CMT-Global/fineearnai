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
import { PartnerErrorBoundary } from "@/components/partner/PartnerErrorBoundary";

const BecomePartner = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const [showApplicationWizard, setShowApplicationWizard] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  const { data: isPartner, isLoading: checkingPartner, error: partnerError, refetch: refetchPartner } = useIsPartner();
  const { data: application, isLoading: loadingApplication, error: applicationError, refetch: refetchApplication } = usePartnerApplication();
  const { data: profile } = useProfile(user?.id || '');

  // Debug logging for troubleshooting
  console.log('🔍 [BecomePartner] Component Render State:', {
    timestamp: new Date().toISOString(),
    userId: user?.id,
    isPartner,
    hasApplication: !!application,
    applicationId: application?.id,
    applicationStatus: application?.status,
    checkingPartner,
    loadingApplication,
    isNavigating,
    showApplicationWizard,
    profileLoaded: !!profile,
    userEmail: user?.email
  });

  // Log when partner status changes
  console.log('🔍 [BecomePartner] Partner Check Result:', {
    isPartner,
    checkingPartner,
    partnerError: partnerError?.message
  });

  // Log when application status changes
  console.log('🔍 [BecomePartner] Application Check Result:', {
    hasApplication: !!application,
    applicationId: application?.id,
    applicationStatus: application?.status,
    loadingApplication,
    applicationError: applicationError?.message
  });

  // Handle errors - show error UI with retry
  if (partnerError || applicationError) {
    console.error('🚨 [BecomePartner] ERROR DETECTED:', {
      timestamp: new Date().toISOString(),
      partnerError: {
        message: partnerError?.message,
        stack: partnerError?.stack,
        name: partnerError?.name
      },
      applicationError: {
        message: applicationError?.message,
        stack: applicationError?.stack,
        name: applicationError?.name
      },
      userId: user?.id
    });
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <QueryErrorBoundary 
          error={partnerError || applicationError || new Error('Unknown error')} 
          reset={() => {
            console.log('🔄 [BecomePartner] Retrying after error...');
            refetchPartner();
            refetchApplication();
          }}
        />
      </PageLayout>
    );
  }

  const handleIntroWizardComplete = () => {
    console.log('✅ [BecomePartner] Intro wizard completed, showing application wizard');
    setShowApplicationWizard(true);
  };

  const handleApplicationComplete = async () => {
    console.log('✅ [BecomePartner] Application wizard completed, invalidating queries...');
    try {
      await queryClient.invalidateQueries({ queryKey: ['partner-application'] });
      console.log('✅ [BecomePartner] Invalidated partner-application query');
      await queryClient.invalidateQueries({ queryKey: ['is-partner'] });
      console.log('✅ [BecomePartner] Invalidated is-partner query');
      console.log('🔄 [BecomePartner] Navigating to application-status...');
      navigate('/partner/application-status', { replace: true });
    } catch (error) {
      console.error('🚨 [BecomePartner] Error in handleApplicationComplete:', error);
    }
  };

  const handleApplicationCancel = () => {
    console.log('❌ [BecomePartner] Application cancelled, navigating to dashboard');
    navigate('/dashboard', { replace: true });
  };

  // Early return if navigation is in progress to prevent wizard flash
  if (isNavigating) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      </PageLayout>
    );
  }

  // Show loading state while waiting for user or data is being fetched
  if (!user || checkingPartner || loadingApplication) {
    console.log('⏳ [BecomePartner] LOADING STATE:', { hasUser: !!user, checkingPartner, loadingApplication });
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
    console.log('✅ [BecomePartner] USER IS PARTNER - Triggering redirect to dashboard');
    console.log('🔄 [BecomePartner] Setting isNavigating to true');
    setIsNavigating(true);
    console.log('🔄 [BecomePartner] Calling navigate to /partner/dashboard');
    navigate('/partner/dashboard', { replace: true });
    console.log('✅ [BecomePartner] Navigate called, showing loading state');
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
    console.log('✅ [BecomePartner] USER HAS APPLICATION - Triggering redirect to application-status');
    console.log('📋 [BecomePartner] Application details:', {
      id: application.id,
      status: application.status,
      created_at: application.created_at
    });
    console.log('🔄 [BecomePartner] Setting isNavigating to true');
    setIsNavigating(true);
    console.log('🔄 [BecomePartner] Calling navigate to /partner/application-status');
    navigate('/partner/application-status', { replace: true });
    console.log('✅ [BecomePartner] Navigate called, showing loading state');
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading your application..." />
        </div>
      </PageLayout>
    );
  }

  // Only render wizards for new users without applications or partner status
  // Ensure user is loaded and no navigation/loading is in progress
  const shouldShowWizard = !!user && !isPartner && !application && !isNavigating && !checkingPartner && !loadingApplication;
  
  console.log('🎯 [BecomePartner] SHOULD SHOW WIZARD CHECK:', {
    shouldShowWizard,
    reasons: {
      hasUser: !!user,
      isPartner,
      hasApplication: !!application,
      isNavigating,
      checkingPartner,
      loadingApplication
    }
  });

  if (!shouldShowWizard) {
    console.log('⏳ [BecomePartner] Not showing wizard, showing loading state');
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </PageLayout>
    );
  }

  console.log('✅ [BecomePartner] RENDERING WIZARDS - All checks passed');

  return (
    <PartnerErrorBoundary
      fallbackMessage="There was an error loading the partner application page. Please try again."
      onReset={() => {
        refetchPartner();
        refetchApplication();
      }}
    >
      <PageLayout profile={profile} onSignOut={signOut}>
        {/* Intro Wizard - Benefits of becoming a partner */}
        {!showApplicationWizard && (
          <>
            {console.log('📖 [BecomePartner] Rendering INTRO WIZARD')}
            <PartnerWizard
              open={true} 
              onComplete={() => {
                console.log('✅ [BecomePartner] Intro wizard onComplete called');
                handleIntroWizardComplete();
              }}
              onClose={() => {
                console.log('❌ [BecomePartner] Intro wizard onClose called - User cancelled');
                console.log('🔄 [BecomePartner] Setting isNavigating and navigating to dashboard');
                setIsNavigating(true);
                navigate('/dashboard', { replace: true });
              }}
            />
          </>
        )}

        {/* Application Wizard - Multi-step form */}
        {showApplicationWizard && (
          <>
            {console.log('📝 [BecomePartner] Rendering APPLICATION WIZARD')}
            <PartnerApplicationWizard
              onComplete={() => {
                console.log('✅ [BecomePartner] Application wizard onComplete called');
                handleApplicationComplete();
              }}
              onCancel={() => {
                console.log('❌ [BecomePartner] Application wizard onCancel called');
                handleApplicationCancel();
              }}
            />
          </>
        )}
      </PageLayout>
    </PartnerErrorBoundary>
  );
};

export default BecomePartner;
