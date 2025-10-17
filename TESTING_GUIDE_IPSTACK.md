# IPStack Integration Testing Guide

## Quick Testing Checklist

Use this guide to verify the IPStack integration is working correctly across all components.

---

## 🧪 Test Scenarios

### 1. Registration Flow Testing

#### Test 1.1: Successful Registration
**Objective:** Verify location tracking during signup

**Steps:**
1. Navigate to `/signup`
2. Fill in registration form:
   - Username: `test_user_001`
   - Email: `test001@example.com`
   - Full Name: `Test User`
   - Password: `SecurePass123!`
3. Submit form
4. Wait for success message

**Expected Results:**
- ✅ Registration succeeds
- ✅ User redirected to dashboard
- ✅ No visible errors or delays

**Verification (Admin Panel):**
```sql
-- Check if registration data was captured
SELECT 
  username,
  email,
  registration_ip,
  registration_country,
  registration_country_name,
  created_at
FROM profiles
WHERE email = 'test001@example.com';
```

**Expected Database State:**
- `registration_ip`: Present (e.g., "203.0.113.45")
- `registration_country`: Present (e.g., "US")
- `registration_country_name`: Present (e.g., "United States")

**Edge Function Logs:**
```bash
# Check registration tracking logs
✅ [Registration Tracking] Started for user: [user_id]
✅ [Registration Tracking] Extracted IP: 203.0.113.45
✅ [Registration Tracking] Location found: United States (US)
✅ [Registration Tracking] Completed for [user_id] in [X]ms
```

---

#### Test 1.2: Registration with IPStack Failure
**Objective:** Verify graceful degradation when IPStack fails

**Setup:**
1. Temporarily set invalid IPSTACK_API_KEY
   OR
2. Simulate network timeout

**Steps:**
1. Attempt registration
2. Complete form and submit

**Expected Results:**
- ✅ Registration still succeeds (NOT blocked)
- ✅ User can log in
- ⚠️ Warning logged but registration proceeds

**Verification:**
```sql
SELECT registration_ip, registration_country
FROM profiles
WHERE email = 'test_ipstack_fail@example.com';
```

**Expected Database State:**
- `registration_ip`: May be present (if IP extraction succeeded)
- `registration_country`: NULL (IPStack failed)
- `registration_country_name`: NULL (IPStack failed)

**Edge Function Logs:**
```bash
⚠️ [Registration Tracking] IPStack lookup failed for [IP]
✅ [Registration Tracking] Registration logged with IP only
```

---

### 2. Login Flow Testing

#### Test 2.1: Successful Login
**Objective:** Verify location tracking during login

**Steps:**
1. Navigate to `/login`
2. Enter credentials for existing user
3. Submit form
4. Wait for dashboard to load

**Expected Results:**
- ✅ Login succeeds
- ✅ Dashboard loads normally
- ✅ No visible delays

**Verification (Admin Panel):**
```sql
SELECT 
  username,
  last_login_ip,
  last_login_country,
  last_login_country_name,
  last_login,
  last_activity
FROM profiles
WHERE username = 'test_user_001';
```

**Expected Database State:**
- `last_login_ip`: Updated to current IP
- `last_login_country`: Updated to current country code
- `last_login_country_name`: Updated to current country name
- `last_login`: Updated to current timestamp
- `last_activity`: Updated to current timestamp

**Edge Function Logs:**
```bash
✅ [Login Tracking] Started for user: [user_id]
✅ [Login Tracking] Extracted IP: 203.0.113.45
✅ [Login Tracking] Location found: United States (US)
✅ [Login Tracking] Completed for [user_id] in [X]ms
```

---

#### Test 2.2: Multiple Logins (Caching Test)
**Objective:** Verify IPStack caching works correctly

**Steps:**
1. Log out
2. Log in again immediately (within 1 hour)
3. Check response time

