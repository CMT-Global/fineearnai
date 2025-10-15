-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create email logs table to track sent emails
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create scheduled emails table
CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Create policies for email_templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for email_logs
CREATE POLICY "Admins can view email logs"
ON public.email_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert email logs"
ON public.email_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for scheduled_emails
CREATE POLICY "Admins can manage scheduled emails"
ON public.scheduled_emails
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_scheduled_emails_status ON public.scheduled_emails(status);
CREATE INDEX idx_scheduled_emails_scheduled_for ON public.scheduled_emails(scheduled_for);

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, body, template_type, variables) VALUES
('welcome', 'Welcome to Our Platform!', 
'<h1>Welcome {{username}}!</h1>
<p>Thank you for joining our platform. We''re excited to have you on board.</p>
<p>Your account has been successfully created with email: {{email}}</p>
<p>Get started by completing your first task and earning rewards!</p>
<p>Best regards,<br>The Team</p>', 
'user_onboarding', 
'["username", "email"]'::jsonb),

('deposit_confirmation', 'Deposit Confirmed', 
'<h1>Deposit Successful</h1>
<p>Hi {{username}},</p>
<p>Your deposit of {{amount}} has been successfully processed.</p>
<p>Transaction ID: {{transaction_id}}</p>
<p>Your new balance: {{new_balance}}</p>
<p>Thank you for your deposit!</p>', 
'transaction', 
'["username", "amount", "transaction_id", "new_balance"]'::jsonb),

('withdrawal_processed', 'Withdrawal Processed', 
'<h1>Withdrawal Approved</h1>
<p>Hi {{username}},</p>
<p>Your withdrawal request of {{amount}} has been approved and processed.</p>
<p>The funds will be transferred to your account within 1-3 business days.</p>
<p>Transaction ID: {{transaction_id}}</p>', 
'transaction', 
'["username", "amount", "transaction_id"]'::jsonb),

('withdrawal_rejected', 'Withdrawal Request Rejected', 
'<h1>Withdrawal Request Rejected</h1>
<p>Hi {{username}},</p>
<p>Unfortunately, your withdrawal request of {{amount}} has been rejected.</p>
<p>Reason: {{rejection_reason}}</p>
<p>The amount has been refunded to your earnings wallet.</p>
<p>If you have any questions, please contact support.</p>', 
'transaction', 
'["username", "amount", "rejection_reason"]'::jsonb),

('plan_expiry_reminder', 'Your Plan is Expiring Soon', 
'<h1>Plan Expiry Reminder</h1>
<p>Hi {{username}},</p>
<p>Your {{plan_name}} membership will expire on {{expiry_date}}.</p>
<p>To continue enjoying premium benefits, please renew your membership.</p>
<p>Renew now and keep earning!</p>', 
'membership', 
'["username", "plan_name", "expiry_date"]'::jsonb),

('referral_milestone', 'Referral Milestone Achieved!', 
'<h1>Congratulations!</h1>
<p>Hi {{username}},</p>
<p>You''ve reached a new referral milestone: {{milestone}} referrals!</p>
<p>Total earnings from referrals: {{total_earnings}}</p>
<p>Keep sharing and earning more rewards!</p>', 
'referral', 
'["username", "milestone", "total_earnings"]'::jsonb);