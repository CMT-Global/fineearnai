import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Send, Clock, Eye, Info, AlertTriangle, History, CheckCircle2, XCircle, Loader2, User, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { EmailHistoryTab } from "@/components/admin/EmailHistoryTab";
import { EmailBestPractices } from "@/components/admin/EmailBestPractices";
import { EmailVariableReference } from "@/components/admin/EmailVariableReference";
import { countries, getCountryName } from "@/lib/countries";
import { useDebounce } from "@/hooks/useDebounce";

const BulkEmail = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState({
    subject: "",
    body: "",
    recipientType: "all",
    plan: "",
    country: "",
    usernames: "",
    email: "",
    scheduleType: "immediate",
    scheduledDate: "",
    scheduledTime: "",
  });
  
  const [recipientCount, setRecipientCount] = useState(0);
  const [calculatingCount, setCalculatingCount] = useState(false);
  const [countryStats, setCountryStats] = useState<Array<{ code: string; count: number }>>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  
  // PHASE 3: Helper function to generate duplicate check hash
  const generateDuplicateHash = async (subject: string, body: string, recipientFilter: any): Promise<string> => {
    const hashInput = JSON.stringify({ subject, body, recipientFilter });
    const encoder = new TextEncoder();
    const data = encoder.encode(hashInput);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };


  const [membershipPlans, setMembershipPlans] = useState<Array<{ name: string; display_name: string; account_type: string; count: number }>>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [usernameValidationState, setUsernameValidationState] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid' | 'error';
    user?: { username: string; email: string; membership_plan: string };
    message?: string;
  }>({ status: 'idle' });

  const debouncedUsername = useDebounce(formData.usernames, 500);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadCountryStats();
      loadPlanStats();
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      calculateRecipientCount();
    }
  }, [formData.recipientType, formData.plan, formData.country, formData.usernames, formData.email, isAdmin]);

  // Username validation
  useEffect(() => {
    if (!debouncedUsername.trim() || formData.recipientType !== 'usernames') {
      setUsernameValidationState({ status: 'idle' });
      return;
    }

    const validateUsername = async () => {
      setUsernameValidationState({ status: 'checking' });

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, email, membership_plan, account_status')
          .ilike('username', debouncedUsername.trim())
          .maybeSingle();

        if (error) {
          setUsernameValidationState({ 
            status: 'error', 
            message: 'Failed to validate username. Please try again.' 
          });
          return;
        }

        if (!data) {
          setUsernameValidationState({ 
            status: 'invalid', 
            message: 'Username not found. Please check and try again.' 
          });
          return;
        }

        if (data.account_status !== 'active') {
          setUsernameValidationState({ 
            status: 'invalid', 
            message: `This user account is ${data.account_status}.` 
          });
          return;
        }

        // Valid user found
        setUsernameValidationState({ 
          status: 'valid', 
          user: {
            username: data.username,
            email: data.email,
            membership_plan: data.membership_plan
          }
        });

      } catch (err) {
        setUsernameValidationState({ 
          status: 'error', 
          message: 'An unexpected error occurred.' 
        });
      }
    };

    validateUsername();
  }, [debouncedUsername, formData.recipientType]);

  const loadCountryStats = async () => {
    try {
      setLoadingCountries(true);

      const { data, error } = await supabase.functions.invoke("get-country-stats");

      if (error) throw error;

      if (data?.success && data?.data) {
        setCountryStats(data.data);
        console.log(`Loaded ${data.data.length} countries with users`);
      }
    } catch (error: any) {
      console.error("Error loading country stats:", error);
      // Don't show error toast to avoid annoying users, just log it
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadPlanStats = async () => {
    try {
      setLoadingPlans(true);

      const { data, error } = await supabase.functions.invoke("get-plan-stats");

      if (error) throw error;

      setMembershipPlans(data || []);
      console.log(`Loaded ${data?.length || 0} membership plans with user counts`);
    } catch (error: any) {
      console.error("Error loading plan stats:", error);
      // Don't show error toast to avoid annoying users, just log it
    } finally {
      setLoadingPlans(false);
    }
  };

  const calculateRecipientCount = async () => {
    try {
      setCalculatingCount(true);
      
      // For email type, validate email and set count to 1 if valid
      if (formData.recipientType === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValidEmail = emailRegex.test(formData.email.trim());
        setRecipientCount(isValidEmail && formData.email.trim() ? 1 : 0);
        setCalculatingCount(false);
        return;
      }
      
      let query = supabase.from("profiles").select("*", { count: "exact", head: true });

      if (formData.recipientType === "plan" && formData.plan) {
        query = query.eq("membership_plan", formData.plan);
      } else if (formData.recipientType === "country" && formData.country) {
        query = query.eq("country", formData.country);
      } else if (formData.recipientType === "usernames" && formData.usernames) {
        const usernames = formData.usernames.split(",").map((u) => u.trim()).filter(u => u.length > 0);
        if (usernames.length === 0) {
          setRecipientCount(0);
          setCalculatingCount(false);
          return;
        }
        query = query.in("username", usernames);
      }

      const { count, error } = await query;
      
      if (error) {
        console.error("Error calculating recipients:", error);
        toast.error("Failed to calculate recipient count");
        setRecipientCount(0);
      } else {
        setRecipientCount(count || 0);
      }
    } catch (error: any) {
      console.error("Error calculating recipients:", error);
      toast.error("Failed to calculate recipient count");
      setRecipientCount(0);
    } finally {
      setCalculatingCount(false);
    }
  };
  
  const getPreviewContent = () => {
    let content = formData.body;
    
    // Replace common variables for preview
    content = content.replace(/{{username}}/g, '<strong style="color: #667eea;">john_doe</strong>');
    content = content.replace(/{{email}}/g, '<strong style="color: #667eea;">user@example.com</strong>');
    content = content.replace(/{{full_name}}/g, '<strong style="color: #667eea;">John Doe</strong>');
    
    // Wrap content in professional email template
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; padding: 40px 15px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Gradient Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              FineEarn
            </h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            ${content}
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #6c757d;">
              <strong style="color: #495057;">FineEarn</strong> - Earn by Training AI
            </p>
            <p style="margin: 0 0 15px 0; font-size: 13px; color: #868e96;">
              This email was sent from FineEarn. If you have any questions, please contact our support team.
            </p>
            <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
              © ${new Date().getFullYear()} FineEarn. All rights reserved.
            </p>
          </div>
          
        </div>
      </div>
    `;
  };

  const handleSend = async () => {
    try {
      if (!formData.subject || !formData.body) {
        toast.error("Please fill in subject and body");
        return;
      }

      if (formData.recipientType === "plan" && !formData.plan) {
        toast.error("Please select a membership plan");
        return;
      }

      if (formData.recipientType === "country" && !formData.country) {
        toast.error("Please enter a country");
        return;
      }

      if (formData.recipientType === "usernames") {
        if (!formData.usernames.trim()) {
          toast.error("Please enter a username");
          return;
        }
        if (usernameValidationState.status !== 'valid') {
          toast.error("Please enter a valid username before sending");
          return;
        }
      }

      if (formData.recipientType === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim()) {
          toast.error("Please enter an email address");
          return;
        }
        if (!emailRegex.test(formData.email.trim())) {
          toast.error("Please enter a valid email address");
          return;
        }
      }

      if (recipientCount === 0) {
        toast.error("No recipients found matching criteria");
        return;
      }

      if (formData.scheduleType === "scheduled") {
        if (!formData.scheduledDate || !formData.scheduledTime) {
          toast.error("Please select schedule date and time");
          return;
        }
      }

      setSending(true);

      // PHASE 3: Check for duplicate jobs before creating new one
      const recipientFilter = {
        type: formData.recipientType,
        plan: formData.plan || null,
        country: formData.country || null,
        usernames: formData.usernames || null,
        email: formData.email || null,
      };
      
      const duplicateHash = await generateDuplicateHash(
        formData.subject,
        formData.body,
        recipientFilter
      );

      // Query for existing jobs with same hash (queued or processing)
      const { data: existingJob, error: duplicateCheckError } = await supabase
        .from("bulk_email_jobs")
        .select("id, status, created_at, total_recipients")
        .eq("duplicate_check_hash", duplicateHash)
        .in("status", ["queued", "processing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (duplicateCheckError) {
        console.error("Error checking for duplicate jobs:", duplicateCheckError);
        // Continue anyway - this is not a critical error
      }

      if (existingJob) {
        setSending(false);
        const createdAgo = Math.round((Date.now() - new Date(existingJob.created_at).getTime()) / 1000 / 60);
        const timeText = createdAgo < 60 
          ? `${createdAgo} minute${createdAgo !== 1 ? 's' : ''} ago`
          : `${Math.round(createdAgo / 60)} hour${Math.round(createdAgo / 60) !== 1 ? 's' : ''} ago`;
        
        toast.error("Duplicate Email Campaign Detected", {
          description: `A similar email campaign already exists (Status: ${existingJob.status}, ${existingJob.total_recipients} recipients). Created ${timeText}. Please wait for it to complete or modify your email content.`,
          duration: 8000,
        });
        return;
      }

      if (formData.scheduleType === "scheduled") {
        // Schedule email
        const scheduledFor = new Date(
          `${formData.scheduledDate}T${formData.scheduledTime}`
        ).toISOString();

        const { error } = await supabase.from("scheduled_emails").insert([
          {
            subject: formData.subject,
            body: formData.body,
            recipient_filter: {
              type: formData.recipientType,
              plan: formData.plan,
              country: formData.country,
              usernames: formData.usernames,
              email: formData.email,
            },
            scheduled_for: scheduledFor,
            created_by: user?.id,
          },
        ]);

        if (error) throw error;

        toast.success(
          `Email scheduled for ${new Date(scheduledFor).toLocaleString()}`
        );
      } else {
        // Send immediately (creates background job for database users)
        const { data: response, error } = await supabase.functions.invoke("send-bulk-email", {
          body: {
            subject: formData.subject,
            body: formData.body,
            recipientType: formData.recipientType,
            plan: formData.plan,
            country: formData.country,
            usernames: formData.usernames,
            email: formData.email,
          },
        });

        if (error) throw error;

        // Check if it's a job-based response (database users) or immediate send (external email)
        if (response?.job_id) {
          // Background job created for database users
          const estimatedTimeText = response.estimated_time_minutes > 60 
            ? `${Math.round(response.estimated_time_minutes / 60)} hours`
            : `${response.estimated_time_minutes} minutes`;

          toast.success(
            `✅ Bulk email job created! Processing ${response.total_recipients.toLocaleString()} recipients in background.`,
            {
              description: `Estimated completion: ${estimatedTimeText}. View progress in History tab.`,
              duration: 5000,
            }
          );

          // Optional: Auto-switch to history tab after 2 seconds to show job progress
          setTimeout(() => {
            const historyTab = document.querySelector('[value="history"]') as HTMLElement;
            if (historyTab) historyTab.click();
          }, 2000);
        } else {
          // Immediate send (external email)
          toast.success(`Email sent successfully!`);
        }
      }

      // Reset form
      setFormData({
        subject: "",
        body: "",
        recipientType: "all",
        plan: "",
        country: "",
        usernames: "",
        email: "",
        scheduleType: "immediate",
        scheduledDate: "",
        scheduledTime: "",
      });
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const getPreviewHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          ${formData.body}
        </body>
      </html>
    `;
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <h1 className="text-3xl font-bold mb-2">Bulk Email System</h1>
          <p className="text-muted-foreground">
            Send emails to users based on various criteria
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="compose" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="compose">
              <Send className="h-4 w-4 mr-2" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="best-practices">
              <Info className="h-4 w-4 mr-2" />
              Best Practices
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Compose Form */}
              <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Compose Email</CardTitle>
                <CardDescription>
                  Create and send bulk emails to your users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recipient Selection - MOVED TO TOP */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Recipients *</Label>
                    {calculatingCount ? (
                      <Badge variant="secondary" className="gap-2">
                        <LoadingSpinner size="sm" />
                        <span>Calculating...</span>
                      </Badge>
                    ) : (
                      <Badge 
                        variant={recipientCount === 0 ? "destructive" : "default"}
                        className="gap-2 text-base px-3 py-1"
                      >
                        📧 Will send to: <strong>{recipientCount.toLocaleString()}</strong> {recipientCount === 1 ? 'user' : 'users'}
                      </Badge>
                    )}
                  </div>
                  
                  {recipientCount === 0 && !calculatingCount && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No recipients found with the current selection. Please adjust your filters.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Tabs
                    value={formData.recipientType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, recipientType: value })
                    }
                  >
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="all">All Users</TabsTrigger>
                      <TabsTrigger value="plan">By Plan</TabsTrigger>
                      <TabsTrigger value="country">By Country</TabsTrigger>
                      <TabsTrigger value="usernames">By Username</TabsTrigger>
                      <TabsTrigger value="email">By Email</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Email will be sent to all registered users
                      </p>
                    </TabsContent>

                    <TabsContent value="plan" className="mt-4">
                      <Select
                        value={formData.plan}
                        onValueChange={(value) =>
                          setFormData({ ...formData, plan: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select membership plan" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {loadingPlans ? (
                            <div className="flex items-center justify-center py-4">
                              <LoadingSpinner size="sm" />
                              <span className="ml-2 text-sm text-muted-foreground">Loading plans...</span>
                            </div>
                          ) : membershipPlans.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              No plans with users found
                            </div>
                          ) : (
                            membershipPlans.map(({ name, display_name, count }) => (
                              <SelectItem key={name} value={name}>
                                {display_name} ({count.toLocaleString()} {count === 1 ? 'user' : 'users'})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </TabsContent>

                    <TabsContent value="country" className="mt-4">
                      <Select
                        value={formData.country}
                        onValueChange={(value) =>
                          setFormData({ ...formData, country: value })
                        }
                        disabled={loadingCountries}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingCountries ? "Loading countries..." : "Select a country"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {loadingCountries ? (
                            <div className="flex items-center justify-center py-4">
                              <LoadingSpinner size="sm" />
                              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                            </div>
                          ) : countryStats.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              No countries with users found
                            </div>
                          ) : (
                            countryStats.map(({ code, count }) => {
                              const countryName = getCountryName(code) || code;
                              return (
                                <SelectItem key={code} value={code}>
                                  {countryName} ({count.toLocaleString()} {count === 1 ? 'user' : 'users'})
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-2">
                        💡 Countries are sorted by user count (highest first)
                      </p>
                    </TabsContent>

                    <TabsContent value="usernames" className="mt-4">
                      <div className="space-y-3">
                        <Input
                          value={formData.usernames}
                          onChange={(e) =>
                            setFormData({ ...formData, usernames: e.target.value })
                          }
                          placeholder="Enter username"
                          className="w-full"
                        />
                        
                        {/* Validation Feedback */}
                        {usernameValidationState.status === 'checking' && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Checking username...</span>
                          </div>
                        )}

                        {usernameValidationState.status === 'invalid' && (
                          <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              {usernameValidationState.message}
                            </AlertDescription>
                          </Alert>
                        )}

                        {usernameValidationState.status === 'error' && (
                          <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                              {usernameValidationState.message}
                            </AlertDescription>
                          </Alert>
                        )}

                        {usernameValidationState.status === 'valid' && usernameValidationState.user && (
                          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                                <div className="flex-1 space-y-2">
                                  <div className="font-medium text-sm text-green-900 dark:text-green-100">
                                    Valid user found
                                  </div>
                                  <div className="space-y-1.5 text-sm">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
                                      <span className="font-medium text-green-900 dark:text-green-100">
                                        {usernameValidationState.user.username}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
                                      <span className="text-green-800 dark:text-green-200">
                                        {usernameValidationState.user.email}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-3.5 w-3.5 text-green-700 dark:text-green-300" />
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs border-green-300 dark:border-green-700"
                                      >
                                        {usernameValidationState.user.membership_plan}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <p className="text-sm text-muted-foreground">
                          💡 Enter a single username (e.g., john_doe)
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="email" className="mt-4">
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="Enter email address"
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        💡 Send to any email address (even if not registered on the platform)
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Subject */}
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    placeholder="Email subject"
                  />
                </div>

                {/* Body */}
                <div>
                  <Label htmlFor="body">Email Body *</Label>
                  <RichTextEditor
                    value={formData.body}
                    onChange={(html) => setFormData({ ...formData, body: html })}
                    placeholder="Compose your email content. Use {{variable}} for personalization."
                    maxLength={20000}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    💡 See the "Available Variables" section in the sidebar for all personalization options
                  </p>
                </div>

                {/* Preview Button */}
                <Button
                  variant="outline"
                  onClick={() => setPreviewDialogOpen(true)}
                  className="w-full"
                  disabled={!formData.subject || !formData.body}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Email
                </Button>

                {/* Schedule Options */}
                <div>
                  <Label>Send Options</Label>
                  <Tabs
                    value={formData.scheduleType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, scheduleType: value })
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="immediate">Send Now</TabsTrigger>
                      <TabsTrigger value="scheduled">Schedule</TabsTrigger>
                    </TabsList>

                    <TabsContent value="immediate" className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Email will be sent immediately
                      </p>
                    </TabsContent>

                    <TabsContent value="scheduled" className="mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={formData.scheduledDate}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                scheduledDate: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="time">Time</Label>
                          <Input
                            id="time"
                            type="time"
                            value={formData.scheduledTime}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                scheduledTime: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={sending || recipientCount === 0}
                  className="w-full"
                  size="lg"
                >
                  {sending ? (
                    <>Loading...</>
                  ) : formData.scheduleType === "scheduled" ? (
                    <>
                      <Clock className="mr-2 h-5 w-5" />
                      Schedule Email
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Send Email
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recipient Count */}
            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {recipientCount}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    users will receive this email
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Email Variables Reference */}
            <EmailVariableReference />

            {/* Professional Template */}
            <Card>
              <CardHeader>
                <CardTitle>Professional Template</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  All emails are automatically wrapped in a professional template with:
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground mt-3">
                  <li>• Branded gradient header</li>
                  <li>• Responsive design</li>
                  <li>• Professional footer</li>
                  <li>• Optimized for inbox delivery</li>
                </ul>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Test with a small group first</li>
                  <li>• Schedule emails for optimal times</li>
                  <li>• Keep content clear and concise</li>
                  <li>• Use personalization variables</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>
                This is how your email will appear to recipients. Variables are shown with sample data.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Subject Preview */}
              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  <p className="font-medium">{formData.subject}</p>
                </div>
              </div>
              
              {/* Recipient Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> Variables like {`{{username}}`} and {`{{email}}`} will be replaced with actual recipient data when sent.
                </AlertDescription>
              </Alert>
              
              {/* Body Preview */}
              <div>
                <Label className="text-sm font-medium">Email Body</Label>
                <div className="mt-1 border rounded-lg overflow-hidden" style={{ backgroundColor: '#f4f4f7' }}>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
                  />
                </div>
              </div>
              
              {/* Send Info */}
              <Alert variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This email will be sent to <strong>{recipientCount}</strong> recipient{recipientCount !== 1 ? 's' : ''}.
                  {formData.scheduleType === 'scheduled' && formData.scheduledDate && formData.scheduledTime && (
                    <> Scheduled for: <strong>{new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toLocaleString()}</strong></>
                  )}
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                Close Preview
              </Button>
              <Button onClick={() => {
                setPreviewDialogOpen(false);
                handleSend();
              }} disabled={sending || recipientCount === 0}>
                {formData.scheduleType === 'scheduled' ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Schedule Now
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Now
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <EmailHistoryTab emailType="bulk" />
          </TabsContent>

          {/* Best Practices Tab */}
          <TabsContent value="best-practices">
            <EmailBestPractices />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BulkEmail;
