# Email Templates Management - Testing Guide (Phase 2.3)

## Overview
This guide provides step-by-step testing procedures for the Email Templates Management system integrated with Supabase Auth Hook.

---

## Prerequisites
✅ Supabase Auth Hook configured in `supabase/config.toml`  
✅ `HOOK_SECRET` added to Supabase secrets  
✅ `RESEND_API_KEY` added to Supabase secrets  
✅ Default email templates inserted into database  
✅ Email Templates page accessible at `/admin/communications/templates`

---

## Test Suite 1: Email Templates UI Access

### Test 1.1: Navigation to Email Templates
**Steps:**
1. Log in as admin user
2. Navigate to Admin Panel
3. Click on "Communications" category
4. Click on "Email Templates"

**Expected Result:**
- ✅ Email Templates page loads successfully
- ✅ Page displays "Email Template Management" header
- ✅ Table shows existing templates
- ✅ "Add Template" button is visible

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 2: View Default Templates

### Test 2.1: Verify Default Templates Loaded
**Steps:**
1. On Email Templates page, review the templates list

**Expected Result:**
- ✅ Should see 4 default templates:
  - `default_password_reset` (Password Reset)
  - `default_email_confirmation` (Email Confirmation)
  - `default_magic_link` (Magic Link Login)
  - `default_email_change` (Email Change Confirmation)
- ✅ All templates show "Active" status with green badge
- ✅ Template types are displayed correctly
- ✅ Variables badges are visible for each template

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 3: Template Preview Functionality

### Test 3.1: Preview Password Reset Template
**Steps:**
1. Find "default_password_reset" template
2. Click the eye icon (Preview button)

**Expected Result:**
- ✅ Preview dialog opens
- ✅ Shows template name and subject
- ✅ Displays formatted HTML content
- ✅ Shows all variables: `{{username}}`, `{{email}}`, `{{reset_link}}`, `{{token_hash}}`, `{{redirect_to}}`
- ✅ HTML renders with proper styling (gradient header, button, etc.)

**Status:** [ ] Pass [ ] Fail

### Test 3.2: Preview Email Confirmation Template
**Steps:**
1. Find "default_email_confirmation" template
2. Click the eye icon (Preview button)

**Expected Result:**
- ✅ Preview shows welcome message with green gradient
- ✅ "Confirm Email Address" button is visible
- ✅ Variables displayed correctly
- ✅ Close button works

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 4: Create New Template

### Test 4.1: Create Custom Auth Template
**Steps:**
1. Click "Add Template" button
2. Fill in the form:
   - **Template Name:** `test_password_reset`
   - **Template Type:** Select "Password Reset" from dropdown
3. Observe auto-population of variables

**Expected Result:**
- ✅ Dialog opens with empty form
- ✅ Template Type dropdown shows all 5 options:
  - Password Reset
  - Email Confirmation
  - Magic Link Login
  - Email Change Confirmation
  - Custom Template
- ✅ When "Password Reset" is selected:
  - Variables field auto-fills with `["username", "email", "reset_link", "token_hash", "redirect_to"]`
  - Alert box appears showing template description
  - Available variables are displayed as badges

**Status:** [ ] Pass [ ] Fail

### Test 4.2: Complete Template Creation
**Steps:**
1. Continue filling the form:
   - **Subject:** `Test Reset - {{username}}`
   - **Body:** Use Rich Text Editor to create content:
     ```
     Hi {{username}},
     
     Click here to reset your password: {{reset_link}}
     
     This link expires in 1 hour.
     ```
   - **Active:** Keep switch ON
2. Click "Create Template"

**Expected Result:**
- ✅ Rich text editor loads with formatting toolbar
- ✅ Can type and format text (bold, italic, headings, lists)
- ✅ Variables can be inserted as `{{variable}}`
- ✅ Character count updates in real-time
- ✅ Success toast: "Template created successfully"
- ✅ Dialog closes
- ✅ New template appears in the table

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 5: Rich Text Editor Features

### Test 5.1: Text Formatting
**Steps:**
1. Click "Add Template"
2. In the Body field (Rich Text Editor), test:
   - **Bold:** Select text, click Bold (B) button
   - **Italic:** Select text, click Italic (I) button
   - **Underline:** Select text, click Underline (U) button
   - **Strikethrough:** Select text, click Strikethrough button

**Expected Result:**
- ✅ Selected text formats correctly
- ✅ Format buttons highlight when active
- ✅ Multiple formats can be combined
- ✅ HTML output includes proper tags

**Status:** [ ] Pass [ ] Fail

### Test 5.2: Headings and Lists
**Steps:**
1. In Rich Text Editor:
   - Type text and click H1, H2, H3 buttons
   - Create bullet list
   - Create numbered list

**Expected Result:**
- ✅ Headings apply different sizes
- ✅ Bullet list creates unordered list
- ✅ Numbered list creates ordered list
- ✅ Pressing Enter continues the list