**Expected Results:**
- ✅ Login succeeds quickly (no IPStack delay)
- ✅ Location data still updated

**Verification:**
```sql
-- Check last_login timestamp is recent
SELECT 
  username,
  last_login,
  last_login_ip,
  last_login_country_name
FROM profiles
WHERE username = 'test_user_001';
```

**Edge Function Logs:**
```bash
✅ [Login Tracking] Using cached location data for IP: 203.0.113.45
✅ [Login Tracking] Completed in ~1ms (cached)
```

---

### 3. Admin Panel Testing

#### Test 3.1: View User Location Data
**Objective:** Verify location data displays in admin user detail

**Steps:**
1. Log in as admin
2. Navigate to `/admin/users`
3. Click on any user with location data
4. View "Overview" tab

**Expected Results:**
- ✅ "Location & Security" card visible
- ✅ Registration IP and country displayed
- ✅ Last login IP and country displayed
- ✅ Timestamps formatted correctly (e.g., "Oct 17, 2025, 2:15 PM")

**Visual Verification:**
```
Location & Security
├── Registration Details
│   ├── IP Address: 203.0.113.45
│   ├── Country: United States (US)
│   └── Registered On: Oct 17, 2025, 2:15 PM
└── Last Login Details
    ├── IP Address: 203.0.113.45
    ├── Country: United States (US)
    └── Last Login: Oct 17, 2025, 3:30 PM
```

---

#### Test 3.2: Security Settings Page
**Objective:** Verify security settings UI functionality

**Steps:**
1. Log in as admin
2. Navigate to `/admin/security-settings`
3. Test country blocking:
   - Add country code "CN"
   - Verify badge appears
   - Toggle enable/disable switch
   - Remove country code
4. Test IP blocking:
   - Add IP "192.168.1.1"
   - Verify badge appears
   - Toggle enable/disable switch
   - Remove IP address

**Expected Results:**
- ✅ Page loads without errors
- ✅ Country blocking UI functional
- ✅ IP blocking UI functional
- ✅ Validation works (2-char codes, IP format)
- ✅ Enable/disable toggles work
- ✅ Add/remove actions work
- ✅ Toast notifications show on actions

---

### 4. Performance Testing

#### Test 4.1: Registration Speed
**Objective:** Ensure registration isn't slowed by tracking

**Steps:**
1. Open browser developer tools
2. Go to Network tab
3. Start registration process
4. Measure total time to completion

**Expected Results:**
- ✅ Registration completes in <2 seconds
- ✅ `track-user-registration` call is non-blocking
- ✅ User doesn't wait for location lookup

**Network Tab Verification:**
```
POST /auth/v1/signup          [200 OK] - ~500ms
POST /functions/v1/track-user-registration [200 OK] - ~200-500ms (parallel)
```

---

#### Test 4.2: Login Speed
**Objective:** Ensure login isn't slowed by tracking

**Steps:**
1. Open browser developer tools
2. Go to Network tab
3. Start login process
4. Measure total time to completion

**Expected Results:**
- ✅ Login completes in <2 seconds
- ✅ `track-user-login` call is non-blocking
- ✅ User doesn't wait for location lookup

**Network Tab Verification:**
```
POST /auth/v1/token           [200 OK] - ~300ms
POST /functions/v1/track-user-login [200 OK] - ~200-500ms (parallel)
```

---

#### Test 4.3: Cache Performance
**Objective:** Verify caching improves performance

**Test Scenario:**
1. First login from new IP: ~200-500ms IPStack call
2. Second login from same IP (within 1 hour): ~1ms cached response

**Measurement:**
```bash
# Check edge function logs for timing
First call:  "IPStack API call completed in 347ms"
Second call: "Using cached location data (1ms)"
```

---

### 5. Error Handling Testing

#### Test 5.1: Invalid API Key
**Objective:** Verify graceful handling of API errors

