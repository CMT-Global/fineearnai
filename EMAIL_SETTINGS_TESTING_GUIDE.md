# Email Settings Testing Guide - Phase 5

## Overview
This guide provides comprehensive testing procedures for the Dynamic Email Settings system implemented across all email functions.

## Prerequisites
- Admin access to the platform
- Access to Resend dashboard (https://resend.com/emails)
- Access to edge function logs
- Test email addresses for receiving emails

---

## Test Suite 1: Admin UI - Email Settings Page

### Test 1.1: Access Email Settings
**Steps:**
1. Log in as admin
2. Navigate to Communications → Email Settings
3. Verify page loads without errors

**Expected Results:**
- Page displays three tabs: General Settings, Branding, SMTP
- All form fields are populated with current values
- Save, Reset, and Send Test Email buttons are visible

### Test 1.2: Update General Settings
**Steps:**
1. Navigate to General Settings tab
2. Update From Email Address to a verified domain email
3. Update From Name to "Test Platform"
4. Update Reply-To Email (optional)
5. Click "Save Changes"

**Expected Results:**
- Success toast: "Email settings saved successfully"
- Settings persist after page refresh
- Database record in `platform_config` table updated

### Test 1.3: Update Branding Settings
**Steps:**
1. Navigate to Branding tab
2. Update Primary Color to `#4F46E5`
3. Update Platform Name to "Test Platform"
4. Update Platform Logo URL to a valid image URL
5. Update Footer Text
6. Click "Save Changes"

**Expected Results:**
- Success toast confirms save
- Email preview updates to show new branding colors
- Settings persist after refresh

### Test 1.4: Validation Testing
**Steps:**
1. Clear From Email Address field
2. Try to save
3. Enter invalid email format (e.g., "notanemail")
4. Try to save
5. Enter valid email but from unverified domain
6. Try to save

**Expected Results:**
- Error toast: "From Email is required"
- Error toast: "Invalid email format"
- Warning about domain verification (if applicable)
- Form prevents submission with invalid data

### Test 1.5: Reset to Defaults
**Steps:**
1. Modify several settings
2. Click "Reset to Defaults"
3. Confirm reset action

**Expected Results:**
- Confirmation dialog appears
- All fields reset to default values
- Database record updated
- Success toast confirms reset

### Test 1.6: Send Test Email
**Steps:**
1. Configure valid email settings
2. Click "Send Test Email"
3. Enter your test email address
4. Submit

**Expected Results:**
- Loading state shows during send
- Success toast: "Test email sent successfully!"
- Email received at test address
- Email uses configured From address and branding

---

## Test Suite 2: Dynamic Settings - Edge Functions

### Test 2.1: Cache Behavior Verification
**Steps:**
1. Send an email (any type)
2. Check edge function logs for "Cache miss or expired, fetching from database"
3. Send another email within 60 seconds
4. Check logs for cached settings usage
5. Wait 61 seconds
6. Send another email
7. Check logs for cache miss

**Expected Results:**
- First email: `🔄 [Email Settings] Cache miss or expired, fetching from database...`
- Second email (within 60s): Uses cached settings (no database fetch log)
- Third email (after 60s): `🔄 [Email Settings] Cache miss or expired, fetching from database...`
- Settings cached successfully with 60-second TTL

### Test 2.2: Settings Propagation Test
**Steps:**
1. Note current From Name in Email Settings
2. Send a test email, verify it uses current From Name
3. Update From Name to "New Platform Name"
4. Save changes
5. Immediately send another test email
6. Check email headers (should use OLD cached name)
7. Wait 61 seconds
8. Send another test email
9. Check email headers (should use NEW name)

**Expected Results:**
- Email sent immediately after update uses old cached value
- Email sent after 60+ seconds uses new value
- Cache TTL working as designed

### Test 2.3: Fallback to Defaults
**Steps:**
1. Delete the `email_settings` record from `platform_config` table
2. Send a test email
3. Check edge function logs

**Expected Results:**
- Log shows: `⚠️ [Email Settings] No settings found in database, using defaults`
- Email still sends successfully
- Uses hardcoded default values
- No application errors

---

## Test Suite 3: Authentication Emails

### Test 3.1: Welcome Email on Registration
**Steps:**
1. Register a new user account
2. Check edge function logs for `send-auth-email`
3. Check email inbox

**Expected Results:**
- Welcome email received
- Uses configured From address
- Uses configured branding colors
- Reply-To address matches settings
- Template variables replaced correctly (username, platform name, etc.)

### Test 3.2: Password Reset Email
**Steps:**
1. Navigate to Forgot Password page
2. Request password reset
3. Check edge function logs
4. Check email inbox

**Expected Results:**
- Password reset email received
- Uses dynamic From address from settings
- Email contains reset link
- Branding matches configured settings

### Test 3.3: Verification Code Email
**Steps:**
1. Trigger email verification (if applicable)
2. Check edge function logs for settings loading
3. Check email inbox

**Expected Results:**
- Verification email received
- Dynamic settings applied
- Cache working (check logs for repeated sends)

---

## Test Suite 4: Bulk Email System

### Test 4.1: Send Bulk Email to All Users
**Steps:**
1. Navigate to Admin → Communications → Bulk Email
2. Create email with subject "Test Bulk Email"
3. Add body content with variables: `{{username}}`, `{{email}}`
4. Select "All Users" as recipients
5. Send email
6. Check edge function logs for `send-bulk-email`

**Expected Results:**
- Log shows settings fetched ONCE: `✅ [Email Settings] Settings loaded and cached successfully`
- NOT fetched per recipient
- All users receive email
- Variables replaced correctly per user
- From address matches configured settings

### Test 4.2: Send to Specific Plan Members
**Steps:**
1. Create bulk email
2. Filter by membership plan (e.g., "Premium")
3. Send email
4. Verify logs and recipient emails

**Expected Results:**
- Only users with selected plan receive email
- Settings loaded from cache efficiently
- Personalization works correctly

### Test 4.3: Send to Specific Countries
**Steps:**
1. Create bulk email
2. Filter by country (e.g., "United States")
3. Send email

**Expected Results:**
- Only users from selected country receive email
- Dynamic settings applied
- Email logs table updated correctly

---

## Test Suite 5: Scheduled Emails

### Test 5.1: Create Scheduled Email
**Steps:**
1. Navigate to Admin → Communications → Scheduled Emails
2. Create new scheduled email
3. Set schedule for 2 minutes from now
4. Save
5. Wait for scheduled time
6. Check `process-scheduled-emails` edge function logs

**Expected Results:**
- Scheduled email processes at correct time
- Log shows: `✅ [Email Settings] Settings loaded and cached successfully`
- Settings fetched once, not per recipient
- Recipients receive email with dynamic settings

### Test 5.2: Bulk Scheduled Email Performance
**Steps:**
1. Schedule email to 100+ users
2. Monitor edge function execution time
3. Check logs for settings fetch pattern

**Expected Results:**
- Settings fetched once at start
- Not refetched for each recipient
- Execution completes efficiently
- All emails sent with correct From address

---

## Test Suite 6: Email Templates System

### Test 6.1: Test Email from Template
**Steps:**
1. Navigate to Email Templates page
2. Select a template (e.g., "welcome_email")
3. Click "Send Test Email"
4. Enter test email address
5. Submit

**Expected Results:**
- Test email sent successfully
- Uses dynamic From address from settings
- Template variables replaced
- Branding applied correctly

### Test 6.2: Template with Custom Branding
**Steps:**
1. Update branding colors in Email Settings
2. Save changes
3. Wait 61 seconds (cache expiry)
4. Send test email from template
5. Check email rendering

**Expected Results:**
- Email reflects new branding colors
- Primary color applied to buttons/headers
- Platform name updated
- Logo displayed correctly (if configured)

---

## Test Suite 7: Error Handling & Edge Cases

### Test 7.1: Missing RESEND_API_KEY
**Steps:**
1. Remove RESEND_API_KEY from secrets (temporarily)
2. Try to send email
3. Check edge function logs

**Expected Results:**
- Clear error message in logs
- Function returns appropriate error response
- No application crash

### Test 7.2: Invalid Email Settings
**Steps:**
1. Manually insert invalid email in platform_config
2. Try to send email
3. Check logs and error handling

**Expected Results:**
- Resend API rejects invalid sender
- Error logged clearly
- Fallback behavior or clear error message

### Test 7.3: Database Connection Failure
**Steps:**
1. Simulate database unavailability during settings fetch
2. Check fallback behavior

**Expected Results:**
- Function falls back to hardcoded defaults
- Email still sends (degraded mode)
- Error logged but not fatal

---

## Test Suite 8: Performance & Optimization

### Test 8.1: Cache Hit Rate
**Steps:**
1. Send 10 emails within 60 seconds
2. Review edge function logs
3. Count database fetches vs cache hits

**Expected Results:**
- Settings fetched from database: 1 time
- Cache hits: 9 times
- Cache hit rate: 90%

### Test 8.2: Bulk Email Efficiency
**Steps:**
1. Send bulk email to 500 users
2. Monitor execution time
3. Check database query count

**Expected Results:**
- Settings fetched once
- Total execution time scales linearly with recipients
- No N+1 query problems

---

## Test Suite 9: Integration Tests

### Test 9.1: End-to-End User Journey
**Steps:**
1. Configure custom email settings in admin
2. Register new user
3. User receives welcome email
4. User requests password reset
5. User receives reset email
6. Admin sends bulk announcement
7. User receives announcement

**Expected Results:**
- All emails use configured settings
- Branding consistent across all emails
- Reply-To addresses correct
- No errors in any step

### Test 9.2: Multi-Admin Settings Update
**Steps:**
1. Admin A updates email settings
2. Wait 30 seconds
3. Admin B sends test email (gets cached settings)
4. Wait 31+ seconds
5. Admin B sends another test email (gets new settings)

**Expected Results:**
- Cache works correctly across different admin sessions
- Settings propagate after TTL expires
- No race conditions or conflicts

---

## Test Suite 10: Email Logs Verification

### Test 10.1: Verify Email Logging
**Steps:**
1. Send various types of emails
2. Navigate to Email Logs (if available in admin)
3. Verify all sends are logged

**Expected Results:**
- Each email send creates log entry
- Status correctly recorded (sent/failed)
- Metadata includes template info
- Timestamps accurate

### Test 10.2: Failed Email Logging
**Steps:**
1. Configure invalid From address
2. Try to send email
3. Check email_logs table

**Expected Results:**
- Failed send logged
- Error message captured
- Status = 'failed'

---

## Validation Checklist

### ✅ Core Functionality
- [ ] Email settings can be updated via Admin UI
- [ ] Settings persist in database
- [ ] All email functions use dynamic settings
- [ ] Cache reduces database queries
- [ ] Fallback to defaults works

### ✅ Email Types
- [ ] Auth emails (welcome, reset, verification)
- [ ] Bulk emails
- [ ] Scheduled emails
- [ ] Test emails
- [ ] Template-based emails

### ✅ Performance
- [ ] Cache TTL = 60 seconds working
- [ ] Settings fetched once per bulk operation
- [ ] No N+1 query issues
- [ ] Acceptable execution times

### ✅ Error Handling
- [ ] Invalid settings handled gracefully
- [ ] Missing API key produces clear error
- [ ] Database failures fall back to defaults
- [ ] Validation prevents bad data

### ✅ User Experience
- [ ] Admin UI intuitive and responsive
- [ ] Clear success/error messages
- [ ] Email preview shows branding
- [ ] Test email function works

---

## Known Issues & Limitations

### Current Limitations
1. **Cache Scope**: Cache is per-edge-function-instance, not global
2. **SMTP**: Not yet implemented (future feature)
3. **Email Templates**: Limited variable support in some templates

### Troubleshooting

#### Emails Not Sending
1. Check RESEND_API_KEY is configured
2. Verify sender domain is verified in Resend
3. Check edge function logs for errors
4. Verify email settings in platform_config

#### Settings Not Updating
1. Wait for cache expiry (60 seconds)
2. Check platform_config table for correct data
3. Verify JSON format is valid
4. Check admin permissions

#### Wrong Sender Address
1. Check current settings in Admin UI
2. Verify cache hasn't expired yet
3. Check edge function logs for settings fetch
4. Confirm Resend domain verification

---

## Success Criteria

### Phase 5 Complete When:
- ✅ All 10 test suites passed
- ✅ No critical bugs identified
- ✅ Performance benchmarks met
- ✅ Documentation complete
- ✅ Admin training completed (if applicable)
- ✅ Rollback plan documented

---

## Post-Implementation Monitoring

### Week 1 Monitoring
- Monitor edge function error rates
- Track email delivery rates
- Review admin feedback on UI
- Check cache hit rates

### Week 2-4 Monitoring
- Analyze email performance metrics
- Review email logs for patterns
- Optimize cache TTL if needed
- Address any user-reported issues

---

## Rollback Plan

### If Critical Issues Found:
1. Revert edge functions to previous versions
2. Restore hardcoded default email settings
3. Disable dynamic settings in platform_config
4. Investigate and fix issues
5. Retest before re-deployment

---

## Support Resources

### For Administrators
- Email Settings Guide: See admin panel help section
- Video tutorial: [Link to be added]
- Support contact: [To be configured]

### For Developers
- Edge function logs: Check Lovable Cloud → Functions
- Database access: Lovable Cloud → Database
- API documentation: Resend docs (https://resend.com/docs)

---

## Completion Sign-Off

**Phase 5 Testing Completed By:** _______________  
**Date:** _______________  
**Critical Issues Found:** _______________  
**Issues Resolved:** _______________  
**Approved for Production:** ☐ Yes ☐ No  

---

*Last Updated: [Auto-generated timestamp]*
*Version: 1.0*