**Status:** [ ] Pass [ ] Fail

### Test 5.3: Links and Alignment
**Steps:**
1. Select text and click Link button
2. Enter URL in prompt: `https://example.com`
3. Test text alignment: Left, Center, Right

**Expected Result:**
- ✅ Link prompt appears
- ✅ Text becomes clickable link
- ✅ Unlink button activates
- ✅ Text aligns correctly
- ✅ HTML output contains proper alignment

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 6: Edit Template

### Test 6.1: Edit Existing Template
**Steps:**
1. Find "test_password_reset" template
2. Click Edit (pencil) icon
3. Modify:
   - **Subject:** Change to `Updated Test Reset - {{username}}`
   - **Body:** Add more content using Rich Text Editor
4. Click "Update Template"

**Expected Result:**
- ✅ Dialog opens with pre-filled data
- ✅ All fields show current values
- ✅ Rich Text Editor loads existing HTML content
- ✅ Variables field is editable
- ✅ Success toast: "Template updated successfully"
- ✅ Table shows updated values

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 7: Template Activation/Deactivation

### Test 7.1: Deactivate Template
**Steps:**
1. Find "test_password_reset" template
2. Toggle the Active switch to OFF

**Expected Result:**
- ✅ Switch animates to OFF position
- ✅ Badge changes from "Active" (green) to "Inactive" (gray)
- ✅ Success toast: "Template deactivated"
- ✅ Database updates `is_active` to false

**Status:** [ ] Pass [ ] Fail

### Test 7.2: Reactivate Template
**Steps:**
1. Toggle the same switch back to ON

**Expected Result:**
- ✅ Switch animates to ON position
- ✅ Badge changes back to "Active" (green)
- ✅ Success toast: "Template activated"
- ✅ Database updates `is_active` to true

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 8: Delete Template

### Test 8.1: Delete Custom Template
**Steps:**
1. Find "test_password_reset" template
2. Click Delete (trash) icon
3. Confirm deletion in browser prompt

**Expected Result:**
- ✅ Browser confirmation dialog appears
- ✅ If confirmed: Success toast "Template deleted"
- ✅ Template removed from table
- ✅ If cancelled: No action taken

**Status:** [ ] Pass [ ] Fail

### Test 8.2: Prevent Accidental Deletion
**Steps:**
1. Try to delete one of the default templates
2. Click Cancel in confirmation dialog

**Expected Result:**
- ✅ Confirmation prompt appears
- ✅ Template remains in list
- ✅ No error messages

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 9: Variables Handling

### Test 9.1: Auto-populate Variables for Auth Templates
**Steps:**
1. Click "Add Template"
2. Select each auth template type and observe variables:
   - Password Reset
   - Email Confirmation
   - Magic Link Login
   - Email Change Confirmation

**Expected Result:**
- ✅ Each template type shows different variables
- ✅ Variables field auto-fills as JSON array
- ✅ Variables are displayed as badges in alert box
- ✅ Custom Template type has empty variables

**Status:** [ ] Pass [ ] Fail

### Test 9.2: Custom Variables
**Steps:**
1. Click "Add Template"
2. Select "Custom Template"
3. Manually add variables: `["custom_var1", "custom_var2"]`
4. Create template

**Expected Result:**
- ✅ Variables field accepts JSON array format
- ✅ Invalid JSON shows error message
- ✅ Valid JSON is accepted
- ✅ Custom variables save correctly

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 10: Validation & Error Handling

### Test 10.1: Required Fields Validation
**Steps:**
1. Click "Add Template"
2. Try to submit with empty fields

**Expected Result:**
- ✅ Error toast: "Please fill in all required fields"
- ✅ Form does not submit
- ✅ Required fields marked with asterisk (*)

**Status:** [ ] Pass [ ] Fail

### Test 10.2: Invalid JSON Validation
**Steps:**
1. Click "Add Template"
2. In Variables field, enter invalid JSON: `["test", "broken]`
3. Try to submit

**Expected Result:**
- ✅ Error toast: "Invalid JSON format for variables"
- ✅ Form does not submit
- ✅ Hint text shows correct JSON format

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 11: Responsive Design

### Test 11.1: Mobile View
**Steps:**
1. Open browser DevTools
2. Switch to mobile view (iPhone/Android)
3. Navigate through Email Templates page

**Expected Result:**
- ✅ Table scrolls horizontally if needed
- ✅ Action buttons remain accessible
- ✅ Dialog forms are usable on mobile
- ✅ Rich Text Editor toolbar scrolls horizontally
- ✅ All buttons have proper touch targets (40px minimum)

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 12: Integration with Auth Hook

### Test 12.1: Verify Auth Hook Configuration
**Steps:**
1. Check `supabase/config.toml` file
2. Verify auth hook section exists

**Expected Result:**
```toml
[auth.hook.send_email]
enabled = true
uri = "https://mobikymhzchzakwzpqep.supabase.co/functions/v1/send-auth-email"
secrets = ["HOOK_SECRET"]
```
- ✅ Hook is enabled
- ✅ URI points to send-auth-email function
- ✅ Secrets include HOOK_SECRET

