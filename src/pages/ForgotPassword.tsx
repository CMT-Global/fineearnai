import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { useTranslation } from "react-i18next";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { platformName, platformLogoUrl } = useBranding();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      // Call custom password reset backend function
      const { data: result, error } = await supabase.functions.invoke('request-password-reset', {
        body: { email: data.email },
      });

      if (error) throw error;

      // Check for rate limiting error
      if (result?.error === 'rate_limit_exceeded') {
        toast.error(result.message || t("forgotPassword.rateLimitExceeded"));
        return;
      }

      if (!result?.success) {
        throw new Error(result?.message || t("forgotPassword.failedToSend"));
      }

      setIsSubmitted(true);
      toast.success(t("forgotPassword.resetLinkSent"));
    } catch (error: any) {
      console.error('Password reset request failed:', error);
      toast.error(error.message || t("forgotPassword.failedToSend"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src={platformLogoUrl} alt={`${platformName} Logo`} className="h-24 w-24 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">{t("forgotPassword.title")}</CardTitle>
          <CardDescription>
            {isSubmitted
              ? t("forgotPassword.subtitleSubmitted")
              : t("forgotPassword.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSubmitted ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("forgotPassword.email")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder={t("forgotPassword.emailPlaceholder")}
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? t("forgotPassword.sending") : t("forgotPassword.sendResetLink")}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-center">
                  {t("forgotPassword.checkEmail")}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                {t("forgotPassword.returnToLogin")}
              </Button>
            </div>
          )}

          {!isSubmitted && (
            <div className="mt-4">
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("forgotPassword.backToLogin")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