**Setup:**
1. Temporarily set invalid IPSTACK_API_KEY in Supabase secrets
2. OR remove the secret entirely

**Steps:**
1. Attempt registration
2. Attempt login

**Expected Results:**
- ✅ Registration/login succeeds (not blocked)
- ⚠️ Location data not saved (NULL values)
- ✅ Errors logged in edge function logs

**Edge Function Logs:**
```bash
❌ [Login Tracking] IPStack API error: 401 Unauthorized
✅ [Login Tracking] Login logged without location data
```

---

#### Test 5.2: Network Timeout
**Objective:** Verify timeout handling (3 seconds)

**Setup:**
1. Simulate slow network or use network throttling

**Expected Results:**
- ✅ Request times out after 3 seconds
- ✅ Authentication still succeeds
- ⚠️ Partial data saved (IP only, no country)

---

#### Test 5.3: Invalid IP Address
**Objective:** Verify handling of private/invalid IPs

**Test IPs:**
- `127.0.0.1` (localhost)
- `192.168.1.1` (private)
- `10.0.0.1` (private)

**Expected Results:**
- ✅ IP validation catches private IPs
- ✅ No IPStack API call made (saves quota)
- ✅ Authentication proceeds normally

**Edge Function Logs:**
```bash
⚠️ [Login Tracking] Invalid or private IP: 192.168.1.1
✅ [Login Tracking] Login logged without location data
```

---

### 6. Database Integrity Testing

#### Test 6.1: User Activity Log
**Objective:** Verify activity logging works

**Query:**
```sql
SELECT 
  user_id,
  activity_type,
  ip_address,
  details,
  created_at
FROM user_activity_log
WHERE activity_type IN ('login', 'registration')
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results:**
- ✅ All logins logged
- ✅ All registrations logged
- ✅ IP addresses captured
- ✅ Location details in JSONB `details` field
- ✅ Timestamps accurate

**Sample Log Entry:**
```json
{
  "user_id": "uuid-here",
  "activity_type": "login",
  "ip_address": "203.0.113.45",
  "details": {
    "country_code": "US",
    "country_name": "United States",
    "region_name": "California",
    "city": "San Francisco",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "timestamp": "2025-10-17T14:30:00Z"
  },
  "created_at": "2025-10-17T14:30:01Z"
}
```

---

#### Test 6.2: Data Consistency
**Objective:** Ensure profile data stays consistent

**Query:**
```sql
-- Check for inconsistencies
SELECT 
  username,
  registration_ip,
  registration_country,
  last_login_ip,
  last_login_country,
  created_at,
  last_login
FROM profiles
WHERE 
  (registration_ip IS NOT NULL AND registration_country IS NULL)
  OR
  (last_login_ip IS NOT NULL AND last_login_country IS NULL);
```

**Expected Results:**
- ✅ No inconsistencies (IP with country, or both NULL)
- ⚠️ If found: Review edge function logs for those users

---

### 7. Security Testing

#### Test 7.1: RLS Policy Verification
**Objective:** Ensure users can't see other users' location data

**Steps:**
1. Log in as regular user (non-admin)
2. Try to query another user's profile via Supabase client
3. Verify access denied

**Test Query (from client):**
```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('registration_ip, last_login_ip')
  .neq('id', currentUserId);
```

**Expected Results:**
- ✅ Query returns empty array (RLS blocks access)
- ✅ User can only see their own profile data

---

#### Test 7.2: API Key Security
**Objective:** Ensure IPStack key never exposed

**Steps:**
1. Open browser developer tools
2. Check Network tab
3. Inspect all requests during login/signup

**Expected Results:**
- ✅ IPSTACK_API_KEY never appears in client-side code
- ✅ IPSTACK_API_KEY never appears in network requests
- ✅ All IPStack calls made server-side only

---

## 🎯 Automated Testing Script

### Quick Test Script (SQL)
```sql
-- Run this after a few test signups/logins to verify data

