import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { partnerDebugLogger } from "@/lib/partner-debug-logger";
import { useTranslation } from "react-i18next";

const BecomePartner = () => {
  const { t } = useTranslation();
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

  const { data: partnerProgramConfig, isLoading: isLoadingPartnerConfig } = useQuery({
    queryKey: ["partner-program-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "partner_program_config")
        .maybeSingle();

      if (error) throw error;

      return (data?.value as { isEnabled?: boolean }) ?? { isEnabled: true };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: partnerProgramContent } = useQuery({
    queryKey: ["partner-program-content-meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "partner_program_content")
        .maybeSingle();

      if (error) throw error;

      return (data?.value as { wizard?: { isEnabled?: boolean } }) ?? { wizard: { isEnabled: true } };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Destructure partner status for convenience
  const isPartner = partnerStatus?.isPartner ?? false;
  const application = partnerStatus?.application ?? null;

  const isPartnerProgramEnabled = partnerProgramConfig?.isEnabled ?? true;
  const isWizardEnabled = partnerProgramContent?.wizard?.isEnabled ?? true;

  // Compute ready state - only true when user exists, partner config is loaded AND query has settled successfully
  const ready = !!user && partnerStatusSuccess && !isLoadingPartnerConfig && isPartnerProgramEnabled;

  // Phase 3: Generate correlation ID on mount with useRef guard to prevent duplicates in Strict Mode
  useEffect(() => {
    // Phase 3: Check ref guard - only generate once per mount
    if (user && !correlationId && !correlationIdInitialized.current) {
      correlationIdInitialized.current = true; // Mark as initialized
      
      const newCorrelationId = generateCorrelationId();
      setCorrelationId(newCorrelationId);
      
      // Phase 5: Log page entry with correlation ID
      partnerDebugLogger.info('become-partner.page-entered', {
        userId: user.id,
        userEmail: user.email,
        timestamp: new Date().toISOString(),
      }, newCorrelationId);
    }
  }, [user, correlationId]);

  // Effect-driven redirects - only runs after data is settled
  useEffect(() => {
    // CRITICAL: Wait for ready state before ANY redirect logic
    if (!ready) {
      return;
    }
    
    // If partner program is disabled, always send users back to dashboard
    if (!isPartnerProgramEnabled) {
      setIsNavigating(true);
      navigate('/dashboard', { replace: true });
      return;
    }
    
    // Redirect approved partners to dashboard
    if (isPartner) {
      console.log('✅ [BecomePartner] Redirecting partner to dashboard');
      
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
      console.log('✅ [BecomePartner] Redirecting user with application to status page');
      
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
      ? t("partner.becomePartner.errors.network")
      : isAuthError
      ? t("partner.becomePartner.errors.sessionExpired")
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
    setShowApplicationWizard(true);
  };

  const handleApplicationComplete = async () => {
    console.log('✅ [BecomePartner] Application completed, redirecting to status page');
    try {
      await queryClient.invalidateQueries({ queryKey: ['partner-status'] });
      navigate('/partner/application-status', { replace: true });
    } catch (error) {
      console.error('🚨 [BecomePartner] Error in handleApplicationComplete:', error);
    }
  };

  const handleApplicationCancel = () => {
    navigate('/dashboard', { replace: true });
  };

  // Early return if navigation is in progress to prevent wizard flash
  if (isNavigating) {
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text={t("partner.dashboard.redirecting")} />
        </div>
      </PageLayout>
    );
  }

  // Show loading state while waiting for ready state or when partner program is disabled
  if (!ready) {
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner
            size="lg"
            text={isPartnerProgramEnabled ? t("common.loading") : t("partner.dashboard.redirecting")}
          />
        </div>
      </PageLayout>
    );
  }

  // Only render wizards when ready and no redirect is needed
  const shouldShowWizard = ready && !isNavigating && !isPartner && !application;

  // Phase 1: Compute pending redirect - if we're ready and should redirect but navigation hasn't started yet
  const pendingRedirect = ready && !isNavigating && (isPartner || !!application);

  // Phase 1: If we're about to redirect, show redirecting UI immediately
  if (pendingRedirect) {
    return (
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text={t("partner.dashboard.redirecting")} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PartnerErrorBoundary
      fallbackMessage={t("partner.becomePartner.errors.pageLoad")}
      onReset={() => {
        refetchPartnerStatus();
      }}
    >
      <PageLayout profile={profile} isAdmin={isAdmin} onSignOut={signOut}>
        {/* Intro Wizard - Benefits of becoming a partner */}
        {!showApplicationWizard && isWizardEnabled && (
          <PartnerWizard
            open={true} 
            onComplete={() => {
              handleIntroWizardComplete();
            }}
            onClose={() => {
              setIsNavigating(true);
              navigate('/dashboard', { replace: true });
            }}
          />
        )}

        {/* Application Wizard - Multi-step form */}
        {(showApplicationWizard || !isWizardEnabled) && (
          <PartnerApplicationWizard
            correlationId={correlationId}
            onComplete={() => {
              handleApplicationComplete();
            }}
            onCancel={() => {
              handleApplicationCancel();
            }}
          />
        )}
      </PageLayout>
    </PartnerErrorBoundary>
  );
};

export default BecomePartner;
