# Supabase Auth Hook Configuration Guide

## Overview
The FineEarn platform uses custom email templates for all authentication emails (password reset, email confirmation, etc.). This requires configuring the Supabase Auth Hook to call our custom edge function.

## ✅ Phase 4 Implementation Complete

### What Was Fixed:
1. **Email Domain Corrected**: Changed from `noreply@fineearn.com` to `noreply@mail.fineearn.com` (verified domain)
2. **HOOK_SECRET Added**: Security secret configured for auth hook verification
3. **Magic Link Template Created**: Missing `auth_magic_link` template added to database
4. **Email Sender Helper**: Reusable helper function created for all edge functions
5. **Email Triggers Added**:
   - ✅ Welcome email on registration (`track-user-registration`)
   - ✅ Deposit confirmation (`cpay-webhook`)
   - ✅ Withdrawal processed (`process-withdrawal-payment`)
   - ✅ Withdrawal rejected (`process-withdrawal-payment`)
   - ✅ Plan upgrade confirmation (`upgrade-plan`)

## 🔐 Required Auth Hook Configuration

### Step 1: Configure in Supabase Dashboard

Navigate to: **Authentication > Email Templates > Custom SMTP**

Set the following:

```yaml
Hook Type: Send Email Hook
Enabled: ✓ true
Hook URL: https://mobikymhzchzakwzpqep.supabase.co/functions/v1/send-auth-email
Secret: <VALUE_FROM_HOOK_SECRET_IN_SECRETS>
```

### Step 2: Enable for These Events

Check all these event types:

- ✓ `user.signup` - Email confirmation on signup
- ✓ `user.password_recovery` - Password reset emails
- ✓ `user.email_change` - Email change confirmation
- ✓ `user.magiclink` - Magic link login

## 📧 Available Email Templates

### Auth Templates (Triggered via Hook):
1. **auth_email_confirmation** - "Confirm Your Email" 
2. **auth_password_reset** - "Reset Your Password"
3. **auth_email_change** - "Confirm Email Change"
4. **auth_magic_link** - "Your Magic Link to Login" ✅ NEW

### Transactional Templates (Triggered via Edge Functions):
5. **user_onboarding** - "Welcome" (sent on registration)
6. **transaction** - "Deposit Confirmation" (sent on deposit)
7. **transaction** - "Withdrawal Processed" (sent on withdrawal approval)
8. **transaction** - "Withdrawal Rejected" (sent on withdrawal rejection)
9. **membership** - "Plan Upgrade Confirmation" (sent on plan upgrade)

## 🔍 Verification Checklist

### Test Auth Emails:
- [ ] Request password reset → Receives professional email with custom template
- [ ] Sign up new user → Receives email confirmation with custom template
- [ ] Request magic link → Receives magic link email with custom template
- [ ] Change email → Receives confirmation with custom template

### Test Transactional Emails:
- [ ] New user signup → Receives welcome email
- [ ] Complete deposit → Receives deposit confirmation
- [ ] Admin approves withdrawal → Receives withdrawal processed email
- [ ] Admin rejects withdrawal → Receives rejection email with reason
- [ ] Upgrade membership plan → Receives upgrade confirmation

### Verify Email Logs:
- [ ] Check `email_logs` table for all sent emails
- [ ] Verify all emails show `status: 'sent'`
- [ ] Check for any failed emails and error messages

## 🎨 Email Styling

All email templates use:
- Professional gradient headers (purple/blue)
- Responsive design (mobile-friendly)
- Styled CTA buttons
- Security notices
- Branded footer
- Consistent FineEarn branding

**Sender:** `FineEarn <noreply@mail.fineearn.com>`

## 🔧 Technical Details

### Edge Function: `send-auth-email`
- **Location**: `supabase/functions/send-auth-email/index.ts`
- **Purpose**: Receives auth events from Supabase, fetches custom templates, replaces variables, sends via Resend
- **Security**: Verifies `HOOK_SECRET` from authorization header
- **Logging**: All emails logged to `email_logs` table

### Email Sender Helper: `_shared/email-sender.ts`
- **Purpose**: Reusable function for sending templated emails from any edge function
- **Features**:
  - Fetches active templates from database
  - Replaces template variables
  - Sends via Resend API
  - Logs to `email_logs` table
  - Returns success/failure status

## 🚨 Troubleshooting

### Issue: Still receiving default Supabase emails

**Solution**: Verify auth hook is properly configured in Supabase Dashboard and pointing to correct URL with valid HOOK_SECRET.

### Issue: Emails not being sent

**Checks**:
1. Verify `RESEND_API_KEY` is configured
2. Check `noreply@mail.fineearn.com` is verified in Resend dashboard
3. Review edge function logs for send-auth-email
4. Check `email_logs` table for error messages

### Issue: Variables not replaced in emails

**Solution**: Ensure template variables match exactly (case-sensitive). Check `email_logs` table to see populated HTML.

## 📝 Environment Variables Required

```bash
RESEND_API_KEY=re_xxxxx  # Resend API key for sending emails
HOOK_SECRET=xxxxx        # Secret for verifying auth hook requests
```

## 🎯 Next Steps (Future Enhancements)

- [ ] Plan expiry reminder emails (scheduled)
- [ ] Referral milestone emails
- [ ] Email templates for other earning modules (watch videos, visit websites, etc.)
- [ ] Email analytics and tracking
- [ ] A/B testing for email templates
- [ ] Personalized email content based on user behavior

---

**Status**: ✅ Phase 4 Complete - Auth emails fixed, all triggers implemented
**Last Updated**: November 1, 2025
