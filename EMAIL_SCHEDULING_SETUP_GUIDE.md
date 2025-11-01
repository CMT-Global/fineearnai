# Email Scheduling System - Setup & Configuration Guide (Phase 3.2)

## Overview
The Email Scheduling System allows administrators to schedule bulk emails for future delivery. The system automatically processes scheduled emails at the designated times using a backend edge function.

---

## Architecture

### Components
1. **Scheduled Emails UI** (`/admin/communications/scheduled`)
   - View all scheduled emails
   - Monitor status (pending, sent, failed, cancelled)
   - Preview email content
   - Cancel or delete scheduled emails
   - Manually trigger processing for past-due emails

2. **process-scheduled-emails Edge Function**
   - Automatically executed at regular intervals (via cron)
   - Fetches pending emails that are due
   - Sends emails to recipients
   - Updates status and logs results
   - Processes up to 50 emails per execution

3. **Database Table: scheduled_emails**
   - Stores all scheduled email campaigns
   - Tracks status and execution history

---

## Setup Instructions

### Step 1: Verify Edge Function Deployment

The `process-scheduled-emails` edge function should be automatically deployed. Verify by:

1. Access your backend
2. Navigate to Edge Functions
3. Confirm `process-scheduled-emails` is listed and deployed
4. Check for any deployment errors

**Edge Function Configuration:**
```toml
[functions.process-scheduled-emails]
verify_jwt = false  # Allows cron/automated execution
```

---

### Step 2: Set Up Automated Execution (Cron Job)

The scheduled emails need to be processed automatically. There are two options:

#### Option A: Supabase Cron Jobs (Recommended)

1. Access your Supabase backend
2. Navigate to Database → Cron Jobs
3. Create a new cron job with the following SQL:

```sql
-- Create cron job to process scheduled emails every 5 minutes
SELECT cron.schedule(
  'process-scheduled-emails',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://mobikymhzchzakwzpqep.supabase.co/functions/v1/process-scheduled-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Cron Schedule Options:**
- `*/5 * * * *` - Every 5 minutes (recommended for production)
- `*/15 * * * *` - Every 15 minutes (moderate traffic)
- `0 * * * *` - Every hour (low priority)
- `*/1 * * * *` - Every minute (testing only, not recommended)

#### Option B: External Cron Service (Alternative)

If Supabase cron is not available, use an external service like:

**Using cron-job.org:**
1. Go to https://cron-job.org
2. Create a free account
3. Add new cron job:
   - **URL:** `https://mobikymhzchzakwzpqep.supabase.co/functions/v1/process-scheduled-emails`
   - **Method:** POST
   - **Schedule:** Every 5 minutes
   - **Headers:** `Content-Type: application/json`

**Using EasyCron:**
1. Go to https://www.easycron.com
2. Create account
3. Set up HTTP request to edge function URL
4. Configure schedule (every 5 minutes)

---

### Step 3: Test Manual Processing

Before relying on automated execution, test manually:

1. Navigate to `/admin/communications/scheduled`
2. Create a test scheduled email in Bulk Email (schedule for 1 minute from now)
3. Wait for scheduled time to pass
4. Click "Process Due Emails" button
5. Verify email status changes to "sent"
6. Check email logs for confirmation

---

## Using the Scheduled Emails System

### Scheduling an Email

1. Go to `/admin/communications/email` (Bulk Email)
2. Compose your email:
   - Select template (optional)
   - Enter subject and body
   - Choose recipients
3. In "Send Options", select "Schedule"
4. Pick date and time
5. Click "Schedule Email"
6. Email appears in Scheduled Emails with "PENDING" status

### Managing Scheduled Emails

Navigate to `/admin/communications/scheduled`:

**View Scheduled Emails:**
- See all scheduled campaigns
- Filter by status
- View scheduled date/time
- See recipient summary

**Actions Available:**
- 👁️ **Preview**: View email content before sending
- ❌ **Cancel**: Cancel a pending email (prevents sending)
- 🗑️ **Delete**: Permanently remove from database
- ▶️ **Process Due**: Manually trigger processing for overdue emails

**Status Indicators:**
- **PENDING** (gray): Waiting for scheduled time
- **PROCESSING** (blue): Currently being sent
- **SENT** (green): Successfully delivered
- **FAILED** (red): Sending failed
- **CANCELLED** (gray): Manually cancelled
- **PAST DUE** (red badge): Should have been sent but hasn't

