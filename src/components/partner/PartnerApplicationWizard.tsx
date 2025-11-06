import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Save, 
  CheckCircle, 
  Info,
  Sparkles,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  MapPin,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePartnerApplicationDraft } from "@/hooks/usePartnerApplicationDraft";
import {
  section1Schema,
  section2Schema,
  section3Schema,
  section4Schema,
  completeApplicationSchema,
  CompleteApplicationData,
} from "@/lib/partner-application-validation";
import { countries, getCountryName } from "@/lib/countries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

interface PartnerApplicationWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const PartnerApplicationWizard = ({ onComplete, onCancel }: PartnerApplicationWizardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSections, setCompletedSections] = useState<boolean[]>([false, false, false, false]);
  
  // Phase 4: Free plan blocking dialog state
  const [showFreePlanDialog, setShowFreePlanDialog] = useState(false);
  
  // Phase 1: Country search state
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  
  // Phase 4: Fetch profile and referral stats
  const { data: profile, isLoading: isLoadingProfile } = useProfile(user?.id);
  const [referralStats, setReferralStats] = useState({ total: 0, upgraded: 0 });
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true);

  const {
    hasExistingDraft,
    draftAge,
    saveDraft,
    clearDraft,
    getDraftData,
    getDraftSection,
  } = usePartnerApplicationDraft(user?.id || "");

  // Phase 4: Fetch referral statistics
  useEffect(() => {
    const fetchReferralStats = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoadingReferrals(true);
        
        // Get total referrals
        const { count: totalCount } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', user.id)
          .eq('status', 'active');
        
        // Get upgraded referrals (referrals whose membership_plan is not 'free')
        const { data: upgradedReferrals } = await supabase
          .from('referrals')
          .select('referred_id')
          .eq('referrer_id', user.id)
          .eq('status', 'active');
        
        if (upgradedReferrals) {
          const referredIds = upgradedReferrals.map(r => r.referred_id);
          
          if (referredIds.length > 0) {
            const { count: upgradedCount } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .in('id', referredIds)
              .neq('membership_plan', 'free');
            
            setReferralStats({
              total: totalCount || 0,
              upgraded: upgradedCount || 0
            });
          } else {
            setReferralStats({ total: totalCount || 0, upgraded: 0 });
          }
        } else {
          setReferralStats({ total: totalCount || 0, upgraded: 0 });
        }
      } catch (error) {
        console.error('[ReferralStats] Error fetching:', error);
        setReferralStats({ total: 0, upgraded: 0 });
      } finally {
        setIsLoadingReferrals(false);
      }
    };
    
    fetchReferralStats();
  }, [user?.id]);

  const form = useForm<CompleteApplicationData>({
    resolver: zodResolver(completeApplicationSchema),
    mode: "onChange",
    defaultValues: {
      preferred_contact_method: undefined,
      whatsapp_number: "",
      telegram_username: "",
      whatsapp_group_link: "",
      telegram_group_link: "",
      // Phase 4: New Section 1 fields
      applicant_country: profile?.registration_country || profile?.country || "",
      current_membership_plan: profile?.membership_plan || "",
      total_referrals: 0,
      upgraded_referrals: 0,
      // Section 2
      manages_community: undefined,
      community_group_links: "",
      community_member_count: "",
      promoted_platforms: undefined,
      platform_promotion_details: "",
      network_description: "",
      expected_monthly_onboarding: undefined,
      // Section 3
      local_payment_methods: "",
      can_provide_local_support: undefined,
      support_preference: undefined,
      organize_training_sessions: undefined,
      // Phase 4: Section 4 updated fields
      weekly_time_commitment: "", // Keep for backward compatibility
      daily_time_commitment: "",
      is_currently_employed: undefined,
      motivation_text: "",
      agrees_to_guidelines: false,
    },
  });

  // Phase 4: Auto-populate profile and referral data when loaded
  useEffect(() => {
    if (profile) {
      form.setValue('current_membership_plan', profile.membership_plan);
      form.setValue('applicant_country', profile.registration_country || profile.country || '');
    }
  }, [profile, form]);

  useEffect(() => {
    if (!isLoadingReferrals) {
      form.setValue('total_referrals', referralStats.total);
      form.setValue('upgraded_referrals', referralStats.upgraded);
    }
  }, [referralStats, isLoadingReferrals, form]);

  // Load draft data on mount
  useEffect(() => {
    if (hasExistingDraft) {
      const draftData = getDraftData();
      const draftSection = getDraftSection();
      
      Object.keys(draftData).forEach((key) => {
        form.setValue(key as any, draftData[key as keyof typeof draftData] as any);
      });
      
      setCurrentSection(draftSection);
      toast.info("Draft restored", {
        description: "Your previous application progress has been restored.",
      });
    }
  }, [hasExistingDraft]);

  // Auto-save draft (debounced)
  const formValues = form.watch();
  const debouncedFormValues = useDebounce(formValues, 500);

  useEffect(() => {
    if (user?.id && Object.keys(debouncedFormValues).length > 0) {
      saveDraft(currentSection, debouncedFormValues as Partial<CompleteApplicationData>);
    }
  }, [debouncedFormValues, currentSection, user?.id, saveDraft]);

  const sections = [
    { title: "Basic Information", description: "Your contact details" },
    { title: "Network & Experience", description: "Tell us about your reach" },
    { title: "Local Payments & Support", description: "How you'll help users" },
    { title: "Agreement", description: "Final details" },
  ];

  const progress = ((currentSection + 1) / sections.length) * 100;

  const validateSection = async (section: number): Promise<boolean> => {
    let schema;
    let fields: string[] = [];

    switch (section) {
      case 0:
        schema = section1Schema;
        fields = ["preferred_contact_method", "whatsapp_number", "telegram_username", 
                  "whatsapp_group_link", "telegram_group_link", "applicant_country",
                  "current_membership_plan"];
        break;
      case 1:
        schema = section2Schema;
        fields = ["manages_community", "community_group_links", "community_member_count",
                  "promoted_platforms", "platform_promotion_details", "network_description",
                  "expected_monthly_onboarding"];
        break;
      case 2:
        schema = section3Schema;
        fields = ["local_payment_methods", "can_provide_local_support", 
                  "support_preference", "organize_training_sessions"];
        break;
      case 3:
        schema = section4Schema;
        fields = ["daily_time_commitment", "is_currently_employed", "motivation_text", "agrees_to_guidelines"];
        break;
      default:
        return false;
    }

    const result = await form.trigger(fields as any);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateSection(currentSection);
    
    if (isValid) {
      const newCompleted = [...completedSections];
      newCompleted[currentSection] = true;
      setCompletedSections(newCompleted);
      setCurrentSection((prev) => Math.min(prev + 1, sections.length - 1));
    } else {
      toast.error("Please complete all required fields");
    }
  };

  const handleBack = () => {
    setCurrentSection((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (data: CompleteApplicationData) => {
    // Phase 4: Check if user is on free plan and block submission
    if (data.current_membership_plan === 'free') {
      setShowFreePlanDialog(true);
      return;
    }
    
    setIsSubmitting(true);

    try {
      const response = await supabase.functions.invoke("partner-application", {
        body: {
          preferred_contact_method: data.preferred_contact_method,
          whatsapp_number: data.whatsapp_number,
          telegram_username: data.telegram_username,
          whatsapp_group_link: data.whatsapp_group_link,
          telegram_group_link: data.telegram_group_link,
          // Phase 4: New Section 1 fields
          applicant_country: data.applicant_country,
          current_membership_plan: data.current_membership_plan,
          total_referrals: data.total_referrals,
          upgraded_referrals: data.upgraded_referrals,
          // Section 2
          manages_community: data.manages_community,
          community_group_links: data.community_group_links,
          community_member_count: data.community_member_count,
          promoted_platforms: data.promoted_platforms,
          platform_promotion_details: data.platform_promotion_details,
          network_description: data.network_description,
          expected_monthly_onboarding: data.expected_monthly_onboarding,
          // Section 3
          local_payment_methods: data.local_payment_methods,
          can_provide_local_support: data.can_provide_local_support,
          support_preference: data.support_preference,
          organize_training_sessions: data.organize_training_sessions,
          // Phase 4: Section 4 updated fields
          weekly_time_commitment: data.weekly_time_commitment || data.daily_time_commitment,
          daily_time_commitment: data.daily_time_commitment,
          is_currently_employed: data.is_currently_employed,
          motivation_text: data.motivation_text,
          agrees_to_guidelines: data.agrees_to_guidelines,
        },
      });

      if (response.error) throw response.error;

      clearDraft();
      toast.success("Application submitted successfully!", {
        description: "We'll review your application and get back to you soon.",
      });
      onComplete();
    } catch (error: any) {
      console.error("Error submitting application:", error);
      toast.error("Failed to submit application", {
        description: error.message || "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 md:py-12">
      {/* Progress Bar */}
      <div className="mb-6 md:mb-8">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl md:text-2xl font-bold">Partner Application</h2>
          <Badge variant="secondary" className="text-xs md:text-sm">
            Step {currentSection + 1} of {sections.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2 md:h-3" />
        <p className="text-sm text-muted-foreground mt-2">
          {sections[currentSection].title}
        </p>
      </div>

      {hasExistingDraft && draftAge && currentSection === 0 && (
        <Alert className="mb-6">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            You have a saved draft from {draftAge.daysAgo > 0 
              ? `${draftAge.daysAgo} day${draftAge.daysAgo > 1 ? 's' : ''} ago`
              : draftAge.hoursAgo > 0 
              ? `${draftAge.hoursAgo} hour${draftAge.hoursAgo > 1 ? 's' : ''} ago`
              : `${draftAge.minutesAgo} minute${draftAge.minutesAgo > 1 ? 's' : ''} ago`
            }. {draftAge.expiresInHours > 0 
              ? `It will expire in ${draftAge.expiresInHours} hour${draftAge.expiresInHours > 1 ? 's' : ''}.`
              : 'It will expire soon.'
            }
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">{sections[currentSection].title}</CardTitle>
          <CardDescription className="text-sm md:text-base">
            {sections[currentSection].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 md:space-y-6">
              {/* Section 1: Basic Information */}
              {currentSection === 0 && (
                <div className="space-y-4 md:space-y-5">
                  {/* Phase 1: Searchable Country Selector with Flags */}
                  <FormField
                    control={form.control}
                    name="applicant_country"
                    render={({ field }) => {
                      const selectedCountry = countries.find(c => c.code === field.value);
                      const filteredCountries = countries.filter(country =>
                        country.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
                        country.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
                      );
                      
                      return (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-sm md:text-base flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Your Country *
                          </FormLabel>
                          <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  disabled={isLoadingProfile}
                                  className={`h-12 md:h-11 w-full justify-between ${!field.value && "text-muted-foreground"}`}
                                >
                                  {isLoadingProfile ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Loading...
                                    </span>
                                  ) : selectedCountry ? (
                                    <span className="flex items-center gap-2">
                                      <span className="text-lg">
                                        {String.fromCodePoint(...[...selectedCountry.code].map(c => 127397 + c.charCodeAt(0)))}
                                      </span>
                                      <span>{selectedCountry.name}</span>
                                    </span>
                                  ) : (
                                    "Select your country"
                                  )}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0 z-50" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search country..." 
                                  value={countrySearchQuery}
                                  onValueChange={setCountrySearchQuery}
                                  className="h-9"
                                />
                                <CommandList>
                                  <CommandEmpty>No country found.</CommandEmpty>
                                  <CommandGroup className="max-h-[300px] overflow-auto">
                                    {filteredCountries.map((country) => (
                                      <CommandItem
                                        key={country.code}
                                        value={country.code}
                                        onSelect={(value) => {
                                          field.onChange(value);
                                          setCountrySearchOpen(false);
                                          setCountrySearchQuery("");
                                        }}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <span className="text-lg">
                                          {String.fromCodePoint(...[...country.code].map(c => 127397 + c.charCodeAt(0)))}
                                        </span>
                                        <span>{country.name}</span>
                                        <Check
                                          className={`ml-auto h-4 w-4 ${
                                            field.value === country.code ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormDescription className="text-xs md:text-sm">
                            {field.value && getCountryName(field.value) ? (
                              <span className="flex items-center gap-1">
                                <span className="text-lg">
                                  {String.fromCodePoint(...[...field.value].map(c => 127397 + c.charCodeAt(0)))}
                                </span>
                                {getCountryName(field.value)}
                              </span>
                            ) : (
                              "Where are you located?"
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Phase 4: Membership Plan Display (Read-only) */}
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Current Membership Plan
                      </label>
                      {isLoadingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Badge variant={profile?.membership_plan === 'free' ? 'destructive' : 'default'}>
                          {profile?.membership_plan?.toUpperCase() || 'FREE'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your current plan: <span className="font-semibold">{profile?.membership_plan || 'Free'}</span>
                    </p>
                    {profile?.membership_plan === 'free' && (
                      <Alert className="mt-2" variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Free plan users cannot become partners. Please upgrade your account to apply.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Phase 4: Referral Statistics Display (Read-only) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Total Referrals</span>
                      </div>
                      {isLoadingReferrals ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <p className="text-2xl font-bold">{referralStats.total}</p>
                      )}
                    </div>
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Upgraded Referrals</span>
                      </div>
                      {isLoadingReferrals ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <p className="text-2xl font-bold text-primary">{referralStats.upgraded}</p>
                      )}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="preferred_contact_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">Preferred Contact Method *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 md:h-11">
                              <SelectValue placeholder="Select contact method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-50 bg-background">
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
                            <SelectItem value="both">Both WhatsApp & Telegram</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">WhatsApp Number *</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            inputMode="tel"
                            placeholder="+1234567890"
                            className="h-12 md:h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs md:text-sm">
                          Include country code (e.g., +1 for USA)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram_username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">Telegram Username *</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="@username"
                            autoCapitalize="none"
                            className="h-12 md:h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp_group_link"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">WhatsApp Group Link *</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            inputMode="url"
                            placeholder="https://chat.whatsapp.com/..."
                            className="h-12 md:h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram_group_link"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">Telegram Group/Channel Link *</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            inputMode="url"
                            placeholder="https://t.me/..."
                            className="h-12 md:h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Section 2: Network & Experience */}
              {currentSection === 1 && (
                <div className="space-y-4 md:space-y-5">
                  <FormField
                    control={form.control}
                    name="manages_community"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm md:text-base">
                          Do you currently manage any online community or group? *
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === "true")}
                            value={field.value === undefined ? undefined : field.value ? "true" : "false"}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="true" id="manages-yes" className="h-5 w-5" />
                              <label htmlFor="manages-yes" className="flex-1 cursor-pointer text-sm md:text-base">
                                Yes, I manage a community
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="false" id="manages-no" className="h-5 w-5" />
                              <label htmlFor="manages-no" className="flex-1 cursor-pointer text-sm md:text-base">
                                No, I don't manage a community
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("manages_community") === true && (
                    <>
                      <FormField
                        control={form.control}
                        name="community_group_links"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm md:text-base">Group Link(s) *</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                inputMode="url"
                                placeholder="https://..."
                                className="h-12 md:h-11"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="community_member_count"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm md:text-base">Community Size (Member Count) *</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="e.g., 500+ members"
                                className="h-12 md:h-11"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="promoted_platforms"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm md:text-base">
                          Have you previously promoted or managed digital or online earning platforms? *
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === "true")}
                            value={field.value === undefined ? undefined : field.value ? "true" : "false"}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="true" id="promoted-yes" className="h-5 w-5" />
                              <label htmlFor="promoted-yes" className="flex-1 cursor-pointer text-sm md:text-base">
                                Yes, I have experience
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="false" id="promoted-no" className="h-5 w-5" />
                              <label htmlFor="promoted-no" className="flex-1 cursor-pointer text-sm md:text-base">
                                No, this is my first time
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("promoted_platforms") === true && (
                    <FormField
                      control={form.control}
                      name="platform_promotion_details"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm md:text-base">Please describe briefly *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us about your experience..."
                              className="min-h-[100px] resize-y"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="network_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">
                          How do you plan on marketing and educating users in your country about our platform? *
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your marketing strategy, channels you'll use (social media, community groups, events), and how you'll educate users about the platform..."
                            className="min-h-[120px] resize-y"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs md:text-sm">
                          {field.value?.length || 0} / 500 characters (minimum 50)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expected_monthly_onboarding"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm md:text-base">
                          How many users do you think you can onboard in your first month? *
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="less_than_50" id="onboard-1" className="h-5 w-5" />
                              <label htmlFor="onboard-1" className="flex-1 cursor-pointer text-sm md:text-base">
                                Less than 50 users
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="50_100" id="onboard-2" className="h-5 w-5" />
                              <label htmlFor="onboard-2" className="flex-1 cursor-pointer text-sm md:text-base">
                                50-100 users
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="100_500" id="onboard-3" className="h-5 w-5" />
                              <label htmlFor="onboard-3" className="flex-1 cursor-pointer text-sm md:text-base">
                                100-500 users
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="500_plus" id="onboard-4" className="h-5 w-5" />
                              <label htmlFor="onboard-4" className="flex-1 cursor-pointer text-sm md:text-base">
                                500+ users
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Section 3: Local Payments & Support */}
              {currentSection === 2 && (
                <div className="space-y-4 md:space-y-5">
                  <FormField
                    control={form.control}
                    name="local_payment_methods"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">
                          Which local payment methods do you use or can accept from users? *
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="List payment methods you can work with..."
                            className="min-h-[100px] resize-y"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="can_provide_local_support"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm md:text-base">
                          Will you be able to provide local support to users in your country? *
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === "true")}
                            value={field.value === undefined ? undefined : field.value ? "true" : "false"}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="true" id="support-yes" className="h-5 w-5" />
                              <label htmlFor="support-yes" className="flex-1 cursor-pointer text-sm md:text-base">
                                Yes, I can provide support
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="false" id="support-no" className="h-5 w-5" />
                              <label htmlFor="support-no" className="flex-1 cursor-pointer text-sm md:text-base">
                                No, I prefer referring users only
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="support_preference"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm md:text-base">Support Preference *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="direct_assistance" id="pref-direct" className="h-5 w-5" />
                              <label htmlFor="pref-direct" className="flex-1 cursor-pointer text-sm md:text-base">
                                Yes, I can assist users directly
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="referral_only" id="pref-referral" className="h-5 w-5" />
                              <label htmlFor="pref-referral" className="flex-1 cursor-pointer text-sm md:text-base">
                                No, I prefer referring users only
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="organize_training_sessions"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm md:text-base">
                          Are you open to organizing small online/offline sessions to train new users? *
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === "true")}
                            value={field.value === undefined ? undefined : field.value ? "true" : "false"}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="true" id="training-yes" className="h-5 w-5" />
                              <label htmlFor="training-yes" className="flex-1 cursor-pointer text-sm md:text-base">
                                Yes, I'm open to it
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="false" id="training-no" className="h-5 w-5" />
                              <label htmlFor="training-no" className="flex-1 cursor-pointer text-sm md:text-base">
                                No, not at this time
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Section 4: Agreement */}
              {currentSection === 3 && (
                <div className="space-y-4 md:space-y-5">
                  {/* Phase 4: Daily Time Commitment */}
                  <FormField
                    control={form.control}
                    name="daily_time_commitment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">
                          How much time can you dedicate daily to managing your local users? *
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="e.g., 2-3 hours per day"
                            className="h-12 md:h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs md:text-sm">
                          Be realistic about the daily time you can commit
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phase 4: Employment Status */}
                  <FormField
                    control={form.control}
                    name="is_currently_employed"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm md:text-base">
                          Are you currently employed or have another job? *
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => field.onChange(value === "true")}
                            value={field.value === undefined ? undefined : field.value ? "true" : "false"}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="true" id="employed-yes" className="h-5 w-5" />
                              <label htmlFor="employed-yes" className="flex-1 cursor-pointer text-sm md:text-base">
                                Yes, I'm currently employed
                              </label>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent">
                              <RadioGroupItem value="false" id="employed-no" className="h-5 w-5" />
                              <label htmlFor="employed-no" className="flex-1 cursor-pointer text-sm md:text-base">
                                No, I'm not currently employed
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="motivation_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">
                          Why do you want to become a Local Partner? *
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us what motivates you to represent our platform in your country..."
                            className="min-h-[150px] resize-y"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs md:text-sm">
                          {field.value?.length || 0} / 1000 characters (minimum 50)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="agrees_to_guidelines"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="h-5 w-5 mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm md:text-base cursor-pointer">
                            I agree to follow the Partner Guidelines *
                          </FormLabel>
                          <FormDescription className="text-xs md:text-sm">
                            You agree to represent the platform professionally and follow all partner guidelines
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription className="text-xs md:text-sm">
                      Once submitted, our team will review your application within 24-48 hours. 
                      You'll receive an email notification about your application status.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 sticky bottom-0 bg-background pb-4">
                {currentSection > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="w-full sm:w-auto order-2 sm:order-1 h-12 md:h-11"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                )}

                {currentSection < sections.length - 1 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="w-full sm:flex-1 order-1 sm:order-2 h-12 md:h-11"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:flex-1 order-1 sm:order-2 h-12 md:h-11"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Application
                        <CheckCircle className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  className="w-full sm:w-auto order-3 h-12 md:h-11"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Draft Auto-save Indicator */}
      <div className="text-center mt-4">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Save className="h-3 w-3" />
          Your progress is automatically saved
        </p>
      </div>

      {/* Phase 4: Free Plan Blocking Dialog */}
      <AlertDialog open={showFreePlanDialog} onOpenChange={setShowFreePlanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Upgrade Required
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Users on the <strong>Free plan</strong> cannot become Partners. 
                To submit your partner application, you need to upgrade your account to a paid membership plan.
              </p>
              <p className="text-sm text-muted-foreground">
                Paid plans unlock partner benefits including higher commission rates, 
                better support, and exclusive features.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/membership-plans')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
