-- Phase 2: Backward Compatibility - Allow users to view active vouchers for redemption
-- This ensures existing unredeemed vouchers can still be manually redeemed

-- Add RLS policy to allow any authenticated user to view active vouchers
-- This is needed for the VoucherRedemptionCard component to work with old voucher codes
DROP POLICY IF EXISTS "Users can view active vouchers for redemption" ON public.vouchers;
CREATE POLICY "Users can view active vouchers for redemption"
  ON public.vouchers FOR SELECT
  USING (status = 'active');