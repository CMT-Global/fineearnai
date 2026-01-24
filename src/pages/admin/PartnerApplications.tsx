import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { PartnerApplicationsErrorBoundary } from "@/components/admin/PartnerApplicationsErrorBoundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePartnerApplications, useManagePartnerApplication } from "@/hooks/usePartnerManagement";
import { Loader2, CheckCircle, XCircle, Clock, Users, Sparkles, MessageSquare, Globe, Calendar, HeartHandshake, DollarSign, Shield, Filter, ArrowUpDown, Briefcase, TrendingUp, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries } from "@/lib/countries";

const PartnerApplications = () => {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const [activeTab, setActiveTab] = useState("pending");
  const { data: applications, isLoading } = usePartnerApplications(activeTab);
  const manageMutation = useManagePartnerApplication();
  
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterEmployment, setFilterEmployment] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");

  // Dialog state
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [customCommission, setCustomCommission] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Force re-render when language changes

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Clock, label: t("admin.partnerApplications.status.pending") },
      approved: { variant: "default", icon: CheckCircle, label: t("admin.partnerApplications.status.approved") },
      rejected: { variant: "destructive", icon: XCircle, label: t("admin.partnerApplications.status.rejected") },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getCountryName = (code: string) => {
    return countries.find(c => c.code === code)?.name || code;
  };

  const getCountryFlag = (code: string) => {
    if (!code || code.length !== 2) return "🌍";
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
  };

  // Handler functions
  const handleAction = (app: any, action: 'approve' | 'reject') => {
    setSelectedApplication(app);
    setActionType(action);
    setCustomCommission("");
    setRejectionReason("");
  };

  const handleConfirm = async () => {
    if (!selectedApplication) return;

    try {
      const payload: any = {
        application_id: selectedApplication.id,
        action: actionType,
      };

      if (actionType === 'approve' && customCommission) {
        payload.custom_commission_rate = parseFloat(customCommission);
      }

      if (actionType === 'reject') {
        payload.rejection_reason = rejectionReason;
      }

      await manageMutation.mutateAsync(payload);
      setSelectedApplication(null);
      setCustomCommission("");
      setRejectionReason("");
    } catch (error) {
      console.error('Error managing application:', error);
    }
  };

  // Filtered and sorted applications
  const filteredAndSortedApplications = useMemo(() => {
    if (!applications) return [];

    let filtered = [...applications];

    // Apply filters
    if (filterCountry !== "all") {
      filtered = filtered.filter(app => app.applicant_country === filterCountry);
    }

    if (filterPlan !== "all") {
      filtered = filtered.filter(app => app.current_membership_plan === filterPlan);
    }

    if (filterEmployment !== "all") {
      const isEmployed = filterEmployment === "employed";
      filtered = filtered.filter(app => app.is_currently_employed === isEmployed);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "referrals_desc":
          return (b.total_referrals || 0) - (a.total_referrals || 0);
        case "referrals_asc":
          return (a.total_referrals || 0) - (b.total_referrals || 0);
        case "country_asc":
          return getCountryName(a.applicant_country || "").localeCompare(getCountryName(b.applicant_country || ""));
        case "country_desc":
          return getCountryName(b.applicant_country || "").localeCompare(getCountryName(a.applicant_country || ""));
        default:
          return 0;
      }
    });

    return filtered;
  }, [applications, filterCountry, filterPlan, filterEmployment, sortBy]);

  // Get unique countries and plans for filter dropdowns
  const uniqueCountries = useMemo(() => {
    if (!applications) return [];
    const countries = [...new Set(applications.map((app: any) => app.applicant_country).filter(Boolean))];
    return countries.sort();
  }, [applications]);

  const uniquePlans = useMemo(() => {
    if (!applications) return [];
    const plans = [...new Set(applications.map((app: any) => app.current_membership_plan).filter(Boolean))];
    return plans.sort();
  }, [applications]);

  const pendingCount = applications?.filter((a: any) => a.status === 'pending').length || 0;

  return (
    <PartnerApplicationsErrorBoundary>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{t("admin.partnerApplications.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("admin.partnerApplications.subtitle")}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.partnerApplications.stats.pendingReview")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.partnerApplications.stats.totalApplications")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{applications?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.partnerApplications.stats.approvalRate")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {applications?.length
                  ? Math.round((applications.filter((a: any) => a.status === 'approved').length / applications.length) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">
              {t("admin.partnerApplications.tabs.pending")}
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">{t("admin.partnerApplications.tabs.approved")}</TabsTrigger>
            <TabsTrigger value="rejected">{t("admin.partnerApplications.tabs.rejected")}</TabsTrigger>
            <TabsTrigger value="all">{t("admin.partnerApplications.tabs.all")}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Filters and Sorting */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{t("admin.partnerApplications.filters.title")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">{t("admin.partnerApplications.filters.country")}</Label>
                    <Select value={filterCountry} onValueChange={setFilterCountry}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.partnerApplications.filters.allCountries")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("admin.partnerApplications.filters.allCountries")}</SelectItem>
                        {uniqueCountries.map((code) => (
                          <SelectItem key={code} value={code}>
                            {getCountryFlag(code)} {getCountryName(code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">{t("admin.partnerApplications.filters.membershipPlan")}</Label>
                    <Select value={filterPlan} onValueChange={setFilterPlan}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.partnerApplications.filters.allPlans")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("admin.partnerApplications.filters.allPlans")}</SelectItem>
                        {uniquePlans.map((plan) => (
                          <SelectItem key={plan} value={plan}>
                            {plan.charAt(0).toUpperCase() + plan.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">{t("admin.partnerApplications.filters.employmentStatus")}</Label>
                    <Select value={filterEmployment} onValueChange={setFilterEmployment}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.partnerApplications.filters.allStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("admin.partnerApplications.filters.allStatus")}</SelectItem>
                        <SelectItem value="employed">{t("admin.partnerApplications.filters.employed")}</SelectItem>
                        <SelectItem value="unemployed">{t("admin.partnerApplications.filters.unemployed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">{t("admin.partnerApplications.filters.sortBy")}</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("admin.partnerApplications.filters.sortByPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_desc">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {t("admin.partnerApplications.sort.newestFirst")}
                          </div>
                        </SelectItem>
                        <SelectItem value="date_asc">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {t("admin.partnerApplications.sort.oldestFirst")}
                          </div>
                        </SelectItem>
                        <SelectItem value="referrals_desc">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {t("admin.partnerApplications.sort.mostReferrals")}
                          </div>
                        </SelectItem>
                        <SelectItem value="referrals_asc">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {t("admin.partnerApplications.sort.leastReferrals")}
                          </div>
                        </SelectItem>
                        <SelectItem value="country_asc">
                          <div className="flex items-center gap-2">
                            <Flag className="h-4 w-4" />
                            {t("admin.partnerApplications.sort.countryAZ")}
                          </div>
                        </SelectItem>
                        <SelectItem value="country_desc">
                          <div className="flex items-center gap-2">
                            <Flag className="h-4 w-4" />
                            {t("admin.partnerApplications.sort.countryZA")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(filterCountry !== "all" || filterPlan !== "all" || filterEmployment !== "all") && (
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterCountry("all");
                        setFilterPlan("all");
                        setFilterEmployment("all");
                      }}
                    >
                      {t("admin.partnerApplications.filters.clearFilters")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("admin.partnerApplications.filters.showingResults", { 
                        showing: filteredAndSortedApplications.length, 
                        total: applications?.length || 0 
                      })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAndSortedApplications && filteredAndSortedApplications.length > 0 ? (
              <div className="grid gap-4">
                {filteredAndSortedApplications.map((app: any) => (
                  <Card key={app.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {app.profiles?.full_name || app.profiles?.username || 'Unknown User'}
                          </CardTitle>
                          <CardDescription>
                            @{app.profiles?.username} • {app.profiles?.email}
                          </CardDescription>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Applicant Profile & Stats */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Users className="h-4 w-4 text-primary" />
                            {t("admin.partnerApplications.applicantProfile.title")}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pl-6">
                            {app.applicant_country && (
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.applicantProfile.country")}:</span>
                                <p className="font-medium flex items-center gap-2 mt-1">
                                  <span className="text-2xl">{getCountryFlag(app.applicant_country)}</span>
                                  {getCountryName(app.applicant_country)}
                                </p>
                              </div>
                            )}
                            {app.current_membership_plan && (
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.applicantProfile.membershipPlan")}:</span>
                                <Badge variant="outline" className="mt-1 capitalize">
                                  {app.current_membership_plan}
                                </Badge>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground">{t("admin.partnerApplications.applicantProfile.employmentStatus")}:</span>
                              <p className="font-medium">
                                {app.is_currently_employed ? (
                                  <Badge variant="default" className="ml-2">
                                    <Briefcase className="h-3 w-3 mr-1" />
                                    {t("admin.partnerApplications.filters.employed")}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="ml-2">{t("admin.partnerApplications.filters.unemployed")}</Badge>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pl-6 pt-2">
                            <div>
                              <span className="text-muted-foreground">{t("admin.partnerApplications.applicantProfile.totalReferrals")}:</span>
                              <p className="font-bold text-lg text-primary">{app.total_referrals || 0}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{t("admin.partnerApplications.applicantProfile.upgradedReferrals")}:</span>
                              <p className="font-bold text-lg text-green-600">{app.upgraded_referrals || 0}</p>
                            </div>
                            {app.daily_time_commitment && (
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.applicantProfile.dailyCommitment")}:</span>
                                <Badge variant="outline" className="mt-1">{t("admin.partnerApplications.applicantProfile.hours", { hours: app.daily_time_commitment })}</Badge>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Basic Contact Information */}
                        <div className="space-y-3 border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            {t("admin.partnerApplications.contactInfo.title")}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pl-6">
                            <div>
                              <span className="text-muted-foreground">{t("admin.partnerApplications.contactInfo.preferredContact")}:</span>
                              <p className="font-medium capitalize">{app.preferred_contact_method || t("admin.partnerApplications.contactInfo.notSpecified")}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{t("admin.partnerApplications.contactInfo.applied")}:</span>
                              <p className="font-medium">
                                {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {app.whatsapp_number && (
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.contactInfo.whatsapp")}:</span>
                                <p className="font-medium">{app.whatsapp_number}</p>
                              </div>
                            )}
                            {app.telegram_username && (
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.contactInfo.telegram")}:</span>
                                <p className="font-medium">@{app.telegram_username}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Network & Experience */}
                        <div className="space-y-3 border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Globe className="h-4 w-4 text-primary" />
                            {t("admin.partnerApplications.networkExperience.title")}
                          </div>
                          <div className="space-y-3 pl-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.managesCommunity")}:</span>
                                <p className="font-medium">
                                  {app.manages_community ? (
                                    <Badge variant="default" className="ml-2">{t("common.yes")}</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">{t("common.no")}</Badge>
                                  )}
                                </p>
                              </div>
                              {app.community_member_count && (
                                <div>
                                  <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.communitySize")}:</span>
                                  <p className="font-medium">{t("admin.partnerApplications.networkExperience.members", { count: app.community_member_count })}</p>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.hasPromotedPlatforms")}:</span>
                                <p className="font-medium">
                                  {app.promoted_platforms ? (
                                    <Badge variant="default" className="ml-2">{t("common.yes")}</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">{t("common.no")}</Badge>
                                  )}
                                </p>
                              </div>
                              {app.expected_monthly_onboarding && (
                                <div>
                                  <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.monthlyOnboarding")}:</span>
                                  <p className="font-medium">{t("admin.partnerApplications.networkExperience.users", { count: app.expected_monthly_onboarding })}</p>
                                </div>
                              )}
                              {app.weekly_time_commitment && (
                                <div>
                                  <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.timeCommitment")}:</span>
                                  <p className="font-medium">{t("admin.partnerApplications.networkExperience.hoursPerWeek", { hours: app.weekly_time_commitment })}</p>
                                </div>
                              )}
                            </div>

                            {app.platform_promotion_details && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.platformPromotionDetails")}:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.platform_promotion_details}</p>
                              </div>
                            )}

                            {app.network_description && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.networkDescription")}:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.network_description}</p>
                              </div>
                            )}

                            {app.community_group_links && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{t("admin.partnerApplications.networkExperience.communityLinks")}:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg break-all">{app.community_group_links}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Local Support & Capabilities */}
                        <div className="space-y-3 border-t pt-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <HeartHandshake className="h-4 w-4 text-primary" />
                            {t("admin.partnerApplications.supportCapabilities.title")}
                          </div>
                          <div className="space-y-3 pl-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.supportCapabilities.canProvideLocalSupport")}:</span>
                                <p className="font-medium">
                                  {app.can_provide_local_support ? (
                                    <Badge variant="default" className="ml-2">{t("common.yes")}</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">{t("common.no")}</Badge>
                                  )}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">{t("admin.partnerApplications.supportCapabilities.canOrganizeTraining")}:</span>
                                <p className="font-medium">
                                  {app.organize_training_sessions ? (
                                    <Badge variant="default" className="ml-2">{t("common.yes")}</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="ml-2">{t("common.no")}</Badge>
                                  )}
                                </p>
                              </div>
                              {app.support_preference && (
                                <div>
                                  <span className="text-muted-foreground">{t("admin.partnerApplications.supportCapabilities.supportMethod")}:</span>
                                  <p className="font-medium capitalize">{app.support_preference}</p>
                                </div>
                              )}
                            </div>

                            {app.local_payment_methods && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">{t("admin.partnerApplications.supportCapabilities.localPaymentMethods")}:</span>
                                <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.local_payment_methods}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Motivation & Agreement */}
                        {app.motivation_text && (
                          <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <Shield className="h-4 w-4 text-primary" />
                              {t("admin.partnerApplications.motivationAgreement.title")}
                            </div>
                            <div className="text-sm pl-6">
                              <span className="text-muted-foreground">{t("admin.partnerApplications.motivationAgreement.whyPartner")}:</span>
                              <p className="mt-1 p-3 bg-muted/50 rounded-lg">{app.motivation_text}</p>
                            </div>
                            <div className="text-sm pl-6">
                              <span className="text-muted-foreground">{t("admin.partnerApplications.motivationAgreement.agreedToGuidelines")}:</span>
                              <p className="font-medium">
                                {app.agrees_to_guidelines ? (
                                  <Badge variant="default" className="ml-2">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {t("common.yes")}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="ml-2">{t("common.no")}</Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        )}

                        {app.status === 'pending' && (
                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              onClick={() => handleAction(app, 'approve')}
                              className="flex-1"
                              disabled={manageMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {t("admin.partnerApplications.actions.approve")}
                            </Button>
                            <Button
                              onClick={() => handleAction(app, 'reject')}
                              variant="destructive"
                              className="flex-1"
                              disabled={manageMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {t("admin.partnerApplications.actions.reject")}
                            </Button>
                          </div>
                        )}

                        {app.status === 'rejected' && app.rejection_reason && (
                          <div className="text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                            <span className="text-muted-foreground">{t("admin.partnerApplications.rejectionReason")}:</span>
                            <p className="mt-1">{app.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">{t("admin.partnerApplications.noApplicationsFound")}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval/Rejection Dialog */}
      <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? t("admin.partnerApplications.dialog.approveTitle") : t("admin.partnerApplications.dialog.rejectTitle")}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? t("admin.partnerApplications.dialog.approveDescription", { username: selectedApplication?.profiles?.username })
                : t("admin.partnerApplications.dialog.rejectDescription", { username: selectedApplication?.profiles?.username })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionType === 'approve' && (
              <div className="space-y-2">
                <Label>{t("admin.partnerApplications.dialog.customCommissionRate")}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="10"
                    value={customCommission}
                    onChange={(e) => setCustomCommission(e.target.value)}
                    min="0"
                    max="50"
                    step="0.1"
                  />
                  <span className="flex items-center text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("admin.partnerApplications.dialog.customCommissionHint")}
                </p>
              </div>
            )}

            {actionType === 'reject' && (
              <div className="space-y-2">
                <Label>{t("admin.partnerApplications.dialog.rejectionReasonRequired")}</Label>
                <Textarea
                  placeholder={t("admin.partnerApplications.dialog.rejectionReasonPlaceholder")}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApplication(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              disabled={
                manageMutation.isPending ||
                (actionType === 'reject' && !rejectionReason.trim())
              }
            >
              {manageMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === 'approve' ? t("admin.partnerApplications.dialog.confirmApproval") : t("admin.partnerApplications.dialog.confirmRejection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PartnerApplicationsErrorBoundary>
  );
};

export default PartnerApplications;
