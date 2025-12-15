# Email Verification Troubleshooting Guide

## Issue: Verification emails not being received

This guide helps you diagnose why verification emails aren't being sent or received.

---

## Quick Diagnostic Checklist

### 1. Check Edge Function Logs

**In Supabase Dashboard:**
1. Go to **Edge Functions** → `send-verification-otp`
2. Click **Logs** tab
3. Look for recent executions
4. Check for error messages

**What to look for:**
- ✅ `✅ Verification email sent successfully`
- ❌ `❌ Email send failed`
- ❌ `❌ RESEND_API_KEY not configured`
- ❌ `❌ Template not found: email_verification_otp`

### 2. Verify RESEND_API_KEY is Configured

**Check Supabase Secrets:**
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Verify `RESEND_API_KEY` exists and is valid
3. If missing, add it:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxx
   ```

**Test the API key:**
- Go to Resend dashboard → API Keys
- Verify the key is active and has permissions

### 3. Check Email Template Exists

**In Supabase SQL Editor, run:**
```sql
SELECT 
  id, 
  name, 
  template_type, 
  is_active,
  subject
FROM email_templates 
WHERE template_type = 'email_verification_otp';
```

**Expected result:**
- Should return 1 row
- `is_active` should be `true`
- `template_type` should be `email_verification_otp`

**If missing:**
- Create the template in Admin → Email Templates
- Or run a migration to create it

### 4. Check Email Logs

**In Supabase SQL Editor:**
```sql
SELECT 
  id,
  email,
  template_type,
  status,
  error_message,
  sent_at,
  metadata->>'resend_id' as resend_id
FROM email_logs 
WHERE template_type = 'email_verification_otp'
ORDER BY sent_at DESC 
LIMIT 10;
```

**What to check:**
- `status` should be `'sent'` for successful emails
- `status` = `'failed'` indicates an error
- `error_message` shows why it failed
- `resend_id` should exist if email was sent to Resend

### 5. Verify Resend Domain Configuration

**In Resend Dashboard:**
1. Go to **Domains**
2. Verify `mail.fineearn.com` is verified
3. Check SPF, DKIM, and DMARC records are configured
4. Domain status should be "Verified"

**Common issues:**
- Domain not verified → emails won't send
- DNS records not configured → emails go to spam
- Domain suspended → all emails fail

### 6. Check Email Settings in Database

**Run this query:**
```sql
SELECT key, value 
FROM platform_config 
WHERE key IN (
  'email_from_address', 
  'email_from_name', 
  'email_reply_to', 
  'email_settings'
);
```

**Expected values:**
- `email_from_address` should be `noreply@mail.fineearn.com` (verified domain)
- `email_from_name` should be set (e.g., "FineEarn")
- `email_reply_to` should be a valid email

### 7. Test Email Sending Directly

**Use the test email function:**
1. Go to Admin → Email Settings
2. Click "Send Test Email"
3. Enter your email address
4. Check if you receive it

**Or via Edge Function:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-test-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

---

## Common Issues & Solutions

### Issue 1: "RESEND_API_KEY not configured"

**Symptoms:**
- Error in logs: `❌ RESEND_API_KEY not configured`
- Email status: `failed`
- Error message: "Email service not configured"

**Solution:**
1. Get API key from Resend dashboard
2. Add to Supabase secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxx
   ```
3. Redeploy edge functions if needed

---

### Issue 2: "Template not found: email_verification_otp"

**Symptoms:**
- Error: `Email template 'email_verification_otp' not found or inactive`
- No email sent

**Solution:**
1. Check if template exists:
   ```sql
   SELECT * FROM email_templates WHERE template_type = 'email_verification_otp';
   ```
2. If missing, create it:
   - Go to Admin → Email Templates
   - Create new template
   - Set `template_type` = `email_verification_otp`
   - Set `is_active` = `true`
   - Add subject and body with variables: `{{otp_code}}`, `{{username}}`, `{{email}}`

---

### Issue 3: "Email sent but not received"

