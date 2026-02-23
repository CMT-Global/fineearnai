-- User-to-user transfers (Deposit Wallet only): tables and atomic function
-- Reference: Internal Transfers plan

-- 1. user_transfers table
CREATE TABLE IF NOT EXISTS public.user_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT NOT NULL UNIQUE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 4) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  failure_reason TEXT,
  otp_requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_transfers_sender ON public.user_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_user_transfers_recipient ON public.user_transfers(recipient_id);
CREATE INDEX IF NOT EXISTS idx_user_transfers_status ON public.user_transfers(status);
CREATE INDEX IF NOT EXISTS idx_user_transfers_created_at ON public.user_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_transfers_reference_id ON public.user_transfers(reference_id);

COMMENT ON TABLE public.user_transfers IS 'User-to-user deposit wallet transfers; single source of truth for admin report and audit';

-- 2. user_transfer_otps table (max_attempts = 3 per plan todo)
CREATE TABLE IF NOT EXISTS public.user_transfer_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_transfer_id UUID NOT NULL REFERENCES public.user_transfers(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_transfer_otps_lookup
  ON public.user_transfer_otps(user_id, user_transfer_id, used_at);
CREATE INDEX IF NOT EXISTS idx_user_transfer_otps_expires ON public.user_transfer_otps(expires_at);

ALTER TABLE public.user_transfer_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages user transfer OTPs"
  ON public.user_transfer_otps FOR ALL USING (true);

-- 3. RLS for user_transfers (admins read all; users read own as sender or recipient)
ALTER TABLE public.user_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_transfers"
  ON public.user_transfers FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Admins can view all user_transfers"
  ON public.user_transfers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Inserts/updates are done only by Edge Functions (service role bypasses RLS)

-- 4. Atomic transfer execution
CREATE OR REPLACE FUNCTION public.process_user_transfer_atomic(p_user_transfer_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_transfer RECORD;
  v_sender_balance NUMERIC;
  v_recipient_balance NUMERIC;
  v_new_sender_balance NUMERIC;
  v_new_recipient_balance NUMERIC;
  v_sender_txn_id UUID;
  v_recipient_txn_id UUID;
BEGIN
  -- Lock transfer row and fetch
  SELECT id, reference_id, sender_id, recipient_id, amount, currency, status
  INTO v_transfer
  FROM user_transfers
  WHERE id = p_user_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer not found', 'error_code', 'TRANSFER_NOT_FOUND');
  END IF;

  IF v_transfer.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer is not pending', 'error_code', 'INVALID_STATUS');
  END IF;

  -- Lock sender profile and get balance
  SELECT deposit_wallet_balance INTO v_sender_balance
  FROM profiles WHERE id = v_transfer.sender_id FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    UPDATE user_transfers SET status = 'failed', failure_reason = 'Sender profile not found', updated_at = NOW()
    WHERE id = p_user_transfer_id;
    RETURN jsonb_build_object('success', false, 'error', 'Sender profile not found', 'error_code', 'SENDER_NOT_FOUND');
  END IF;

  IF v_sender_balance < v_transfer.amount THEN
    UPDATE user_transfers SET status = 'failed', failure_reason = 'Insufficient balance', updated_at = NOW()
    WHERE id = p_user_transfer_id;
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'error_code', 'INSUFFICIENT_BALANCE');
  END IF;

  -- Lock recipient profile and get balance
  SELECT deposit_wallet_balance INTO v_recipient_balance
  FROM profiles WHERE id = v_transfer.recipient_id FOR UPDATE;

  IF v_recipient_balance IS NULL THEN
    UPDATE user_transfers SET status = 'failed', failure_reason = 'Recipient profile not found', updated_at = NOW()
    WHERE id = p_user_transfer_id;
    RETURN jsonb_build_object('success', false, 'error', 'Recipient profile not found', 'error_code', 'RECIPIENT_NOT_FOUND');
  END IF;

  v_new_sender_balance := v_sender_balance - v_transfer.amount;
  v_new_recipient_balance := v_recipient_balance + v_transfer.amount;

  -- Update sender balance
  UPDATE profiles
  SET deposit_wallet_balance = v_new_sender_balance, last_activity = NOW()
  WHERE id = v_transfer.sender_id;

  -- Update recipient balance
  UPDATE profiles
  SET deposit_wallet_balance = v_new_recipient_balance, last_activity = NOW()
  WHERE id = v_transfer.recipient_id;

  -- Sender transaction (outgoing transfer)
  INSERT INTO transactions (user_id, type, amount, wallet_type, status, new_balance, description, metadata, created_at)
  VALUES (
    v_transfer.sender_id,
    'transfer',
    v_transfer.amount,
    'deposit',
    'completed',
    v_new_sender_balance,
    'Transfer to user (Deposit Wallet)',
    jsonb_build_object(
      'transfer_type', 'user_to_user',
      'reference_id', v_transfer.reference_id,
      'user_transfer_id', p_user_transfer_id,
      'recipient_id', v_transfer.recipient_id
    ),
    NOW()
  )
  RETURNING id INTO v_sender_txn_id;

  -- Recipient transaction (incoming transfer)
  INSERT INTO transactions (user_id, type, amount, wallet_type, status, new_balance, description, metadata, created_at)
  VALUES (
    v_transfer.recipient_id,
    'transfer',
    v_transfer.amount,
    'deposit',
    'completed',
    v_new_recipient_balance,
    'Transfer from user (Deposit Wallet)',
    jsonb_build_object(
      'transfer_type', 'user_to_user',
      'reference_id', v_transfer.reference_id,
      'user_transfer_id', p_user_transfer_id,
      'sender_id', v_transfer.sender_id
    ),
    NOW()
  )
  RETURNING id INTO v_recipient_txn_id;

  -- Mark transfer complete
  UPDATE user_transfers
  SET status = 'success', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_user_transfer_id;

  RETURN jsonb_build_object(
    'success', true,
    'reference_id', v_transfer.reference_id,
    'new_sender_balance', v_new_sender_balance,
    'new_recipient_balance', v_new_recipient_balance
  );
END;
$function$;

-- Grant execute to authenticated and service role
GRANT EXECUTE ON FUNCTION public.process_user_transfer_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_user_transfer_atomic(UUID) TO service_role;