**Status:** [ ] Pass [ ] Fail

### Test 12.2: Test Password Reset Email (End-to-End)
**Steps:**
1. Log out from admin
2. On login page, click "Forgot Password"
3. Enter your email address
4. Check your email inbox

**Expected Result:**
- ✅ Email received within 1-2 minutes
- ✅ Email uses "default_password_reset" template
- ✅ Subject line includes username
- ✅ Email body shows gradient header
- ✅ Reset link button is present and clickable
- ✅ Variables are properly replaced (no `{{username}}` visible)
- ✅ Email is well-formatted and professional

**Status:** [ ] Pass [ ] Fail

### Test 12.3: Test Email Confirmation (New User Signup)
**Steps:**
1. Create a new user account (use test email)
2. Check email inbox

**Expected Result:**
- ✅ Confirmation email received
- ✅ Uses "default_email_confirmation" template
- ✅ Green gradient design
- ✅ "Confirm Email Address" button works
- ✅ Welcome message is personalized

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 13: Database Verification

### Test 13.1: Check Database Records
**Steps:**
1. Access Lovable Cloud backend
2. Navigate to Tables → email_templates
3. Review stored templates

**Expected Result:**
- ✅ All default templates exist
- ✅ `is_active` field is boolean
- ✅ `variables` field is JSONB array
- ✅ `body` field contains HTML
- ✅ `created_at` and `updated_at` timestamps are correct

**Status:** [ ] Pass [ ] Fail

---

## Test Suite 14: Edge Function Testing

### Test 14.1: Verify send-auth-email Function
**Steps:**
1. Access backend
2. Navigate to Edge Functions
3. Check `send-auth-email` function deployment

**Expected Result:**
- ✅ Function is deployed
- ✅ No deployment errors
- ✅ Environment variables are set (HOOK_SECRET, RESEND_API_KEY)

**Status:** [ ] Pass [ ] Fail

---

## Known Issues & Troubleshooting

### Issue 1: Templates Not Loading
**Symptoms:** Empty table or loading spinner indefinitely  
**Check:**
- Admin privileges granted
- Database connection successful
- RLS policies allow admin SELECT

### Issue 2: Rich Text Editor Not Rendering
**Symptoms:** Plain textarea instead of rich editor  
**Check:**
- TipTap packages installed
- No console errors
- Browser compatibility

### Issue 3: Auth Emails Not Sending
**Symptoms:** No emails received after auth actions  
**Check:**
- Auth hook enabled in config.toml
- HOOK_SECRET matches in backend
- RESEND_API_KEY is valid
- Email domain verified in Resend
- Check edge function logs

### Issue 4: Variables Not Replacing
**Symptoms:** Email shows `{{username}}` instead of actual values  
**Check:**
- send-auth-email function uses correct variable mapping
- Template variables match auth hook payload
- No typos in variable names

---

## Testing Completion Checklist

### Core Functionality
- [ ] View all templates (Test 2.1)
- [ ] Preview templates (Test 3.1, 3.2)
- [ ] Create new template (Test 4.1, 4.2)
- [ ] Edit template (Test 6.1)
- [ ] Delete template (Test 8.1)
- [ ] Toggle activation (Test 7.1, 7.2)

### Rich Text Editor
- [ ] Text formatting (Test 5.1)
- [ ] Headings and lists (Test 5.2)
- [ ] Links and alignment (Test 5.3)

### Variables & Validation
- [ ] Auto-populate variables (Test 9.1)
- [ ] Custom variables (Test 9.2)
- [ ] Required field validation (Test 10.1)
- [ ] JSON validation (Test 10.2)

### Integration Testing
- [ ] Auth hook configured (Test 12.1)
- [ ] Password reset email works (Test 12.2)
- [ ] Confirmation email works (Test 12.3)
- [ ] Database records correct (Test 13.1)

### Responsive Design
- [ ] Mobile view tested (Test 11.1)

---

## Test Results Summary

**Date:** ___________  
**Tester:** ___________  
**Total Tests:** 24  
**Passed:** ___________  
**Failed:** ___________  

### Critical Issues Found:
1. _______________________________
2. _______________________________
3. _______________________________

### Minor Issues Found:
1. _______________________________
2. _______________________________

### Recommendations:
_______________________________________
_______________________________________

---

## Phase 2.3 Sign-Off

**Phase 2.3 Complete:** [ ] Yes [ ] No  
**Ready for Phase 3:** [ ] Yes [ ] No  
**Approved By:** ___________  
**Date:** ___________

---

## Next Steps (Phase 3)
After all tests pass and issues are resolved, proceed to:
- **Phase 3.1:** Create Bulk Email Campaign Manager
- **Phase 3.2:** Implement email scheduling
- **Phase 3.3:** Add email logs and tracking