**Symptoms:**
- Logs show: `✅ Email sent successfully`
- `email_logs` shows `status = 'sent'`
- But email not in inbox

**Possible causes:**
1. **Spam folder** - Check spam/junk folder
2. **Email provider blocking** - Some providers block automated emails
3. **Resend delivery issue** - Check Resend dashboard for delivery status
4. **Wrong email address** - Verify the email in user profile

**Solution:**
1. Check spam folder first
2. Check Resend dashboard → Emails → find the email by Resend ID
3. Verify email address in user profile:
   ```sql
   SELECT email FROM profiles WHERE id = 'USER_ID';
   ```

---

### Issue 4: "Rate limit exceeded"

**Symptoms:**
- Error: "Too many verification requests. Please try again in 15 minutes."
- Status: 429

**Solution:**
- Wait 15 minutes before requesting again
- Or check `email_verification_otps` table and delete old unused OTPs:
  ```sql
  DELETE FROM email_verification_otps 
  WHERE used_at IS NULL 
  AND expires_at < NOW();
  ```

---

### Issue 5: "Domain not verified in Resend"

**Symptoms:**
- Error: `The associated domain with your API key is not verified`
- Error: `Domain verification required: The domain 'mail.fineearn.com' is not verified in Resend`
- Emails fail immediately with status 500
- Error mentions domain verification

**Root Cause:**
The Resend API key being used doesn't have access to a verified domain, or the domain in the `from` address isn't verified in your Resend account.

**Solution:**

