import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { PartnerWizard } from "@/components/partner/PartnerWizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsPartner, usePartnerApplication, useSubmitPartnerApplication } from "@/hooks/usePartner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Sparkles, CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const applicationSchema = z.object({
  preferred_contact_method: z.string().min(1, "Contact method is required"),
  whatsapp_number: z.string().optional(),
  telegram_username: z.string().optional(),
  whatsapp_group_link: z.string().url().optional().or(z.literal('')),
  telegram_group_link: z.string().url().optional().or(z.literal('')),
  application_notes: z.string().max(500).optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

const BecomePartner = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showWizard, setShowWizard] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const { data: isPartner, isLoading: checkingPartner } = useIsPartner();
  const { data: application, isLoading: loadingApplication } = usePartnerApplication();
  const submitMutation = useSubmitPartnerApplication();
  const { data: profile } = useProfile(user?.id || '');

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      preferred_contact_method: "",
      whatsapp_number: "",
      telegram_username: "",
      whatsapp_group_link: "",
      telegram_group_link: "",
      application_notes: "",
    },
  });

  useEffect(() => {
    if (isPartner) {
      navigate('/partner/dashboard');
    }
  }, [isPartner, navigate]);

  const handleWizardComplete = () => {
    setShowWizard(false);
    setShowForm(true);
  };

  const handleWizardClose = () => {
    navigate('/dashboard');
  };

  const onSubmit = (data: ApplicationFormData) => {
    if (!data.preferred_contact_method) {
      toast.error("Please select a contact method");
      return;
    }
    
    submitMutation.mutate({
      preferred_contact_method: data.preferred_contact_method,
      whatsapp_number: data.whatsapp_number,
      telegram_username: data.telegram_username,
      whatsapp_group_link: data.whatsapp_group_link,
      telegram_group_link: data.telegram_group_link,
      application_notes: data.application_notes,
    });
  };

  if (checkingPartner || loadingApplication) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (application) {
    const statusConfig = {
      pending: {
        icon: Clock,
        color: "text-yellow-600",
        bg: "bg-yellow-50 dark:bg-yellow-950/20",
        border: "border-yellow-200 dark:border-yellow-800",
        title: "Application Under Review",
        message: "We're reviewing your application! Our team typically responds within 24 hours. You'll receive an email notification once we've made a decision."
      },
      approved: {
        icon: CheckCircle,
        color: "text-green-600",
        bg: "bg-green-50 dark:bg-green-950/20",
        border: "border-green-200 dark:border-green-800",
        title: "Congratulations! You're Approved!",
        message: "Your partner application has been approved. You can now access your partner dashboard and start earning!"
      },
      rejected: {
        icon: XCircle,
        color: "text-red-600",
        bg: "bg-red-50 dark:bg-red-950/20",
        border: "border-red-200 dark:border-red-800",
        title: "Application Not Approved",
        message: application.rejection_reason || "Unfortunately, your application was not approved at this time. You can reapply after 30 days."
      }
    };

    const config = statusConfig[application.status as keyof typeof statusConfig];
    const StatusIcon = config.icon;

    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Card className={`${config.bg} ${config.border} border-2`}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full ${config.bg} flex items-center justify-center`}>
                  <StatusIcon className={`h-8 w-8 ${config.color}`} />
                </div>
                <div>
                  <CardTitle className="text-2xl">{config.title}</CardTitle>
                  <Badge variant={application.status === 'approved' ? 'default' : 'secondary'}>
                    {application.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">{config.message}</p>
              
              {application.status === 'approved' && (
                <Button size="lg" onClick={() => navigate('/partner/dashboard')} className="w-full">
                  Go to Partner Dashboard
                  <Sparkles className="h-5 w-5 ml-2" />
                </Button>
              )}

              {application.status === 'pending' && (
                <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                  Return to Dashboard
                </Button>
              )}

              {application.status === 'rejected' && (
                <div className="space-y-2">
                  <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                    Return to Dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout profile={profile} onSignOut={signOut}>
      <PartnerWizard
        open={showWizard} 
        onComplete={handleWizardComplete}
        onClose={handleWizardClose}
      />

      {showForm && (
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-8 w-8 text-primary" />
                <CardTitle className="text-2xl">Partner Application</CardTitle>
              </div>
              <CardDescription>
                Complete this form to become a FineEarn Local Partner and start earning today!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="preferred_contact_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Contact Method *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select contact method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="telegram">Telegram</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
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
                        <FormLabel>WhatsApp Number (with country code)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram_username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telegram Username</FormLabel>
                        <FormControl>
                          <Input placeholder="@username" {...field} />
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
                        <FormLabel>WhatsApp Group Link (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://chat.whatsapp.com/..." {...field} />
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
                        <FormLabel>Telegram Group/Channel Link (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://t.me/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="application_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Why do you want to become a partner? (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Tell us about your network and why you'd be a great partner..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                    Submit Application
                    <Sparkles className="h-5 w-5 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};

export default BecomePartner;
