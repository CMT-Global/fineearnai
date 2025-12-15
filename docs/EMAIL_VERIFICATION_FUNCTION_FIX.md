# Email Verification Function - Fixes Applied

## Issues Found & Fixed

### Issue 1: Request Body Parsing Error ✅ FIXED

**Problem:**
The function tried to parse the request body as JSON even when no body was sent, which could cause errors if authentication failed.

**Location:** `supabase/functions/send-verification-otp/index.ts` (line 49-53)

**Fix Applied:**
- Added check for `content-type` header before parsing body
- Added try-catch around body parsing
- Added better logging for authentication flow

**Before:**
```typescript
// Fallback to request body if no auth header
if (!userId) {
  const body: SendOTPRequest = await req.json(); // ❌ Could fail if no body
  userId = body.user_id || null;
  userEmail = body.email || null;
}
```

**After:**
```typescript
// Fallback to request body if no auth header (for service-to-service calls)
if (!userId) {
  try {
    const contentType = req.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const body: SendOTPRequest = await req.json();
      userId = body.user_id || null;
      userEmail = body.email || null;
    }
  } catch (bodyError: any) {
    // No body or invalid JSON - that's okay if we have auth
    console.log(`ℹ️ [${requestId}] No request body or invalid JSON`);
  }
}
```

---

### Issue 2: Improved Error Handling ✅ FIXED

**Problem:**
The function didn't properly check if `send-template-email` returned success or failure.

**Fix Applied:**
- Added comprehensive error checking for email sending
- Better error messages returned to frontend
- Detailed logging for debugging

---

### Issue 3: Enhanced Logging ✅ ADDED

**Problem:**
Not enough logging to debug issues when emails don't send.

**Fix Applied:**
- Added request method and URL logging
- Added authentication status logging
- Added detailed error logging with stack traces
- Added OTP code logging (for debugging - remove in production)

---

## Function Call Flow

### Frontend → Edge Function

1. **User clicks "Send Verification Code"**
   - Component: `EmailVerificationDialog.tsx`
   - Function: `handleSendOTP()`

2. **Frontend calls edge function:**
   ```typescript
   const response = await supabase.functions.invoke('send-verification-otp', {
     headers: {
       Authorization: `Bearer ${session.access_token}`
     }
   });
   ```

3. **Edge function receives request:**
   - Extracts JWT token from `Authorization` header
   - Validates token and gets user ID
   - Gets user profile from database
   - Generates OTP code
   - Stores OTP in database
   - Calls `send-template-email` function
   - Returns success/error response

4. **Frontend handles response:**
   - Checks for errors
   - Shows success/error message
   - Updates UI state

---

## Testing the Function

### Step 1: Check Browser Console

When you click "Send Verification Code", check the browser console for:

```
[EMAIL-VERIFY] Sending OTP request...
[EMAIL-VERIFY] Response received: { hasError: false, hasData: true, data: {...} }
[EMAIL-VERIFY] OTP sent successfully
```

### Step 2: Check Supabase Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → `send-verification-otp`
2. Click **Logs** tab
3. Look for recent executions

**Expected logs:**
```
🔐 [abc12345] ========================================
🔐 [abc12345] Send verification OTP request started
🔐 [abc12345] Method: POST
🔐 [abc12345] Has Auth Header: true
✅ [abc12345] User authenticated via JWT: user-id-here
📧 [abc12345] Processing OTP request for user: user-id-here
✅ [abc12345] Rate limit check passed: 0/3 OTPs
🔢 [abc12345] Generated OTP (expires in 15 mins)
💾 [abc12345] OTP stored in database: otp-id-here
📧 [abc12345] Sending OTP email to: user@example.com
✅ [abc12345] Verification email sent successfully to user@example.com
✅ [abc12345] Email ID: resend-email-id-here
🔐 [abc12345] ========================================
```

### Step 3: Check for Errors

**Common errors to look for:**

1. **Authentication Error:**
   ```
   ❌ [abc12345] Auth error: JWT expired
   ```
   - **Fix:** User needs to log in again

2. **Template Not Found:**
   ```
   ❌ [abc12345] Email send failed: Email template 'email_verification_otp' not found or inactive
   ```
   - **Fix:** Create email template in Admin → Email Templates

3. **Resend API Key Missing:**
   ```
   ❌ [abc12345] Email send failed: Email service not configured
   ```
   - **Fix:** Add `RESEND_API_KEY` to Supabase secrets

4. **Rate Limit:**
   ```
   ⚠️ [abc12345] Rate limit exceeded: 3 OTPs in 15 mins
   ```
   - **Fix:** Wait 15 minutes or clear old OTPs from database

---

## Debugging Checklist

If emails aren't being sent, check:

- [ ] **Browser Console:** Check for `[EMAIL-VERIFY]` logs
- [ ] **Edge Function Logs:** Check `send-verification-otp` logs in Supabase
- [ ] **Authentication:** Verify JWT token is valid
- [ ] **Email Template:** Check if `email_verification_otp` template exists
- [ ] **Resend API Key:** Verify `RESEND_API_KEY` is set
- [ ] **Email Logs:** Check `email_logs` table for recent attempts
- [ ] **OTP Table:** Check `email_verification_otps` table for generated codes
- [ ] **Rate Limiting:** Check if user hit rate limit (3 per 15 minutes)

---

## SQL Queries for Debugging

### Check if OTPs are being created:
```sql
SELECT 
  id,
  user_id,
  email,
  otp_code,
  created_at,
  expires_at,
  used_at
FROM email_verification_otps
ORDER BY created_at DESC
LIMIT 5;
```

### Check email sending attempts:
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

### Check user profile:
```sql
SELECT 
  id,
  email,
  username,
  email_verified,
  email_verified_at
FROM profiles
WHERE id = 'USER_ID_HERE';
```

---

## Next Steps

1. **Deploy the updated function:**
   ```bash
   supabase functions deploy send-verification-otp
   ```

2. **Test the function:**
   - Click "Send Verification Code" button
   - Check browser console for logs
   - Check Supabase edge function logs
   - Verify email is received (check spam folder)

3. **If still not working:**
   - Follow the troubleshooting guide: `EMAIL_VERIFICATION_TROUBLESHOOTING.md`
   - Check all items in the debugging checklist above
   - Review edge function logs for specific error messages

---

## Function Configuration

The function is configured in `supabase/config.toml`:

```toml
[functions.send-verification-otp]
verify_jwt = true
```

This means:
- ✅ JWT verification is enabled
- ✅ Function requires valid authentication token
- ✅ Token is automatically validated by Supabase

---

## Related Files

- **Edge Function:** `supabase/functions/send-verification-otp/index.ts`
- **Frontend Component:** `src/components/dashboard/EmailVerificationDialog.tsx`
- **Email Template Function:** `supabase/functions/send-template-email/index.ts`
- **Troubleshooting Guide:** `docs/EMAIL_VERIFICATION_TROUBLESHOOTING.md`



