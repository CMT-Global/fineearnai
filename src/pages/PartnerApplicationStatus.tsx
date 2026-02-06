import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePartnerStatus } from "@/hooks/usePartner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  ArrowLeft,
  MessageSquare,
  Globe,
  HeartHandshake,
  Shield,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect, useRef } from "react";
import { PartnerWizard } from "@/components/partner/PartnerWizard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { QueryErrorBoundary } from "@/components/shared/QueryErrorBoundary";
import { PartnerErrorBoundary } from "@/components/partner/PartnerErrorBoundary";
import { generateCorrelationId } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const PartnerApplicationStatus = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { data: profile } = useProfile(user?.id || '');
  const [showWizard, setShowWizard] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [correlationId, setCorrelationId] = useState<string>("");

  // Phase 3: useRef guard to prevent duplicate correlation ID generation in React Strict Mode
  const correlationIdInitialized = useRef(false);

  // Phase 3: Generate correlation ID on mount with useRef guard to prevent duplicates in Strict Mode
  useEffect(() => {
    // Phase 3: Check ref guard - only generate once per mount
    if (user && !correlationId && !correlationIdInitialized.current) {
      correlationIdInitialized.current = true; // Mark as initialized
      
      const newCorrelationId = generateCorrelationId();
      setCorrelationId(newCorrelationId);
    }
  }, [user, correlationId]);

  // Phase 2: Use unified hook to fetch both partner status and application in one request
  const { 
    data: partnerStatus, 
    isSuccess: partnerStatusSuccess, 
    error: partnerStatusError, 
    refetch: refetchPartnerStatus 
  } = usePartnerStatus(correlationId);

  // Destructure partner status for convenience
  const isPartner = partnerStatus?.isPartner ?? false;
  const application = partnerStatus?.application ?? null;

  // Phase 4: Align ready state computation with BecomePartner
  const ready = !!user && partnerStatusSuccess;

  // Phase 4: Compute pendingRedirect gate - redirect if partner or no application
  const pendingRedirect = ready && !isNavigating && (isPartner || !application);

  // Phase 4: Effect-driven redirects - minimal dependencies, only runs after data is settled
  useEffect(() => {
    if (!ready) {
      return;
    }
    
    // Redirect approved partners to dashboard
    if (isPartner) {
      console.log('✅ [ApplicationStatus] Redirecting approved partner to dashboard');
      setIsNavigating(true);
      navigate('/partner/dashboard', { replace: true });
      return;
    }
    
    // Redirect users without application to become-partner
    if (!application) {
      console.log('⚠️ [ApplicationStatus] No application found, redirecting to become-partner');
      setIsNavigating(true);
      navigate('/become-partner', { replace: true });
      return;
    }
  }, [ready, isPartner, application, navigate]);

  // Phase 4: Handle errors first
  if (partnerStatusError) {
    return (
      <>
        <QueryErrorBoundary
          error={partnerStatusError} 
          reset={() => {
            refetchPartnerStatus();
          }}
        />
      </>
    );
  }

  // Phase 4: Early return for navigation state
  if (isNavigating) {
    return (
      <>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text={t("partner.dashboard.redirecting")} />
        </div>
      </>
    );
  }

  // Phase 4: Show loading state while data is being fetched
  if (!ready) {
    return (
      <>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text={t("partner.applicationStatus.loading")} />
        </div>
      </>
    );
  }

  // Phase 4: Early return for pendingRedirect - prevents flicker before redirect
  if (pendingRedirect) {
    return (
      <>
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" text={t("partner.dashboard.redirecting")} />
        </div>
      </>
    );
  }

  // Phase 4: At this point, we know we have an application to display
  // TypeScript safety: application is guaranteed to exist here due to pendingRedirect gate

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { 
      variant: any; 
      icon: any; 
      label: string;
      color: string;
      description: string;
    }> = {
      pending: { 
        variant: "secondary", 
        icon: Clock, 
        label: t("partner.applicationStatus.status.pending.label"),
        color: "text-yellow-600",
        description: t("partner.applicationStatus.status.pending.description")
      },
      approved: { 
        variant: "default", 
        icon: CheckCircle, 
        label: t("partner.applicationStatus.status.approved.label"),
        color: "text-green-600",
        description: t("partner.applicationStatus.status.approved.description")
      },
      rejected: { 
        variant: "destructive", 
        icon: XCircle, 
        label: t("partner.applicationStatus.status.rejected.label"),
        color: "text-destructive",
        description: t("partner.applicationStatus.status.rejected.description")
      },
    };

    return configs[status] || configs.pending;
  };

  const statusConfig = getStatusConfig(application.status);
  const StatusIcon = statusConfig.icon;

  return (
    <PartnerErrorBoundary
      fallbackMessage="There was an error loading your partner application status. Please try again."
      onReset={() => {
        refetchPartnerStatus();
      }}
    >
      <>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("partner.applicationStatus.backToDashboard")}
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{t("partner.applicationStatus.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("partner.applicationStatus.subtitle")}
          </p>
        </div>

        {/* Partner Info Wizard Dialog */}
        {showWizard && (
          <PartnerWizard
            open={showWizard}
            onComplete={() => setShowWizard(false)}
            onClose={() => setShowWizard(false)}
          />
        )}

        {/* Status Alert */}
        <Alert className={`mb-6 ${application.status === 'approved' ? 'border-green-600' : application.status === 'rejected' ? 'border-destructive' : 'border-yellow-600'}`}>
          <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
          <AlertDescription className="ml-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold mb-1">{statusConfig.label}</div>
                <p className="text-sm">{statusConfig.description}</p>
              </div>
              <Badge variant={statusConfig.variant} className="shrink-0">
                {statusConfig.label}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>

        {/* Rejection Reason */}
        {application.status === 'rejected' && application.rejection_reason && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                {t("partner.applicationStatus.sections.rejectionReason")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{application.rejection_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* Application Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("partner.applicationStatus.sections.applicationDetails")}</CardTitle>
            <CardDescription>
              {t("partner.applicationStatus.sections.submitted", {
                timeAgo: formatDistanceToNow(new Date(application.created_at), { addSuffix: true }),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-primary" />
                {t("partner.applicationStatus.sections.contactInformation")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pl-6">
                <div>
                  <span className="text-muted-foreground">{t("partner.applicationStatus.fields.preferredContact")}</span>
                  <p className="font-medium capitalize">{application.preferred_contact_method}</p>
                </div>
                {application.whatsapp_number && (
                  <div>
                    <span className="text-muted-foreground">{t("partner.applicationStatus.fields.whatsapp")}</span>
                    <p className="font-medium">{application.whatsapp_number}</p>
                  </div>
                )}
                {application.telegram_username && (
                  <div>
                    <span className="text-muted-foreground">{t("partner.applicationStatus.fields.telegram")}</span>
                    <p className="font-medium">@{application.telegram_username}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Network & Experience */}
            {(application.manages_community || application.promoted_platforms || application.network_description) && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Globe className="h-4 w-4 text-primary" />
                    {t("partner.applicationStatus.sections.networkAndExperience")}
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {application.manages_community !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t("partner.applicationStatus.fields.managesCommunity")}</span>
                            {application.manages_community ? (
                              <Badge variant="default">{t("common.yes")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("common.no")}</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.community_member_count && (
                        <div>
                          <span className="text-muted-foreground">{t("partner.applicationStatus.fields.communitySize")}</span>
                          <p className="font-medium">
                            {t("partner.applicationStatus.values.members", { count: application.community_member_count })}
                          </p>
                        </div>
                      )}
                      {application.promoted_platforms !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t("partner.applicationStatus.fields.hasPromotedPlatforms")}</span>
                            {application.promoted_platforms ? (
                              <Badge variant="default">{t("common.yes")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("common.no")}</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.expected_monthly_onboarding && (
                        <div>
                          <span className="text-muted-foreground">{t("partner.applicationStatus.fields.monthlyOnboarding")}</span>
                          <p className="font-medium">
                            {t("partner.applicationStatus.values.users", { count: application.expected_monthly_onboarding })}
                          </p>
                        </div>
                      )}
                      {application.weekly_time_commitment && (
                        <div>
                          <span className="text-muted-foreground">{t("partner.applicationStatus.fields.timeCommitment")}</span>
                          <p className="font-medium">
                            {t("partner.applicationStatus.values.hoursPerWeek", { count: application.weekly_time_commitment })}
                          </p>
                        </div>
                      )}
                    </div>

                    {application.platform_promotion_details && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t("partner.applicationStatus.fields.platformPromotionDetails")}</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.platform_promotion_details}</p>
                      </div>
                    )}

                    {application.network_description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t("partner.applicationStatus.fields.networkDescription")}</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.network_description}</p>
                      </div>
                    )}

                    {application.community_group_links && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t("partner.applicationStatus.fields.communityLinks")}</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg break-all">{application.community_group_links}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Support & Capabilities */}
            {(application.can_provide_local_support !== null || application.organize_training_sessions !== null || application.local_payment_methods) && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <HeartHandshake className="h-4 w-4 text-primary" />
                    {t("partner.applicationStatus.sections.supportAndCapabilities")}
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {application.can_provide_local_support !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t("partner.applicationStatus.fields.canProvideLocalSupport")}</span>
                            {application.can_provide_local_support ? (
                              <Badge variant="default">{t("common.yes")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("common.no")}</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.organize_training_sessions !== null && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t("partner.applicationStatus.fields.canOrganizeTraining")}</span>
                            {application.organize_training_sessions ? (
                              <Badge variant="default">{t("common.yes")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("common.no")}</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {application.support_preference && (
                        <div>
                          <span className="text-muted-foreground">{t("partner.applicationStatus.fields.supportMethod")}</span>
                          <p className="font-medium capitalize">{application.support_preference}</p>
                        </div>
                      )}
                    </div>

                    {application.local_payment_methods && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t("partner.applicationStatus.fields.localPaymentMethods")}</span>
                        <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.local_payment_methods}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Motivation & Agreement */}
            {application.motivation_text && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  {t("partner.applicationStatus.sections.motivationAndAgreement")}
                </div>
                <div className="space-y-3 pl-6">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t("partner.applicationStatus.fields.whyPartner")}</span>
                    <p className="mt-1 p-3 bg-muted/50 rounded-lg">{application.motivation_text}</p>
                  </div>
                  <div className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("partner.applicationStatus.fields.agreedToGuidelines")}</span>
                      {application.agrees_to_guidelines ? (
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t("common.yes")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("common.no")}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="flex-1"
          >
            {t("partner.applicationStatus.actions.returnToDashboard")}
          </Button>
          
          {/* NEW: How It Works button */}
          <Button
            variant="outline"
            onClick={() => setShowWizard(true)}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {t("howItWorks.title")}
          </Button>
          
          {application.status === 'pending' && (
            <Button
              variant="secondary"
              disabled
              className="flex-1 cursor-not-allowed"
              title={t("partner.applicationStatus.actions.cannotEditWhileReview")}
            >
              {t("partner.applicationStatus.actions.underReview")}
            </Button>
          )}
          {application.status === 'approved' && (
            <Button
              variant="default"
              onClick={() => navigate('/partner/dashboard')}
              className="flex-1"
            >
              {t("partner.applicationStatus.actions.goToPartnerDashboard")}
            </Button>
          )}
        </div>
      </div>
    </>
    </PartnerErrorBoundary>
  );
};

export default PartnerApplicationStatus;
