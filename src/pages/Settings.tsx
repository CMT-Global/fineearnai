import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileSchema, changePasswordSchema, type UpdateProfileFormData, type ChangePasswordFormData } from "@/lib/auth-schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLayout } from "@/components/layout/PageLayout";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { Calendar, User, Mail, Award, Target, Users, Shield, MapPin, Globe, Info, Check, ChevronsUpDown, DollarSign, CheckCircle, AlertCircle, Wallet, Loader2, Languages } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SUPPORTED_CRYPTOCURRENCIES, validateCryptoAddress, getCryptoById } from "@/types/crypto-currencies";
import { countries, getCountryName } from "@/lib/countries";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { CURRENCIES, getCurrencyName, getCurrencySymbol } from "@/lib/currencies";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { EmailVerificationDialog } from "@/components/dashboard/EmailVerificationDialog";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LANGUAGES, getLanguageName, getLanguageFlag, SupportedLanguage } from "@/lib/country-language-map";
import { useTranslation } from "react-i18next";

const Settings = () => {
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [isCurrencyPopoverOpen, setIsCurrencyPopoverOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | "">("");
  const [isLanguagePopoverOpen, setIsLanguagePopoverOpen] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { userCurrency, updateUserCurrency, convertAmount, isLoading: isCurrencyLoading } = useCurrencyConversion();
  const { userLanguage, updateUserLanguage, isAutoDetected, isLoading: isLanguageLoading } = useLanguage();
  
  // Cryptocurrency address state
  const [usdcSolanaAddress, setUsdcSolanaAddress] = useState("");
  const [usdtBep20Address, setUsdtBep20Address] = useState("");
  const [cryptoAddressErrors, setCryptoAddressErrors] = useState<{
    usdc?: string;
    usdt?: string;
  }>({});

  // OTP state for withdrawal address changes
  const [showWithdrawalOTP, setShowWithdrawalOTP] = useState(false);
  const [withdrawalOTP, setWithdrawalOTP] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch profile data
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      
      if (error) throw error;
      
      // Initialize selected currency from profile
      if (data?.preferred_currency) {
        setSelectedCurrency(data.preferred_currency);
      }
      
      // Initialize selected language from profile
      if ((data as any)?.preferred_language) {
        setSelectedLanguage((data as any).preferred_language as SupportedLanguage);
      }
      
      // Initialize crypto addresses from profile
      setUsdcSolanaAddress(data?.usdc_solana_address || "");
      setUsdtBep20Address(data?.usdt_bep20_address || "");
      
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user statistics
  const { data: stats } = useQuery({
    queryKey: ["user-stats", user?.id],
    queryFn: async () => {
      const [tasksResult, referralsResult] = await Promise.all([
        supabase.from("user_tasks").select("id", { count: "exact", head: true }).eq("user_id", user?.id).eq("status", "completed"),
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user?.id),
      ]);
      
      return {
        totalTasks: tasksResult.count || 0,
        totalReferrals: referralsResult.count || 0,
      };
    },
    enabled: !!user?.id,
  });

  // Profile update form
  const profileForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      fullName: profile?.full_name || "",
      phone: profile?.phone || "",
      country: profile?.country || profile?.registration_country || profile?.last_login_country || "",
    },
  });

  // Password change form
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileFormData) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.fullName,
          phone: data.phone || null,
          country: data.country || null,
        })
        .eq("id", user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("settings.toasts.profileUpdated"));
    },
    onError: (error: Error) => {
      toast.error(`${t("settings.toasts.profileUpdateFailed")}: ${error.message}`);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordFormData) => {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      passwordForm.reset();
      setIsPasswordFormOpen(false);
      toast.success(t("settings.toasts.passwordChanged"));
    },
    onError: (error: Error) => {
      toast.error(`${t("settings.toasts.passwordChangeFailed")}: ${error.message}`);
    },
  });

  // Update currency mutation
  const updateCurrencyMutation = useMutation({
    mutationFn: async (currencyCode: string) => {
      await updateUserCurrency(currencyCode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("settings.toasts.currencyUpdated"));
    },
    onError: (error: Error) => {
      toast.error(`${t("settings.toasts.currencyUpdateFailed")}: ${error.message}`);
    },
  });

  // Update language mutation
  const updateLanguageMutation = useMutation({
    mutationFn: async (languageCode: SupportedLanguage) => {
      await updateUserLanguage(languageCode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("settings.toasts.languageUpdated"));
    },
    onError: (error: Error) => {
      toast.error(`${t("settings.toasts.languageUpdateFailed")}: ${error.message}`);
    },
  });

  // Update cryptocurrency addresses mutation
  const updateCryptoAddressesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          usdc_solana_address: usdcSolanaAddress.trim() || null,
          usdt_bep20_address: usdtBep20Address.trim() || null,
        })
        .eq("id", user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("settings.toasts.addressesUpdated"));
    },
    onError: (error: Error) => {
      toast.error(`${t("settings.toasts.addressesUpdateFailed")}: ${error.message}`);
    },
  });

  const onProfileSubmit = (data: UpdateProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: ChangePasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  const handleCurrencyUpdate = () => {
    if (selectedCurrency && selectedCurrency !== userCurrency) {
      updateCurrencyMutation.mutate(selectedCurrency);
    }
  };

  const handleLanguageUpdate = () => {
    if (selectedLanguage && selectedLanguage !== userLanguage) {
      updateLanguageMutation.mutate(selectedLanguage);
    }
  };

  const handleSendWithdrawalOTP = async () => {
    // Validate addresses before sending OTP
    const errors: { usdc?: string; usdt?: string } = {};
    
    if (usdcSolanaAddress.trim() && !validateCryptoAddress('usdc-solana', usdcSolanaAddress)) {
      errors.usdc = "Invalid USDC Solana address format";
    }
    
    if (usdtBep20Address.trim() && !validateCryptoAddress('usdt-bep20', usdtBep20Address)) {
      errors.usdt = "Invalid USDT BEP-20 address format";
    }
    
    setCryptoAddressErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      toast.error(t("settings.toasts.fixValidationErrors"));
      return;
    }

    if (!usdcSolanaAddress.trim() && !usdtBep20Address.trim()) {
      toast.error(t("settings.toasts.atLeastOneAddress"));
      return;
    }

    try {
      setSendingOTP(true);
      
      const { data, error } = await supabase.functions.invoke('send-withdrawal-address-otp', {
        body: {
          usdcAddress: usdcSolanaAddress.trim() || undefined,
          usdtAddress: usdtBep20Address.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setOtpSent(true);
      setShowWithdrawalOTP(true);
      toast.success(t('settings.toasts.otpSent'));
    } catch (error: any) {
      console.error('Failed to send OTP:', error);
      toast.error(error.message || t('settings.toasts.otpFailed'));
    } finally {
      setSendingOTP(false);
    }
  };

  const handleVerifyAndSaveAddresses = async () => {
    if (!withdrawalOTP || withdrawalOTP.length !== 6) {
      toast.error(t('settings.toasts.otpInvalid'));
      return;
    }

    try {
      setVerifyingOTP(true);

      const { data, error } = await supabase.functions.invoke('verify-withdrawal-address-otp', {
        body: {
          otpCode: withdrawalOTP,
          usdcAddress: usdcSolanaAddress.trim() || undefined,
          usdtAddress: usdtBep20Address.trim() || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update successful
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowWithdrawalOTP(false);
      setWithdrawalOTP('');
      setOtpSent(false);
      toast.success(t('settings.toasts.addressesUpdated'));
    } catch (error: any) {
      console.error('Verification failed:', error);
      toast.error(error.message || t('settings.toasts.verificationFailed'));
    } finally {
      setVerifyingOTP(false);
    }
  };

  // Calculate live conversion preview
  const previewAmount = 100; // USD
  const convertedPreview = convertAmount(previewAmount);

  // Early return ONLY for auth loading (before we have user)
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("dashboard.authenticating")} />
      </div>
    );
  }

  return (
    <PageLayout
      profile={profile}
      isAdmin={isAdmin}
      onSignOut={signOut}
      isLoading={isLoading || !profile}
      loadingText={t("common.loading")}
    >
      <div className="max-w-4xl mx-auto space-y-8 p-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("settings.title")}</h1>
              <p className="text-muted-foreground mt-2">{t("settings.subtitle")}</p>
            </div>

            {/* Account Information */}
            {/* OTP Verification Dialog */}
            <Dialog open={showWithdrawalOTP} onOpenChange={setShowWithdrawalOTP}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("settings.otpVerification.title")}</DialogTitle>
                  <DialogDescription>
                    {t("settings.otpVerification.description")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">{t("settings.otpVerification.code")}</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder={t("settings.otpVerification.codePlaceholder")}
                      value={withdrawalOTP}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setWithdrawalOTP(value);
                      }}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      {t("settings.otpVerification.expiresIn")}
                    </p>
                  </div>
                  <Button
                    onClick={handleVerifyAndSaveAddresses}
                    disabled={verifyingOTP || withdrawalOTP.length !== 6}
                    className="w-full"
                  >
                    {verifyingOTP ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("common.verifying")}
                      </>
                    ) : (
                      t("settings.otpVerification.verifyAndSave")
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowWithdrawalOTP(false);
                      setWithdrawalOTP('');
                    }}
                    disabled={verifyingOTP}
                    className="w-full"
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.accountInfo.title")}</CardTitle>
                <CardDescription>{t("settings.accountInfo.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">{t("settings.accountInfo.username")}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">{profile?.username}</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">{t("settings.accountInfo.email")}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{profile?.email || user?.email}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">{t("settings.accountInfo.memberSince")}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">{t("settings.accountInfo.membershipPlan")}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="default" className="capitalize">
                        {profile?.membership_plan}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PHASE 6B: Email Verification Status */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.emailVerification.title")}</CardTitle>
                <CardDescription>{t("settings.emailVerification.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                {profile?.email_verified ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">{t("settings.emailVerification.verified")}</span>
                    {profile?.email_verified_at && (
                      <span className="text-sm text-muted-foreground ml-2">
                        ({t("settings.emailVerification.verifiedOn")} {new Date(profile.email_verified_at).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {t("settings.emailVerification.notVerified")}
                      </AlertDescription>
                    </Alert>
                    <Button 
                      onClick={() => setShowEmailVerification(true)}
                      className="w-full sm:w-auto"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {t("settings.emailVerification.verifyNow")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.accountStats.title")}</CardTitle>
                <CardDescription>{t("settings.accountStats.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Target className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalTasks || 0}</p>
                      <p className="text-sm text-muted-foreground">{t("settings.accountStats.tasksCompleted")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalReferrals || 0}</p>
                      <p className="text-sm text-muted-foreground">{t("settings.accountStats.totalReferrals")}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Calendar className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">
                        {profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                      </p>
                      <p className="text-sm text-muted-foreground">{t("settings.accountStats.daysActive")}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Security & Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("settings.security.title")}
                </CardTitle>
                <CardDescription>
                  {t("settings.security.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Registration Location */}
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{t("settings.security.registrationLocation")}</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profile?.registration_country_name ? (
                          <>{t("settings.security.country")}: {profile.registration_country_name} ({profile.registration_country})</>
                        ) : (
                          t("settings.security.noLoginData")
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("settings.security.registeredOn")} {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown"}
                      </p>
                    </div>
                  </div>

                  {/* Last Login Location */}
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <Globe className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{t("settings.security.lastLoginLocation")}</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profile?.last_login_country_name ? (
                          <>{t("settings.security.country")}: {profile.last_login_country_name} ({profile.last_login_country})</>
                        ) : (
                          t("settings.security.noLoginData")
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {profile?.last_login ? (
                          <>{t("settings.security.lastLogin")}: {new Date(profile.last_login).toLocaleString()}</>
                        ) : (
                          t("settings.security.neverLoggedIn")
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Security Note */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>{t("settings.security.locationTracking")}</AlertTitle>
                    <AlertDescription>
                      {t("settings.security.locationTrackingDescription")}
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            {/* Edit Profile */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.editProfile.title")}</CardTitle>
                <CardDescription>{t("settings.editProfile.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("settings.editProfile.fullName")}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t("settings.editProfile.fullNamePlaceholder")} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("settings.editProfile.phone")}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t("settings.editProfile.phonePlaceholder")} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t("settings.editProfile.country")}</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? getCountryName(field.value) || field.value
                                    : t("settings.editProfile.countryPlaceholder")}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder={t("common.search") + "..."} />
                                <CommandList>
                                  <CommandEmpty>{t("common.error")}</CommandEmpty>
                                  <CommandGroup>
                                    {countries.map((country) => (
                                      <CommandItem
                                        value={country.name}
                                        key={country.code}
                                        onSelect={() => {
                                          profileForm.setValue("country", country.code);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            country.code === field.value
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        {country.name} ({country.code})
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {(profile?.registration_country || profile?.last_login_country) && (
                            <p className="text-xs text-muted-foreground">
                              {t("settings.editProfile.detected")}: {getCountryName(profile?.registration_country || profile?.last_login_country || "")} (
                              {profile?.registration_country || profile?.last_login_country}) {t("settings.editProfile.fromRegistration")}
                              {profile?.registration_country ? "" : " " + t("settings.editProfile.fromLastLogin")}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending ? t("common.saving") : t("settings.editProfile.saveChanges")}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Currency Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Currency Preferences
                </CardTitle>
                <CardDescription>
                  Choose your preferred display currency
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Currency Display */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div>
                    <Label className="text-sm font-medium">Current Currency</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-base">
                        {getCurrencySymbol(userCurrency)} {userCurrency}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {getCurrencyName(userCurrency)}
                      </span>
                    </div>
                  </div>
                  {!isCurrencyLoading && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Live Preview</p>
                      <p className="text-sm font-medium">
                        $100 USD = <CurrencyDisplay amountUSD={previewAmount} showTooltip={false} />
                      </p>
                    </div>
                  )}
                </div>

                {/* Currency Selector */}
                <div className="space-y-2">
                  <Label>Select Currency</Label>
                  <Popover open={isCurrencyPopoverOpen} onOpenChange={setIsCurrencyPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCurrencyPopoverOpen}
                        className="w-full justify-between"
                      >
                        {selectedCurrency ? (
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{getCurrencySymbol(selectedCurrency)}</span>
                            {selectedCurrency} - {getCurrencyName(selectedCurrency)}
                          </span>
                        ) : (
                          "Select currency..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search currency..." />
                        <CommandList>
                          <CommandEmpty>No currency found.</CommandEmpty>
                          <CommandGroup heading="All Currencies">
                            {CURRENCIES.map((currency) => (
                              <CommandItem
                                key={currency.code}
                                value={`${currency.code} ${currency.name}`}
                                onSelect={() => {
                                  setSelectedCurrency(currency.code);
                                  setIsCurrencyPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCurrency === currency.code
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="font-medium mr-2">{currency.symbol}</span>
                                <span className="font-mono mr-2">{currency.code}</span>
                                <span className="text-muted-foreground">{currency.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Select from {CURRENCIES.length} supported currencies
                  </p>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleCurrencyUpdate}
                  disabled={
                    updateCurrencyMutation.isPending ||
                    !selectedCurrency ||
                    selectedCurrency === userCurrency
                  }
                  className="w-full"
                >
                  {updateCurrencyMutation.isPending ? t("common.updating") : t("currency.update")}
                </Button>

                {/* Information Alert */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{t("currency.displayOnly")}</AlertTitle>
                  <AlertDescription>
                    {t("currency.displayOnlyDescription")}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Language Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  {t("settings.language.title")}
                </CardTitle>
                <CardDescription>
                  {t("settings.language.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Language Display */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div>
                    <Label className="text-sm font-medium">{t("settings.language.current")}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-base">
                        {getLanguageFlag(userLanguage)} {getLanguageName(userLanguage)}
                      </Badge>
                      {isAutoDetected && (
                        <span className="text-xs text-muted-foreground">
                          ({t("language.autoDetected")})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Language Selector */}
                <div className="space-y-2">
                  <Label>{t("settings.language.select")}</Label>
                  <Popover open={isLanguagePopoverOpen} onOpenChange={setIsLanguagePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isLanguagePopoverOpen}
                        className="w-full justify-between"
                      >
                        {selectedLanguage ? (
                          <span className="flex items-center gap-2">
                            <span>{getLanguageFlag(selectedLanguage)}</span>
                            {getLanguageName(selectedLanguage)} ({selectedLanguage.toUpperCase()})
                          </span>
                        ) : (
                          t("language.selectPlaceholder")
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t("language.searchPlaceholder")} />
                        <CommandList>
                          <CommandEmpty>{t("language.notFound")}</CommandEmpty>
                          <CommandGroup>
                            {SUPPORTED_LANGUAGES.map((lang) => (
                              <CommandItem
                                key={lang}
                                value={`${lang} ${getLanguageName(lang)}`}
                                onSelect={() => {
                                  setSelectedLanguage(lang);
                                  setIsLanguagePopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedLanguage === lang
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="mr-2">{getLanguageFlag(lang)}</span>
                                <span className="font-medium mr-2">{getLanguageName(lang)}</span>
                                <span className="text-muted-foreground font-mono">{lang.toUpperCase()}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Update Button */}
                <Button
                  onClick={handleLanguageUpdate}
                  disabled={
                    updateLanguageMutation.isPending ||
                    !selectedLanguage ||
                    selectedLanguage === userLanguage ||
                    isLanguageLoading
                  }
                  className="w-full"
                >
                  {updateLanguageMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("common.updating")}
                    </>
                  ) : (
                    t("settings.language.update")
                  )}
                </Button>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{t("settings.language.autoDetection")}</AlertTitle>
                  <AlertDescription>
                    {t("settings.language.autoDetectionDescription")}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Onboarding Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Onboarding Preferences
                </CardTitle>
                <CardDescription>
                  View and update your earning goals and task preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Weekly Earning Goal</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {profile?.weekly_goal || "Not set"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandList>
                            <CommandGroup>
                              {["Small extra income", "Side income goal", "Serious monthly target", "Not sure yet"].map((goal) => (
                                <CommandItem
                                  key={goal}
                                  onSelect={async () => {
                                    const { error } = await supabase.from("profiles").update({ weekly_goal: goal }).eq("id", user?.id);
                                    if (!error) {
                                      queryClient.invalidateQueries({ queryKey: ["profile"] });
                                      toast.success("Weekly goal updated");
                                    }
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", profile?.weekly_goal === goal ? "opacity-100" : "opacity-0")} />
                                  {goal}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Weekly Time Commitment</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {profile?.weekly_time_commitment || "Not set"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandList>
                            <CommandGroup>
                              {["1–3 hours/week", "4–7 hours/week", "8–14 hours/week", "15+ hours/week"].map((time) => (
                                <CommandItem
                                  key={time}
                                  onSelect={async () => {
                                    const { error } = await supabase.from("profiles").update({ weekly_time_commitment: time }).eq("id", user?.id);
                                    if (!error) {
                                      queryClient.invalidateQueries({ queryKey: ["profile"] });
                                      toast.success("Time commitment updated");
                                    }
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", profile?.weekly_time_commitment === time ? "opacity-100" : "opacity-0")} />
                                  {time}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Weekly Routine</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {profile?.weekly_routine || "Not set"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandList>
                            <CommandGroup>
                              {["Mornings", "Afternoons", "Evenings", "Weekends", "Flexible"].map((routine) => (
                                <CommandItem
                                  key={routine}
                                  onSelect={async () => {
                                    const { error } = await supabase.from("profiles").update({ weekly_routine: routine }).eq("id", user?.id);
                                    if (!error) {
                                      queryClient.invalidateQueries({ queryKey: ["profile"] });
                                      toast.success("Weekly routine updated");
                                    }
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", profile?.weekly_routine === routine ? "opacity-100" : "opacity-0")} />
                                  {routine}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Preferred Review Categories</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      "Hospitality — Hotel Review Sentiment",
                      "E-Commerce — Product Review Analysis",
                      "Food & Dining — Restaurant Feedback Sentiment",
                      "Social Platforms — Social Media Comment Analysis",
                      "Mobile Apps — App Store Review Sentiment",
                      "Professional Services — Service Provider Reviews",
                      "I’m open to any category"
                    ].map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cat-${category}`}
                          checked={profile?.preferred_review_categories?.includes(category)}
                          onCheckedChange={async (checked) => {
                            let newCategories = [...(profile?.preferred_review_categories || [])];
                            if (checked) {
                              if (category === "I’m open to any category") {
                                newCategories = [category];
                              } else {
                                newCategories = newCategories.filter(c => c !== "I’m open to any category");
                                newCategories.push(category);
                              }
                            } else {
                              newCategories = newCategories.filter(c => c !== category);
                            }
                            
                            const { error } = await supabase.from("profiles").update({ preferred_review_categories: newCategories }).eq("id", user?.id);
                            if (!error) {
                              queryClient.invalidateQueries({ queryKey: ["profile"] });
                            }
                          }}
                        />
                        <label 
                          htmlFor={`cat-${category}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {category}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cryptocurrency Addresses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  {t("settings.withdrawalAddresses.title")}
                </CardTitle>
                <CardDescription>
                  {t("settings.withdrawalAddresses.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* USDC Solana Address */}
                <div className="space-y-2">
                  <Label htmlFor="usdc-solana">
                    {getCryptoById('usdc-solana')?.displayName || 'USDC (Solana)'}
                  </Label>
                  <Input
                    id="usdc-solana"
                    value={usdcSolanaAddress}
                    onChange={(e) => {
                      setUsdcSolanaAddress(e.target.value);
                      if (cryptoAddressErrors.usdc) {
                        setCryptoAddressErrors(prev => ({ ...prev, usdc: undefined }));
                      }
                    }}
                    placeholder={getCryptoById('usdc-solana')?.addressPlaceholder || 'Enter your USDC Solana address'}
                    className={cn(cryptoAddressErrors.usdc && "border-destructive")}
                  />
                  {cryptoAddressErrors.usdc ? (
                    <p className="text-sm text-destructive">{cryptoAddressErrors.usdc}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {getCryptoById('usdc-solana')?.description} • Example: {getCryptoById('usdc-solana')?.addressExample}
                    </p>
                  )}
                </div>

                {/* USDT BEP-20 Address */}
                <div className="space-y-2">
                  <Label htmlFor="usdt-bep20">
                    {getCryptoById('usdt-bep20')?.displayName || 'USDT (BEP-20)'}
                  </Label>
                  <Input
                    id="usdt-bep20"
                    value={usdtBep20Address}
                    onChange={(e) => {
                      setUsdtBep20Address(e.target.value);
                      if (cryptoAddressErrors.usdt) {
                        setCryptoAddressErrors(prev => ({ ...prev, usdt: undefined }));
                      }
                    }}
                    placeholder={getCryptoById('usdt-bep20')?.addressPlaceholder || 'Enter your USDT BEP-20 address'}
                    className={cn(cryptoAddressErrors.usdt && "border-destructive")}
                  />
                  {cryptoAddressErrors.usdt ? (
                    <p className="text-sm text-destructive">{cryptoAddressErrors.usdt}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {getCryptoById('usdt-bep20')?.description} • Example: {getCryptoById('usdt-bep20')?.addressExample}
                    </p>
                  )}
                </div>

                {/* Security Notice */}
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>{t("settings.withdrawalAddresses.securityNotice")}</AlertTitle>
                  <AlertDescription>
                    {t("settings.withdrawalAddresses.securityNoticeDescription")}
                  </AlertDescription>
                </Alert>

                {/* Save Button */}
                <Button
                  onClick={handleSendWithdrawalOTP}
                  disabled={
                    sendingOTP ||
                    (!usdcSolanaAddress.trim() && !usdtBep20Address.trim()) ||
                    (usdcSolanaAddress === profile?.usdc_solana_address && usdtBep20Address === profile?.usdt_bep20_address)
                  }
                  className="w-full"
                >
                  {updateCryptoAddressesMutation.isPending ? t("common.saving") : t("settings.withdrawalAddresses.save")}
                </Button>

                {/* Information Alert */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{t("settings.withdrawalAddresses.infoTitle")}</AlertTitle>
                  <AlertDescription>
                    {t("settings.withdrawalAddresses.infoDescription")}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.changePassword.title")}</CardTitle>
                <CardDescription>{t("settings.changePassword.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                {!isPasswordFormOpen ? (
                  <Button onClick={() => setIsPasswordFormOpen(true)} variant="outline">
                    {t("settings.changePassword.title")}
                  </Button>
                ) : (
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("settings.changePassword.newPassword")}</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder={t("settings.changePassword.newPasswordPlaceholder")} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("settings.changePassword.confirmPassword")}</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder={t("settings.changePassword.confirmPasswordPlaceholder")} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2">
                        <Button type="submit" disabled={changePasswordMutation.isPending}>
                          {changePasswordMutation.isPending ? t("common.saving") : t("settings.changePassword.title")}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => {
                          setIsPasswordFormOpen(false);
                          passwordForm.reset();
                        }}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </form>
                  </Form>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </div>
              <CardDescription>
                Irreversible actions that will permanently affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Deleting your account will permanently remove all your data, including earnings, 
                  transaction history, referrals, and task records. This action cannot be undone.
                </AlertDescription>
              </Alert>
              
              <Button 
                variant="destructive" 
                onClick={() => setDeleteDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                Delete My Account
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Email Verification Dialog */}
        <EmailVerificationDialog 
          open={showEmailVerification}
          onOpenChange={setShowEmailVerification}
          userEmail={profile?.email || user?.email || ''}
          onVerificationSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            setShowEmailVerification(false);
            toast.success(t("toasts.settings.emailVerified"));
          }}
        />

        {/* Delete Account Dialog */}
        <DeleteAccountDialog 
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        />
    </PageLayout>
  );
};

export default Settings;
