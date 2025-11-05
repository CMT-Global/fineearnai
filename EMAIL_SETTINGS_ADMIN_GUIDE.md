# Email Settings - Administrator Guide

## Overview
The Email Settings system allows platform administrators to configure how all platform emails appear to users, including sender information, branding, and reply-to addresses.

---

## Accessing Email Settings

1. Log in as an administrator
2. Navigate to **Communications** → **Email Settings**
3. You'll see three tabs:
   - **General Settings**: Configure sender information
   - **Branding**: Customize email appearance
   - **SMTP**: (Coming soon) Custom SMTP configuration

---

## General Settings

### From Email Address
**What it does:** This is the email address that appears in the "From" field of all platform emails.

**Requirements:**
- Must be a valid email address
- Domain must be verified in Resend (https://resend.com/domains)
- Common formats: `noreply@yourdomain.com`, `support@yourdomain.com`

**Example:**
```
From Email: support@fineearn.com
```

### From Name
**What it does:** The friendly name that appears alongside the email address.

**Best Practices:**
- Keep it short and recognizable
- Use your platform/company name
- Avoid special characters

**Example:**
```
From Name: FineEarn Platform
```

**Result in inbox:**
```
From: FineEarn Platform <support@fineearn.com>
```

### Reply-To Email Address (Optional)
**What it does:** When users click "Reply" to your emails, this is where their response goes.

**When to use:**
- Different from From Address (e.g., support@ instead of noreply@)
- You want replies to go to a monitored inbox
- You want to separate sending from receiving

**Example:**
```
From Email: noreply@fineearn.com
Reply-To Email: support@fineearn.com
```

### Reply-To Name (Optional)
**What it does:** The friendly name for the reply-to address.

**Example:**
```
Reply-To Name: FineEarn Support Team
```

---

## Branding Settings

### Platform Name
**What it does:** Appears in email headers, footers, and content.

**Used in:**
- Email subject lines (some templates)
- Email headers
- Footer text
- Welcome messages

**Example:**
```
Platform Name: FineEarn
```

### Platform Logo URL
**What it does:** Displays your logo in email headers.

**Requirements:**
- Must be a publicly accessible URL
- Recommended size: 200x50 pixels
- Formats: PNG, JPG, SVG
- HTTPS required

**Example:**
```
https://yourdomain.com/images/logo.png
```

### Primary Brand Color
**What it does:** Colors buttons, links, and accents in emails.

**Format:** Hex color code

**Examples:**
- `#4F46E5` - Indigo (default)
- `#10B981` - Green
- `#EF4444` - Red
- `#F59E0B` - Amber

**Preview:** Use the email preview section to see your color in action.

### Platform Website URL
**What it does:** Used in "Visit Website" buttons and footer links.

**Example:**
```
https://fineearn.com
```

### Support Email
**What it does:** Displayed in email footers for users to contact support.

**Example:**
```
support@fineearn.com
```

### Footer Text
**What it does:** Custom text displayed at the bottom of all emails.

**Best Practices:**
- Include legal information (if required)
- Add company address
- Include unsubscribe information (if applicable)

**Example:**
```
© 2025 FineEarn. All rights reserved.
123 Business Street, City, Country
```

---

## How to Update Settings

### Step 1: Review Current Settings
1. Navigate to Email Settings page
2. Review current configuration
3. Note any changes needed

### Step 2: Make Changes
1. Update desired fields
2. Use the email preview to check appearance
3. Verify all email addresses are valid

### Step 3: Save Changes
1. Click **"Save Changes"** button
2. Wait for success confirmation
3. Settings are now active

### Step 4: Test Your Changes
1. Click **"Send Test Email"** button
2. Enter your email address
3. Check inbox for test email
4. Verify:
   - From address is correct
   - Branding looks good
   - Links work
   - Colors are correct

---

## Important Notes

### Cache Behavior
- Settings are cached for 60 seconds for performance
- After updating settings, it may take up to 60 seconds for all emails to use new settings
- Test emails sent immediately after updating may use old settings
- Wait 1 minute after updating before sending important emails

### Domain Verification
**CRITICAL:** Your "From Email Address" domain must be verified in Resend.

**How to verify:**
1. Go to https://resend.com/domains
2. Add your domain
3. Add DNS records to your domain
4. Wait for verification (usually 5-15 minutes)

**Common domains:**
- `gmail.com` - NOT ALLOWED (use your own domain)
- `yourdomain.com` - ✅ Allowed after verification

### Email Types Affected
These settings apply to ALL platform emails:
- ✅ Welcome emails (new user registration)
- ✅ Password reset emails
- ✅ Email verification
- ✅ Bulk announcements
- ✅ Scheduled emails
- ✅ Notification emails

---

## Testing Your Configuration

### Send a Test Email
1. Configure your settings
2. Save changes
3. Click **"Send Test Email"**
4. Enter your email address
5. Click **"Send"**
6. Check inbox within 1-2 minutes

### What to Check
- ✅ Email arrived
- ✅ From address is correct
- ✅ From name displays properly
- ✅ Subject line is clear
- ✅ Logo displays (if configured)
- ✅ Colors match your brand
- ✅ Links work
- ✅ Footer text is correct
- ✅ Reply-To address is correct (check email headers)

### Check Email Headers (Advanced)
To verify Reply-To address:
1. Open test email
2. View email headers/source
3. Look for `Reply-To:` header
4. Verify it matches your configuration

---

## Resetting to Defaults

### When to Reset
- You've made changes and want to start over
- Settings are causing email delivery issues
- You want to restore original configuration

### How to Reset
1. Click **"Reset to Defaults"** button
2. Confirm the action
3. Default settings will be restored:
   - From Email: `onboarding@resend.dev`
   - From Name: `FineEarn Platform`
   - Primary Color: `#4F46E5`
   - Other defaults applied

**WARNING:** This action cannot be undone. Save current settings elsewhere if needed.

---

## Troubleshooting

### Emails Not Sending
**Possible Causes:**
1. Domain not verified in Resend
2. Invalid email address format
3. Resend API key not configured
4. Email quota exceeded

**Solutions:**
1. Verify domain at https://resend.com/domains
2. Check email address format
3. Contact platform administrator about API key
4. Check Resend dashboard for quota

### Settings Not Updating
**Possible Causes:**
1. Cache hasn't expired yet (60 seconds)
2. Browser cache
3. Changes not saved properly

**Solutions:**
1. Wait 60 seconds after saving
2. Hard refresh browser (Ctrl+Shift+R)
3. Re-save settings
4. Check browser console for errors

### Wrong Sender Address in Emails
**Possible Causes:**
1. Settings cached (60-second TTL)
2. Old settings still active
3. Different edge function using old code

**Solutions:**
1. Wait 60 seconds after updating
2. Send another test email
3. Check edge function logs
4. Contact developer if issue persists

### Branding Not Appearing
**Possible Causes:**
1. Logo URL not publicly accessible
2. Invalid color format
3. Email client blocking images

**Solutions:**
1. Test logo URL in browser
2. Ensure HTTPS for logo
3. Use hex format for colors (#RRGGBB)
4. Test in different email clients

---

## Best Practices

### Email Deliverability
1. **Use verified domain**: Never use `@gmail.com` or other public domains
2. **Professional sender name**: Avoid "noreply" if possible
3. **Monitor bounce rates**: Check Resend dashboard regularly
4. **Consistent branding**: Don't change settings too frequently

### Branding Consistency
1. **Match website colors**: Use same primary color as website
2. **Professional logo**: High quality, appropriate size
3. **Clear footer**: Include all required legal information
4. **Test across clients**: Gmail, Outlook, Apple Mail, etc.

### Security
1. **Don't share API keys**: Keep Resend API key secure
2. **Limit admin access**: Only trusted admins should modify settings
3. **Monitor changes**: Review audit logs regularly
4. **Test before bulk sending**: Always test after changes

---

## Advanced Configuration

### Custom Reply-To Strategy
**Scenario 1: Support Inbox**
```
From Email: noreply@yourdomain.com
Reply-To Email: support@yourdomain.com
```
✅ Users can reply, support team receives responses

**Scenario 2: Department-Specific**
```
From Email: notifications@yourdomain.com
Reply-To Email: billing@yourdomain.com (for billing emails)
```
✅ Route responses to appropriate department

**Scenario 3: No Replies Needed**
```
From Email: noreply@yourdomain.com
Reply-To Email: [leave empty]
```
✅ Discourages replies to transactional emails

### Branding for Different Email Types
While you can't configure different branding per email type (all emails use the same settings), you can:
1. Choose neutral branding that works for all types
2. Use platform name that covers all use cases
3. Select colors that match your overall brand

---

## Monitoring & Maintenance

### Weekly Checks
- ✅ Review email delivery rates in Resend dashboard
- ✅ Check for bounce notifications
- ✅ Verify domain verification is still active
- ✅ Test send sample email

### Monthly Review
- ✅ Review email logs for errors
- ✅ Update branding if company branding changes
- ✅ Check footer information is current
- ✅ Verify all links still work

### After Major Changes
- ✅ Update logo URL if website redesign
- ✅ Update colors if rebrand
- ✅ Update footer if legal changes
- ✅ Update support email if team changes

---

## Getting Help

### For Email Settings Issues
1. Check this guide first
2. Review testing guide (EMAIL_SETTINGS_TESTING_GUIDE.md)
3. Check edge function logs in Lovable Cloud
4. Contact development team

### For Resend Issues
1. Visit Resend dashboard: https://resend.com
2. Check domain verification status
3. Review email logs in Resend
4. Contact Resend support if needed

### For General Questions
- Email settings apply to all platform emails
- Changes take up to 60 seconds to propagate
- Always test before bulk sending
- Keep domain verification active

---

## Quick Reference

### Default Settings
```json
{
  "from_address": "onboarding@resend.dev",
  "from_name": "FineEarn Platform",
  "reply_to_address": "",
  "reply_to_name": "",
  "platform_name": "FineEarn",
  "platform_logo_url": "",
  "primary_color": "#4F46E5",
  "platform_url": "https://fineearn.com",
  "support_email": "support@fineearn.com",
  "footer_text": "© 2025 FineEarn. All rights reserved."
}
```

### Required Fields
- ✅ From Email Address
- ✅ From Name
- ✅ Platform Name
- ✅ Primary Color

### Optional Fields
- Reply-To Email Address
- Reply-To Name
- Platform Logo URL
- Platform Website URL
- Support Email
- Footer Text

---

*Last Updated: Auto-generated*
*Version: 1.0*