---

## Processing Flow

### Automatic Processing Sequence

1. **Cron Job Triggers** (every 5 minutes)
   ```
   Cron → process-scheduled-emails function
   ```

2. **Fetch Due Emails**
   ```sql
   SELECT * FROM scheduled_emails
   WHERE status = 'pending'
   AND scheduled_for <= NOW()
   LIMIT 50
   ```

3. **For Each Email:**
   - Update status to "processing"
   - Get recipients based on filter criteria
   - Send personalized emails (variables replaced)
   - Log each send to `email_logs` table
   - Update status to "sent" or "failed"

4. **Return Summary**
   - Total processed
   - Successful sends
   - Failed sends

---

## Monitoring & Troubleshooting

### Check Processing Logs

**Via Backend:**
1. Navigate to Edge Functions → process-scheduled-emails
2. Click "Logs" tab
3. Review recent executions
4. Look for errors or warnings

**Log Messages to Look For:**
- `[SCHEDULED-EMAILS] Starting scheduled email processing...`
- `[SCHEDULED-EMAILS] Found X scheduled emails to process`
- `[SCHEDULED-EMAILS] Email ID X processed: Y sent, Z failed`
- `[SCHEDULED-EMAILS] Processing complete`

### Common Issues

#### Issue 1: Emails Not Sending Automatically
**Symptoms:** Emails remain "PENDING" past scheduled time

**Troubleshooting:**
1. Verify cron job is active and running
2. Check edge function logs for errors
3. Ensure `RESEND_API_KEY` is set
4. Try manual "Process Due Emails" button
5. Check for function deployment errors

**Solution:**
- Re-create cron job if needed
- Verify API keys in backend secrets
- Check Resend API usage limits

#### Issue 2: All Emails Failing
**Symptoms:** Status changes to "FAILED" immediately

**Troubleshooting:**
1. Check email logs table for error messages
2. Verify recipient email addresses are valid
3. Check Resend domain verification
4. Review edge function error logs

**Solution:**
- Verify Resend domain: https://resend.com/domains
- Check API key validity
- Review recipient filter (ensure matches users)

#### Issue 3: Processing Timeout
**Symptoms:** Large batches failing or timing out

**Troubleshooting:**
1. Check how many emails in batch
2. Review function execution time
3. Monitor Resend API rate limits

**Solution:**
- Function processes max 50 emails per run
- Split large campaigns into smaller batches
- Increase cron frequency if needed
- Consider upgrading Resend plan for higher limits

#### Issue 4: Variables Not Replacing
**Symptoms:** Email shows `{{username}}` instead of actual values

**Troubleshooting:**
1. Check edge function variable replacement code
2. Verify template uses correct variable names
3. Check if user profile has required fields

**Solution:**
- Supported variables: `{{username}}`, `{{email}}`, `{{full_name}}`
- Ensure profiles table has these fields populated
- Use template preview to test variables

---

## Performance Optimization

### Batch Size Tuning

The function processes 50 emails per execution by default:

```typescript
.limit(50); // Process up to 50 emails per run
```

