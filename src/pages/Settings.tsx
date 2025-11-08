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
import { Calendar, User, Mail, Award, Target, Users, Shield, MapPin, Globe, Info, Check, ChevronsUpDown, DollarSign, CheckCircle, AlertCircle, Wallet, Loader2 } from "lucide-react";
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

const Settings = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [isCurrencyPopoverOpen, setIsCurrencyPopoverOpen] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { userCurrency, updateUserCurrency, convertAmount, isLoading: isCurrencyLoading } = useCurrencyConversion();
  
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
      toast.success("Profile updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
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
      toast.success("Password changed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to change password: ${error.message}`);
    },
  });

  // Update currency mutation
  const updateCurrencyMutation = useMutation({
    mutationFn: async (currencyCode: string) => {
      await updateUserCurrency(currencyCode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Currency preference updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update currency: ${error.message}`);
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
      toast.success("Cryptocurrency addresses updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update addresses: ${error.message}`);
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
      toast.error("Please fix the address validation errors");
      return;
    }

    if (!usdcSolanaAddress.trim() && !usdtBep20Address.trim()) {
      toast.error("Please enter at least one cryptocurrency address");
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
      toast.success('Verification code sent to your email');
    } catch (error: any) {
      console.error('Failed to send OTP:', error);
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setSendingOTP(false);
    }
  };

  const handleVerifyAndSaveAddresses = async () => {
    if (!withdrawalOTP || withdrawalOTP.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code');
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
      toast.success('Withdrawal addresses updated successfully');
    } catch (error: any) {
      console.error('Verification failed:', error);
      toast.error(error.message || 'Verification failed. Please try again.');
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
        <LoadingSpinner size="lg" text="Authenticating..." />
      </div>
    );
  }

  return (
    <PageLayout
      profile={profile}
      isAdmin={isAdmin}
      onSignOut={signOut}
      isLoading={isLoading || !profile}
      loadingText="Loading settings..."
    >
      <div className="max-w-4xl mx-auto space-y-8 p-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-2">Manage your account settings and preferences</p>
            </div>

            {/* Account Information */}
            {/* OTP Verification Dialog */}
            <Dialog open={showWithdrawalOTP} onOpenChange={setShowWithdrawalOTP}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Verify Your Email</DialogTitle>
                  <DialogDescription>
                    Enter the 6-digit verification code sent to your email to confirm the address changes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={withdrawalOTP}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setWithdrawalOTP(value);
                      }}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Code expires in 10 minutes
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
                        Verifying...
                      </>
                    ) : (
                      'Verify & Save'
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
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Username</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">{profile?.username}</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{profile?.email || user?.email}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Member Since</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Membership Plan</Label>
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
                <CardTitle>Email Verification</CardTitle>
                <CardDescription>Verify your email to unlock all features</CardDescription>
              </CardHeader>
              <CardContent>
                {profile?.email_verified ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Your email is verified</span>
                    {profile?.email_verified_at && (
                      <span className="text-sm text-muted-foreground ml-2">
                        (Verified on {new Date(profile.email_verified_at).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Your email is not verified. Some features may be limited until you verify your email address.
                      </AlertDescription>
                    </Alert>
                    <Button 
                      onClick={() => setShowEmailVerification(true)}
                      className="w-full sm:w-auto"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Verify Email Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Account Statistics</CardTitle>
                <CardDescription>Your activity overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Target className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalTasks || 0}</p>
                      <p className="text-sm text-muted-foreground">Tasks Completed</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalReferrals || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Referrals</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Calendar className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">
                        {profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Days Active</p>
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
                  Account Security & Location
                </CardTitle>
                <CardDescription>
                  Your account location information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Registration Location */}
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Registration Location</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profile?.registration_country_name ? (
                          <>Country: {profile.registration_country_name} ({profile.registration_country})</>
                        ) : (
                          "Location data not available"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Registered on {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown"}
                      </p>
                    </div>
                  </div>

                  {/* Last Login Location */}
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <Globe className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Last Login Location</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profile?.last_login_country_name ? (
                          <>Country: {profile.last_login_country_name} ({profile.last_login_country})</>
                        ) : (
                          "No login data available yet"
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {profile?.last_login ? (
                          <>Last login: {new Date(profile.last_login).toLocaleString()}</>
                        ) : (
                          "Never logged in"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Security Note */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Location Tracking</AlertTitle>
                    <AlertDescription>
                      We track your registration and login locations for security purposes. This helps us protect your account from unauthorized access.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            {/* Edit Profile */}
            <Card>
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter your full name" />
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
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter your phone number (optional)" />
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
                          <FormLabel>Country</FormLabel>
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
                                    : "Select country"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search country..." />
                                <CommandList>
                                  <CommandEmpty>No country found.</CommandEmpty>
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
                              Detected: {getCountryName(profile?.registration_country || profile?.last_login_country || "")} (
                              {profile?.registration_country || profile?.last_login_country}) from your{" "}
                              {profile?.registration_country ? "registration" : "last login"}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
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
                  {updateCurrencyMutation.isPending ? "Updating..." : "Update Currency"}
                </Button>

                {/* Information Alert */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Display Only</AlertTitle>
                  <AlertDescription>
                    Currency conversion affects display only. All transactions are processed in USD. 
                    Exchange rates are updated every 24 hours.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Cryptocurrency Addresses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Withdrawal Addresses
                </CardTitle>
                <CardDescription>
                  Manage your cryptocurrency withdrawal addresses
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
                  <AlertTitle>Secure Your Addresses</AlertTitle>
                  <AlertDescription>
                    For security, we'll send a verification code to your email when you update these addresses.
                    Make sure your withdrawal addresses are correct to avoid loss of funds.
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
                  {updateCryptoAddressesMutation.isPending ? "Saving..." : "Save Withdrawal Addresses"}
                </Button>

                {/* Information Alert */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Withdrawal Addresses</AlertTitle>
                  <AlertDescription>
                    These addresses will be used for cryptocurrency withdrawals. Please double-check your addresses before saving.
                    Sending funds to an incorrect address may result in permanent loss.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent>
                {!isPasswordFormOpen ? (
                  <Button onClick={() => setIsPasswordFormOpen(true)} variant="outline">
                    Change Password
                  </Button>
                ) : (
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Enter new password" />
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
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Confirm new password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2">
                        <Button type="submit" disabled={changePasswordMutation.isPending}>
                          {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => {
                          setIsPasswordFormOpen(false);
                          passwordForm.reset();
                        }}>
                          Cancel
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
            toast.success("Email verified successfully!");
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
