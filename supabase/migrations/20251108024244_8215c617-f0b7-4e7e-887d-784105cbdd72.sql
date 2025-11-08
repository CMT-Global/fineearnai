-- Create how_it_works_steps table for dynamic content management
CREATE TABLE public.how_it_works_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'HelpCircle',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.how_it_works_steps ENABLE ROW LEVEL SECURITY;

-- Admins can manage all steps
CREATE POLICY "Admins can manage how it works steps"
ON public.how_it_works_steps
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active steps
CREATE POLICY "Anyone can view active how it works steps"
ON public.how_it_works_steps
FOR SELECT
USING (is_active = true);

-- Create index for ordering
CREATE INDEX idx_how_it_works_steps_number ON public.how_it_works_steps(step_number);

-- Create trigger for updated_at
CREATE TRIGGER update_how_it_works_steps_updated_at
  BEFORE UPDATE ON public.how_it_works_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default steps
INSERT INTO public.how_it_works_steps (step_number, title, description, icon_name) VALUES
(1, 'Create Your Account', 'Sign up with your email and create a username. Get instant access to the platform and start your earning journey today.', 'UserPlus'),
(2, 'Complete Your Profile', 'Set up your withdrawal methods and verify your email address. This ensures smooth payouts when you''re ready to cash out.', 'Settings'),
(3, 'Choose Your Plan', 'Start with our free plan or upgrade to unlock higher earnings per task, more daily tasks, and better referral commissions.', 'CreditCard'),
(4, 'Start Training AI', 'Access simple AI training tasks daily. Compare two AI responses and select the better one. Each correct answer earns you money instantly.', 'Brain'),
(5, 'Track Your Earnings', 'Watch your earnings grow in real-time. Your earnings wallet updates immediately after each completed task.', 'TrendingUp'),
(6, 'Invite Friends', 'Share your unique referral link and earn commissions when your referrals complete tasks and upgrade their accounts.', 'Users'),
(7, 'Upgrade Anytime', 'Boost your earning potential by upgrading your plan. Higher plans offer more tasks per day and increased earnings per task.', 'Rocket'),
(8, 'Withdraw Your Earnings', 'Request withdrawals to your crypto wallet on designated payout days. Minimum withdrawal amounts vary by plan.', 'Wallet');