**Recommendations:**
- **Low traffic:** Keep at 50
- **High volume:** Increase to 100-200 (if function doesn't timeout)
- **Very high volume:** Run cron more frequently (every minute) instead of increasing batch size

### Cron Frequency Adjustment

**Recommended schedules:**
- **Testing:** Every minute (`*/1 * * * *`)
- **Low priority:** Every 15-30 minutes
- **Standard:** Every 5 minutes ✅
- **High priority:** Every 1-2 minutes
- **Critical/real-time:** Consider using webhook triggers instead

### Resend API Rate Limits

**Free Tier:** 100 emails/day  
**Paid Plans:** 10,000+ emails/day

**Managing Limits:**
- Monitor daily usage in Resend dashboard
- Implement retry logic for rate limit errors
- Queue large campaigns during off-peak hours
- Upgrade Resend plan for higher limits

---

## Testing Checklist

### Pre-Production Testing

- [ ] Schedule test email for 2 minutes from now
- [ ] Wait for scheduled time to pass
- [ ] Verify "PAST DUE" badge appears
- [ ] Click "Process Due Emails" button
- [ ] Confirm status changes to "SENT"
- [ ] Check email inbox for delivery
- [ ] Verify variables are replaced correctly
- [ ] Check email_logs table for entry

### Cron Job Testing

- [ ] Create cron job with 1-minute schedule (testing only)
- [ ] Schedule email for 2 minutes from now
- [ ] Do NOT manually process
- [ ] Wait for cron to execute (check after 1-2 minutes)
- [ ] Verify status automatically changed to "SENT"
- [ ] Review edge function logs
- [ ] Confirm email received
- [ ] Change cron back to 5-minute schedule

### Load Testing

- [ ] Schedule 10 emails simultaneously
- [ ] Verify all process correctly
- [ ] Check execution time in logs
- [ ] Monitor for timeouts or failures
- [ ] Verify all emails delivered

### Cancellation Testing

- [ ] Schedule email for future time
- [ ] Click "Cancel" button before scheduled time
- [ ] Verify status changes to "CANCELLED"
- [ ] Wait past scheduled time
- [ ] Confirm email was NOT sent
- [ ] Check no email_logs entry created

---

## Security Considerations

### Edge Function Access

The `process-scheduled-emails` function has `verify_jwt = false`:
- ✅ Allows automated execution (cron)
- ⚠️ Function is publicly accessible
- ✅ No sensitive data exposure (only processes internal queue)
- ✅ Rate limited by Supabase

**Security Measures:**
- Function only reads from scheduled_emails table
- No user input required
- Uses service role for database access
- Logs all actions for audit trail

### Scheduled Email Storage

- Emails stored in database until deleted
- Contains subject, body, and recipient filters
- Accessible only to admin users via RLS policies
- Automatically cleaned up after sending (can be configured)

---

## Advanced Configuration

### Auto-Delete Sent Emails

To automatically clean up old scheduled emails:

```sql
-- Create cron job to delete sent emails older than 30 days
SELECT cron.schedule(
  'cleanup-scheduled-emails',
  '0 2 * * *',  -- Daily at 2 AM
  $$
  DELETE FROM scheduled_emails
  WHERE status IN ('sent', 'failed', 'cancelled')
  AND created_at < NOW() - INTERVAL '30 days';
  $$
);
```

### Email Retry Logic

Add retry mechanism for failed emails (future enhancement):

1. Keep failed emails in queue
2. Retry after 5 minutes
3. Max 3 retry attempts
4. Mark as "permanently_failed" after retries exhausted

### Webhook Integration

For real-time processing instead of cron:

1. Use Supabase Database Webhooks
2. Trigger on `scheduled_emails` INSERT
3. If `scheduled_for <= NOW()`, trigger function immediately
4. Reduces delay for immediate scheduling

---

## Metrics & Reporting

### Key Metrics to Monitor

1. **Processing Success Rate**
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
   FROM scheduled_emails
   WHERE created_at >= NOW() - INTERVAL '7 days'
   GROUP BY status;
   ```

2. **Average Processing Time**
   - Check edge function execution logs
   - Monitor Resend API response times
   - Track batch processing duration

3. **Daily Volume**
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as scheduled,
     COUNT(*) FILTER (WHERE status = 'sent') as sent,
     COUNT(*) FILTER (WHERE status = 'failed') as failed
   FROM scheduled_emails
   WHERE created_at >= NOW() - INTERVAL '30 days'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

---

## Support & Documentation

### Related Documentation
- [Email Templates Guide](./EMAIL_TEMPLATES_TESTING_GUIDE.md)
- [Bulk Email Documentation](./BULK_EMAIL_GUIDE.md)
- [Resend API Docs](https://resend.com/docs)
- [Supabase Cron Jobs](https://supabase.com/docs/guides/database/extensions/pg_cron)

### Need Help?
- Check edge function logs first
- Review scheduled_emails table for status
- Verify cron job is running
- Test manual processing before debugging cron

---

## Phase 3.2 Complete ✅

**Implemented Features:**
- ✅ Automated email scheduling
- ✅ Scheduled emails management UI
- ✅ Status tracking (pending, sent, failed, cancelled)
- ✅ Manual processing trigger
- ✅ Preview functionality
- ✅ Batch processing (50 emails per run)
- ✅ Comprehensive logging
- ✅ Past-due indicators

**Next Phase: 3.3 - Email Logs & Tracking**
- View detailed email delivery logs
- Track open rates (if supported)
- Filter and search logs
- Export logs for analysis
