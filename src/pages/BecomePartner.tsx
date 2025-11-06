import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/layout/PageLayout";
import { PartnerWizard } from "@/components/partner/PartnerWizard";
import { PartnerApplicationWizard } from "@/components/partner/PartnerApplicationWizard";
import { usePartnerStatus } from "@/hooks/usePartner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { QueryErrorBoundary } from "@/components/shared/QueryErrorBoundary";
import { PartnerErrorBoundary } from "@/components/partner/PartnerErrorBoundary";
import { generateCorrelationId } from "@/lib/utils";
import { toast } from "sonner";
import { partnerDebugLogger } from "@/lib/partner-debug-logger";

const BecomePartner = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [showApplicationWizard, setShowApplicationWizard] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [correlationId, setCorrelationId] = useState<string>("");
  
  // Phase 3: useRef guard to prevent duplicate correlation ID generation in React Strict Mode
  const correlationIdInitialized = useRef(false);
  
  // Phase 2: Use unified hook to fetch both partner status and application in one request
  const { 
    data: partnerStatus, 
    isSuccess: partnerStatusSuccess, 
    error: partnerStatusError, 
    refetch: refetchPartnerStatus 
  } = usePartnerStatus(correlationId);
  
  const { data: profile } = useProfile(user?.id || '');

  // Destructure partner status for convenience
  const isPartner = partnerStatus?.isPartner ?? false;
  const application = partnerStatus?.application ?? null;

  // Compute ready state - only true when user exists AND query has settled successfully
  const ready = !!user && partnerStatusSuccess;
  
  // Log ready state computation
  console.log('🎯 [BecomePartner] Ready State Computed:', {
    ready,
    hasUser: !!user,
    partnerStatusSuccess,
    timestamp: new Date().toISOString()
  });

  // Phase 3: Generate correlation ID on mount with useRef guard to prevent duplicates in Strict Mode
  useEffect(() => {
    // Phase 3: Check ref guard - only generate once per mount
    if (user && !correlationId && !correlationIdInitialized.current) {
      correlationIdInitialized.current = true; // Mark as initialized
      
      const newCorrelationId = generateCorrelationId();
      setCorrelationId(newCorrelationId);
      
      console.log('🆔 [BecomePartner] Correlation ID generated:', newCorrelationId);
      
      // Phase 5: Log page entry with correlation ID
      partnerDebugLogger.info('become-partner.page-entered', {
        userId: user.id,
        userEmail: user.email,
        timestamp: new Date().toISOString(),
      }, newCorrelationId);
      
      // Only show Debug ID in development mode or when ?debug=true is in URL
      const isDevelopment = import.meta.env.DEV;
      const hasDebugParam = new URLSearchParams(window.location.search).get('debug') === 'true';

      if (isDevelopment || hasDebugParam) {
        toast.info(`Debug ID: ${newCorrelationId}`, {
          description: "Use this ID to track your partner application in backend logs",
          duration: 10000,
          id: 'correlation-id-toast',
        });
      }
    }
  }, [user, correlationId]);

  // Debug logging for troubleshooting
  console.log('🔍 [BecomePartner] Component Render State:', {
    timestamp: new Date().toISOString(),
    userId: user?.id,
    isPartner,
    hasApplication: !!application,
    applicationId: application?.id,
    applicationStatus: application?.status,
    partnerStatusSuccess,
    isNavigating,
    showApplicationWizard,
    profileLoaded: !!profile,
    userEmail: user?.email
  });

  // Log when partner status changes
  console.log('🔍 [BecomePartner] Partner Status Check Result:', {
    isPartner,
    partnerStatusSuccess,
    partnerStatusError: partnerStatusError?.message
  });

  // Log when application status changes
  console.log('🔍 [BecomePartner] Application Check Result:', {
    hasApplication: !!application,
    applicationId: application?.id,
    applicationStatus: application?.status,
    partnerStatusSuccess,
    partnerStatusError: partnerStatusError?.message
  });

  // Effect-driven redirects - only runs after data is settled
  useEffect(() => {
    console.log('🔄 [BecomePartner] Redirect Effect Triggered:', {
      ready,
      isPartner,
      hasApplication: !!application,
      isNavigating,
      timestamp: new Date().toISOString()
    });
    
    // CRITICAL: Wait for ready state before ANY redirect logic
    if (!ready) {
      console.log('⏳ [BecomePartner] Not ready yet, waiting for queries to settle...', {
        hasUser: !!user,
        partnerStatusSuccess
      });
      return;
    }
    
    console.log('✅ [BecomePartner] Ready! Checking redirect conditions...');
    
    // Redirect approved partners to dashboard
    if (isPartner) {
      console.log('✅ [BecomePartner] USER IS PARTNER - Triggering redirect to dashboard');
      
      // Log redirect decision ONCE in effect
      partnerDebugLogger.info('become-partner.redirect-to-dashboard', {
        reason: 'user_is_partner',
        isPartner: true,
        timestamp: new Date().toISOString(),
      }, correlationId);
      
      setIsNavigating(true);
      navigate('/partner/dashboard', { replace: true });
      return;
    }
    
    // Redirect users with existing applications
    if (application) {
      console.log('✅ [BecomePartner] USER HAS APPLICATION - Triggering redirect to application-status');
      console.log('📋 [BecomePartner] Application details:', {
        id: application.id,
        status: application.status,
        created_at: application.created_at
      });
      
      // Log redirect decision ONCE in effect
      partnerDebugLogger.info('become-partner.redirect-to-application-status', {
        reason: 'user_has_application',
        applicationId: application.id,
        applicationStatus: application.status,
        timestamp: new Date().toISOString(),
      }, correlationId);
      
      setIsNavigating(true);
      navigate('/partner/application-status', { replace: true });
      return;
    }
    
    console.log('✅ [BecomePartner] No redirect needed, user can proceed with wizard');
    console.log('🎯 [BecomePartner] Effect complete - render will continue');
  }, [ready, isPartner, application, navigate]);

  // Handle errors - show error UI with retry and specific messages
  if (partnerStatusError) {
    const error = partnerStatusError;
    const isNetworkError = error?.message?.includes('fetch') || 
                          error?.message?.includes('Failed to fetch') ||
                          error?.message?.includes('network');
    const isAuthError = error?.message?.includes('session') || 
                       error?.message?.includes('Unauthorized') ||
                       error?.message?.includes('JWT') ||
                       error?.message?.includes('auth');
    
    console.error('🚨 [BecomePartner] ERROR DETECTED:', {
      timestamp: new Date().toISOString(),
      error: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      },
      isNetworkError,
      isAuthError,
      userId: user?.id,
      correlationId
    });

    const customMessage = isNetworkError 
      ? "Unable to load partner status. Please check your connection and try again."
      : isAuthError
      ? "Your session has expired. Please refresh the page or log in again."
      : undefined;

    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <QueryErrorBoundary
          error={error}
          customMessage={customMessage}
          reset={() => {
            console.log('🔄 [BecomePartner] Retrying after error...', { correlationId });
            refetchPartnerStatus();
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
      await queryClient.invalidateQueries({ queryKey: ['partner-status'] });
      console.log('✅ [BecomePartner] Invalidated partner-status query');
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
    console.log('🚦 [BecomePartner] Navigation in progress, showing redirect screen');
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      </PageLayout>
    );
  }

  // Show loading state while waiting for ready state
  if (!ready) {
    console.log('⏳ [BecomePartner] LOADING STATE (waiting for ready):', { hasUser: !!user, partnerStatusSuccess });
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </PageLayout>
    );
  }

  // Only render wizards when ready and no redirect is needed
  const shouldShowWizard = ready && !isNavigating && !isPartner && !application;
  
  console.log('🎯 [BecomePartner] SHOULD SHOW WIZARD CHECK:', {
    shouldShowWizard,
    reasons: {
      ready,
      isNavigating,
      isPartner,
      hasApplication: !!application
    },
    timestamp: new Date().toISOString()
  });

  // Phase 1: Compute pending redirect - if we're ready and should redirect but navigation hasn't started yet
  const pendingRedirect = ready && !isNavigating && (isPartner || !!application);
  
  console.log('🚦 [BecomePartner] Pending Redirect Check:', {
    pendingRedirect,
    ready,
    isNavigating,
    isPartner,
    hasApplication: !!application,
    timestamp: new Date().toISOString()
  });

  // Phase 1: If we're about to redirect, show redirecting UI immediately
  if (pendingRedirect) {
    console.log('🔄 [BecomePartner] Pending redirect detected, showing redirect screen');
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      </PageLayout>
    );
  }

  console.log('✅ [BecomePartner] RENDERING WIZARDS - All checks passed');

  return (
    <PartnerErrorBoundary
      fallbackMessage="There was an error loading the partner application page. Please try again."
      onReset={() => {
        refetchPartnerStatus();
      }}
    >
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
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
            {console.log('📝 [BecomePartner] Rendering APPLICATION WIZARD with correlationId:', correlationId)}
            <PartnerApplicationWizard
              correlationId={correlationId}
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