**Step 1: Verify Domain in Resend**
1. Go to [Resend Dashboard](https://resend.com/domains) → **Domains**
2. Click **Add Domain**
3. Enter your domain: `mail.fineearn.com` (or your domain)
4. Copy the DNS records provided (SPF, DKIM, DMARC)
5. Add these records to your domain's DNS settings
6. Click **Verify** in Resend dashboard
7. Wait for verification (can take up to 48 hours, usually faster)

**Step 2: Verify API Key Has Domain Access**
1. Go to Resend Dashboard → **API Keys**
2. Check if your API key has "Full Access" or is restricted to specific domains
3. If restricted, ensure `mail.fineearn.com` is included
4. If needed, create a new API key with full access or domain-specific access

**Step 3: Update Email Settings**
Ensure your database has the correct from address:
```sql
-- Check current email settings
SELECT key, value 
FROM platform_config 
WHERE key IN ('email_from_address', 'email_settings');

-- Update to use verified domain
UPDATE platform_config 
SET value = 'noreply@mail.fineearn.com'  -- Use your verified domain
WHERE key = 'email_from_address';

-- Or update the consolidated email_settings JSON
UPDATE platform_config 
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{from_address}',
  '"noreply@mail.fineearn.com"'::jsonb
)
WHERE key = 'email_settings';
```

**Step 4: Test**
1. Try sending a test email
2. Check edge function logs for success
3. Verify email is received

**Alternative: Use Resend Test Domain (Development Only)**
For testing/development, you can temporarily use Resend's test domain:
```sql
UPDATE platform_config 
SET value = 'onboarding@resend.dev'
WHERE key = 'email_from_address';
```
⚠️ **Note:** `onboarding@resend.dev` only works for sending to your own verified email address in Resend. It cannot be used for production emails to users.

---

## Debugging Steps

### Step 1: Check Recent OTP Requests

```sql
SELECT 
  id,
  user_id,
  email,
  otp_code,
  created_at,
  expires_at,
  used_at,
  attempts
FROM email_verification_otps
ORDER BY created_at DESC
LIMIT 5;
```

**What to check:**
- OTPs are being created (should see recent rows)
- `expires_at` is in the future
- `used_at` is NULL for new OTPs

### Step 2: Check Email Logs for Recent Attempts

```sql
SELECT 
  id,
  email,
  template_type,
  status,
  error_message,
  sent_at,
  metadata
FROM email_logs
WHERE template_type = 'email_verification_otp'
  AND sent_at > NOW() - INTERVAL '1 hour'
ORDER BY sent_at DESC;
```

**What to check:**
- `status` = `'sent'` means email was sent to Resend
- `status` = `'failed'` means there was an error
- `error_message` shows the specific error
- `metadata->>'resend_id'` should exist if sent successfully

### Step 3: Check Resend API Status

1. Go to Resend Dashboard → Emails
2. Look for recent emails
3. Check delivery status:
   - **Sent** = Email was sent to recipient's server
   - **Delivered** = Email reached inbox
   - **Bounced** = Email was rejected
   - **Failed** = Sending failed

### Step 4: Test Edge Function Directly

**Using curl:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-verification-otp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Check response:**
- `success: true` = OTP generated and email sent
- `success: false` = Error occurred
- `email_error: true` = Email delivery failed but OTP was created

---

## Admin Panel Tools

### Email History Tab

**Location:** Admin → Email Settings → Email History

**Features:**
- View all email logs
- Filter by status (sent, failed)
- Filter by template type
- View error messages
- Check Resend delivery status

**How to use:**
1. Navigate to Email History
2. Filter by `email_verification_otp` template type
3. Look for recent failed emails
4. Click on an email to see full details
5. Check `error_message` field for failure reason

### Test Email Function

**Location:** Admin → Email Settings → Send Test Email

**How to use:**
1. Enter your email address
2. Click "Send Test Email"
3. Check if you receive it
4. If test email works but verification doesn't, check template configuration

---

## Verification Checklist

Before reporting an issue, verify:

- [ ] `RESEND_API_KEY` is set in Supabase secrets
- [ ] Email template `email_verification_otp` exists and is active
- [ ] Domain `mail.fineearn.com` is verified in Resend
- [ ] Email settings in `platform_config` are configured
- [ ] Recent OTPs are being created in database
- [ ] Email logs show attempts (even if failed)
- [ ] Test email function works
- [ ] Checked spam/junk folder
- [ ] Email address in profile is correct

---

## Getting Help

If you've checked all the above and still have issues:

1. **Collect logs:**
   - Edge function logs from `send-verification-otp`
   - Edge function logs from `send-template-email`
   - Recent entries from `email_logs` table
   - Recent entries from `email_verification_otps` table

2. **Check Resend dashboard:**
   - Recent email attempts
   - Delivery status
   - API usage/quota

3. **Test with different email:**
   - Try with a different email provider (Gmail, Outlook, etc.)
   - Some providers block automated emails more aggressively

---

## Quick Fixes

### Fix 1: Recreate Email Template

```sql
-- Check if template exists
SELECT * FROM email_templates WHERE template_type = 'email_verification_otp';

-- If missing, create it (adjust subject/body as needed)
INSERT INTO email_templates (name, template_type, subject, body, is_active)
VALUES (
  'Email Verification OTP',
  'email_verification_otp',
  'Verify Your Email - Code: {{otp_code}}',
  '<h1>Verify Your Email</h1><p>Your verification code is: <strong>{{otp_code}}</strong></p><p>This code expires in {{expiry_minutes}} minutes.</p>',
  true
);
```

### Fix 2: Reset Email Settings

```sql
-- Update email settings
UPDATE platform_config 
SET value = 'noreply@mail.fineearn.com'
WHERE key = 'email_from_address';

UPDATE platform_config 
SET value = 'FineEarn'
WHERE key = 'email_from_name';
```

### Fix 3: Clear Old Failed Logs

```sql
-- Delete old failed email logs (optional, for cleanup)
DELETE FROM email_logs 
WHERE status = 'failed' 
AND sent_at < NOW() - INTERVAL '7 days';
```

---

## Monitoring

Set up alerts for:
- High failure rate in `email_logs`
- Missing `RESEND_API_KEY` errors
- Template not found errors
- Resend API quota limits

---

## Related Documentation

- [Email Templates Testing Guide](./EMAIL_TEMPLATES_TESTING_GUIDE.md)
- [Email Settings Configuration](./docs/EMAIL_SCHEDULING_SETUP_GUIDE.md)
- [Resend Integration](./docs/PHASE_2_EMAIL_VERIFICATION_COMPLETE.md)



