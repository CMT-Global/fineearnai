# Resend Configuration Check

## Quick Diagnostic Steps

### 1. Check if RESEND_API_KEY is Set

Run this in your Supabase project:
```bash
supabase secrets list
```

Look for `RESEND_API_KEY` in the list. If missing, add it:
```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
```

### 2. Verify Resend API Key is Valid

1. Go to [Resend Dashboard](https://resend.com/api-keys)
2. Check if your API key is active
3. Verify it has "Send Email" permissions
4. Check if you've exceeded your quota

### 3. Check Domain Verification

1. Go to [Resend Dashboard → Domains](https://resend.com/domains)
2. Verify `mail.fineearn.com` is listed and shows "Verified" status
3. If not verified:
   - Add the domain
   - Configure DNS records (SPF, DKIM, DMARC)
   - Wait for verification (can take up to 48 hours)

### 4. Check Email Settings in Database

Run this SQL query:
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

**Expected:**
- `email_from_address` should be `noreply@mail.fineearn.com` (must match verified domain)
- `email_from_name` should be set
- Domain must be verified in Resend

### 5. Check Recent Email Logs

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
LIMIT 5;
```

Look for:
- `status = 'failed'` → Check `error_message` for details
- Missing `resend_id` → Email never reached Resend
- Recent failures → Configuration issue

### 6. Test Email Sending

Use the test email function:
1. Go to Admin → Email Settings
2. Click "Send Test Email"
3. Enter your email address
4. Check if you receive it

If test email fails, check:
- Resend API key is valid
- Domain is verified
- Email settings are correct

## Common Issues

### Issue: "Email delivery failed" but success: true

**Cause:** Response structure mismatch or Resend returning unexpected response

**Solution:** 
1. Check Resend dashboard for actual email status
2. Verify API key permissions
3. Check domain verification status

### Issue: RESEND_API_KEY not configured

**Solution:**
```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
```

Then redeploy edge functions:
```bash
supabase functions deploy send-template-email
supabase functions deploy send-verification-otp
```

### Issue: Domain not verified

**Solution:**
1. Add domain in Resend dashboard
2. Add DNS records to your domain provider
3. Wait for verification
4. Update `email_from_address` to use verified domain

## Next Steps

After checking the above:
1. Check Supabase Edge Function logs for `send-template-email`
2. Check Resend dashboard for email delivery status
3. Verify DNS records are properly configured
4. Test with a different email address


