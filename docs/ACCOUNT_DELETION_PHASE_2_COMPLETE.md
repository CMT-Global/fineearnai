# Phase 2: Account Deletion Email Template - COMPLETE ✅

## Overview
Added "Account Deletion OTP" template type to the Email Templates system in Admin Panel, enabling admins to create and customize the email sent when users request account deletion.

## Changes Made

### 1. Updated `src/pages/admin/EmailTemplates.tsx`
- Added new template type `account_deletion_otp` to `TEMPLATE_TYPES` array
- Configured available variables: `username`, `otp_code`, `expiry_minutes`
- Added sample data for preview functionality

### 2. Template Type Configuration
```javascript
{
  value: "account_deletion_otp",
  label: "Account Deletion OTP",
  description: "OTP code sent when user requests to delete their account",
  variables: ["username", "otp_code", "expiry_minutes"]
}
```

## How to Create the Template

### Step 1: Navigate to Admin Panel
1. Login as admin
2. Go to Admin Panel → Email Templates
3. Click "Add Template"

### Step 2: Configure Template
Fill in the following fields:

**Template Name:** Account Deletion OTP

**Template Type:** Select "Account Deletion OTP"

**Subject:** Confirm Your Account Deletion

**Available Variables:**
- `{{username}}` - User's username
- `{{otp_code}}` - 6-digit OTP code
- `{{expiry_minutes}}` - Minutes until OTP expires (15)

### Step 3: Recommended Email Body

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
    ⚠️ Account Deletion Request
  </h1>
  
  <p>Hi {{username}},</p>
  
  <p>We received a request to permanently delete your account. This action <strong>cannot be undone</strong>.</p>
  
  <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
    <h3 style="color: #dc2626; margin-top: 0;">⚠️ Warning: Irreversible Action</h3>
    <p style="margin-bottom: 0;">Once deleted, the following will be permanently removed:</p>
    <ul style="margin: 10px 0;">
      <li>Your profile and account data</li>
      <li>All earnings and transaction history</li>
      <li>Referral data and commissions</li>
      <li>Task completion records</li>
      <li>Any pending withdrawals or deposits</li>
    </ul>
  </div>
  
  <p>If you're sure you want to proceed, enter this verification code:</p>
  
  <div style="background-color: #f3f4f6; border: 2px dashed #9ca3af; padding: 20px; text-align: center; margin: 20px 0;">
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Your One-Time Password</p>
    <h2 style="color: #111827; font-size: 36px; letter-spacing: 8px; margin: 10px 0; font-family: 'Courier New', monospace;">
      {{otp_code}}
    </h2>
    <p style="margin: 0; color: #6b7280; font-size: 12px;">Valid for {{expiry_minutes}} minutes</p>
  </div>
  
  <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Didn't request this?</strong></p>
    <p style="margin: 5px 0 0 0;">If you didn't request account deletion, please ignore this email and <strong>change your password immediately</strong> to secure your account.</p>
  </div>
  
  <p style="color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
    This is an automated security email. Please do not reply to this message.
  </p>
</div>
```

### Step 4: Save and Activate
1. Set "Active" to ON
2. Click "Save Template"

## Testing the Template

### Option 1: Send Test Email
1. Find the template in the list
2. Click the email icon (✉️) to send test
3. Enter your email address
4. Verify the email renders correctly

### Option 2: Preview in Browser
1. Click the eye icon (👁️) to preview
2. Toggle between Desktop/Mobile views
3. Check sample data population

## Integration Status

✅ Database table `account_deletion_otps` created (Phase 1)
✅ Edge function `send-account-deletion-otp` deployed (Phase 1)
✅ Edge function `verify-deletion-otp-and-delete` deployed (Phase 1)
✅ Email template type added to Admin Panel (Phase 2)

## Next Steps (Phase 3-4)

1. Create `DeleteAccountDialog.tsx` component
2. Add "Danger Zone" section to Settings page
3. Integrate OTP flow with edge functions
4. Implement auto-logout after deletion

## Security Features

- **OTP Expiry**: 15 minutes
- **Rate Limiting**: 3 OTPs per 15 minutes
- **Max Attempts**: 3 verification attempts per OTP
- **IP Tracking**: All OTP requests logged with IP address
- **Audit Trail**: Deletion events logged before account removal

## Variables Available for Customization

| Variable | Description | Sample Value |
|----------|-------------|--------------|
| `{{username}}` | User's username | JohnDoe |
| `{{otp_code}}` | 6-digit OTP | 123456 |
| `{{expiry_minutes}}` | Minutes until expiry | 15 |

## Edge Function Integration

The template will be automatically invoked by the `send-account-deletion-otp` edge function:

```typescript
await supabase.functions.invoke('send-template-email', {
  body: {
    to: userEmail,
    template_type: 'account_deletion_otp',
    variables: {
      username: profile.username,
      otp_code: otpCode,
      expiry_minutes: '15'
    }
  }
});
```

---

**Phase 2 Status**: ✅ COMPLETE - Ready for admin to create template via UI
**System Status**: Backend ready, email template configured, awaiting frontend implementation