-- 1. Check recent registrations with location
SELECT 
  'Recent Registrations' as test,
  COUNT(*) as total,
  COUNT(registration_ip) as with_ip,
  COUNT(registration_country) as with_country
FROM profiles
WHERE created_at > now() - interval '1 hour';

-- 2. Check recent logins with location
SELECT 
  'Recent Logins' as test,
  COUNT(*) as total,
  COUNT(last_login_ip) as with_ip,
  COUNT(last_login_country) as with_country
FROM profiles
WHERE last_login > now() - interval '1 hour';

-- 3. Check activity log
SELECT 
  'Activity Logs' as test,
  activity_type,
  COUNT(*) as count,
  COUNT(ip_address) as with_ip
FROM user_activity_log
WHERE created_at > now() - interval '1 hour'
GROUP BY activity_type;

-- 4. Check for inconsistencies
SELECT 
  'Data Consistency' as test,
  COUNT(*) as inconsistent_records
FROM profiles
WHERE 
  (registration_ip IS NOT NULL AND registration_country IS NULL)
  OR
  (last_login_ip IS NOT NULL AND last_login_country IS NULL);
```

---

## 🐛 Debugging Checklist

If tests fail, check these items in order:

### 1. Edge Function Logs
```bash
# Registration tracking
supabase functions logs track-user-registration --tail

# Login tracking
supabase functions logs track-user-login --tail
```

### 2. Supabase Secrets
```bash
# Verify secret is set
supabase secrets list
```

### 3. Network Requests
- Check browser DevTools > Network tab
- Verify edge function calls return 200 OK
- Check response bodies for errors

### 4. Database State
```sql
-- Check if profiles table has location fields
\d profiles

-- Check if user_activity_log table exists
\d user_activity_log
```

### 5. IPStack API Status
- Log in to IPStack dashboard
- Check API usage
- Verify API key is valid
- Check rate limits

---

## ✅ Test Results Template

Use this template to document test results:

```
## IPStack Integration Test Results

**Date:** [Date]
**Tester:** [Name]
**Environment:** [Development/Production]

### Registration Flow
- [ ] Test 1.1: Successful Registration - PASS/FAIL
- [ ] Test 1.2: Registration with IPStack Failure - PASS/FAIL

### Login Flow
- [ ] Test 2.1: Successful Login - PASS/FAIL
- [ ] Test 2.2: Multiple Logins (Caching) - PASS/FAIL

### Admin Panel
- [ ] Test 3.1: View User Location Data - PASS/FAIL
- [ ] Test 3.2: Security Settings Page - PASS/FAIL

### Performance
- [ ] Test 4.1: Registration Speed (<2s) - PASS/FAIL
- [ ] Test 4.2: Login Speed (<2s) - PASS/FAIL
- [ ] Test 4.3: Cache Performance - PASS/FAIL

### Error Handling
- [ ] Test 5.1: Invalid API Key - PASS/FAIL
- [ ] Test 5.2: Network Timeout - PASS/FAIL
- [ ] Test 5.3: Invalid IP Address - PASS/FAIL

### Database Integrity
- [ ] Test 6.1: User Activity Log - PASS/FAIL
- [ ] Test 6.2: Data Consistency - PASS/FAIL

### Security
- [ ] Test 7.1: RLS Policy Verification - PASS/FAIL
- [ ] Test 7.2: API Key Security - PASS/FAIL

**Overall Result:** PASS/FAIL

**Notes:**
[Any additional observations or issues found]
```

---

## 📞 Support

If tests reveal issues:

1. **Check Edge Function Logs** - Most issues show up here
2. **Review Documentation** - See IPSTACK_INTEGRATION_COMPLETE.md
3. **Verify Configuration** - Double-check all secrets and config
4. **Test IPStack Directly** - Use curl to test API key independently

---

**Testing Guide Version:** 1.0.0  
**Last Updated:** October 2025
