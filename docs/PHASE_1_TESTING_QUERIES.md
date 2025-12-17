# Phase 1 Testing - SQL Monitoring Queries

## Pre-Test Verification

### Check Cron Jobs are Active
```sql
SELECT 
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname IN ('bulk-email-processor', 'monitor-stuck-bulk-email-jobs')
ORDER BY jobname;
```

### Check Current Job Queue Status
```sql
SELECT 
  id,
  batch_id,
  subject,
  status,
  total_recipients,
  processed_count,
  successful_count,
  failed_count,
  processing_worker_id,
  last_heartbeat,
  cancel_requested,
  created_at,
  started_at,
  completed_at
FROM bulk_email_jobs
ORDER BY created_at DESC
LIMIT 10;
```

## Test 1: Basic Job Processing

### Monitor Job Pickup (Run every 30 seconds during test)
```sql
SELECT 
  batch_id,
  status,
  processing_worker_id,
  last_heartbeat,
  processed_count || '/' || total_recipients as progress,
  EXTRACT(EPOCH FROM (NOW() - created_at))::integer as seconds_since_created,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::integer as seconds_since_heartbeat
FROM bulk_email_jobs
WHERE status IN ('queued', 'processing')
ORDER BY created_at DESC;
```

## Test 2: Race Condition Prevention

### Check for Concurrent Processing (Should show max 1 processing job)
```sql
SELECT 
  COUNT(*) as processing_jobs_count,
  array_agg(DISTINCT processing_worker_id) as worker_ids
FROM bulk_email_jobs
WHERE status = 'processing';
```

### Verify Job Lock Status
```sql
SELECT 
  batch_id,
  status,
  processing_worker_id,
  last_heartbeat,
  pg_locks.mode,
  pg_locks.granted
FROM bulk_email_jobs
LEFT JOIN pg_locks ON pg_locks.relation = 'bulk_email_jobs'::regclass
WHERE status = 'processing';
```

## Test 3: Heartbeat Tracking

### Monitor Heartbeat Updates (Run every 10 seconds during processing)
```sql
SELECT 
  batch_id,
  status,
  processed_count,
  total_recipients,
  ROUND((processed_count::numeric / NULLIF(total_recipients, 0) * 100)::numeric, 2) as percent_complete,
  last_heartbeat,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::integer as seconds_ago,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) > 600 THEN '🔴 STUCK'
    WHEN EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) > 120 THEN '🟡 SLOW'
    ELSE '🟢 ACTIVE'
  END as heartbeat_status
FROM bulk_email_jobs
WHERE status = 'processing';
```

## Test 4: Stuck Job Detection

### Simulate Stuck Job (Insert before monitor cron runs)
```sql
INSERT INTO bulk_email_jobs (
  batch_id, 
  subject, 
  body, 
  recipient_filter, 
  total_recipients, 
  processed_count, 
  status, 
  processing_worker_id, 
  last_heartbeat,
  created_at,
  started_at
) VALUES (
  'test-stuck-' || gen_random_uuid()::text,
  'Simulated Stuck Job for Testing',
  'This job is intentionally stuck to test monitor function',
  '{"type": "all"}'::jsonb,
  100,
  50,
  'processing',
  'dead-worker-' || floor(random() * 1000)::text,
  NOW() - INTERVAL '15 minutes',  -- 15 minutes ago
  NOW() - INTERVAL '20 minutes',
  NOW() - INTERVAL '15 minutes'
);
```

### Check if Monitor Reset the Stuck Job (Run 5+ minutes after inserting)
```sql
SELECT 
  batch_id,
  status,
  processing_worker_id,
  error_message,
  last_heartbeat,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat))::integer / 60 as minutes_since_heartbeat
FROM bulk_email_jobs
WHERE batch_id LIKE 'test-stuck-%'
ORDER BY created_at DESC;
```

### View Monitor Function Logs (Check cron execution)
```sql
SELECT 
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'monitor-stuck-bulk-email-jobs')
ORDER BY start_time DESC
LIMIT 5;
```

## Test 5: Job Cancellation

### Set Cancel Flag on Running Job
```sql
UPDATE bulk_email_jobs
SET cancel_requested = true
WHERE status = 'processing'
AND batch_id = 'YOUR_BATCH_ID_HERE';
```

### Monitor Cancellation Progress
```sql
SELECT 
  batch_id,
  status,
  cancel_requested,
  processed_count,
  total_recipients,
  last_heartbeat
FROM bulk_email_jobs
WHERE cancel_requested = true
ORDER BY created_at DESC;
```

## Test 6: Duplicate Detection

### Check for Duplicate Hashes
```sql
SELECT 
  duplicate_check_hash,
  COUNT(*) as job_count,
  array_agg(batch_id) as batch_ids,
  array_agg(status) as statuses
FROM bulk_email_jobs
WHERE duplicate_check_hash IS NOT NULL
GROUP BY duplicate_check_hash
HAVING COUNT(*) > 1;
```

## Test 7: Error Handling

### View Failed Jobs with Error Details
```sql
SELECT 
  batch_id,
  subject,
  status,
  processed_count,
  successful_count,
  failed_count,
  error_message,
  processing_metadata->'last_error' as last_processing_error,
  completed_at
FROM bulk_email_jobs
WHERE status = 'failed'
ORDER BY completed_at DESC
LIMIT 5;
```

## General Monitoring

### Real-Time Processing Dashboard
```sql
SELECT 
  status,
  COUNT(*) as job_count,
  SUM(total_recipients) as total_recipients,
  SUM(processed_count) as processed,
  SUM(successful_count) as successful,
  SUM(failed_count) as failed,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)::numeric, 2) as avg_duration_minutes
FROM bulk_email_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'processing' THEN 1
    WHEN 'queued' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'failed' THEN 4
    WHEN 'cancelled' THEN 5
  END;
```

### Email Delivery Stats (Last 24h)
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as emails_sent,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(
    COUNT(CASE WHEN status = 'sent' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as delivery_rate_percent
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

### Worker Performance Analysis
```sql
SELECT 
  processing_worker_id,
  COUNT(*) as jobs_processed,
  SUM(processed_count) as total_emails_sent,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(last_heartbeat) as last_seen
FROM bulk_email_jobs
WHERE status IN ('completed', 'failed')
AND processing_worker_id IS NOT NULL
GROUP BY processing_worker_id
ORDER BY last_seen DESC;
```

## Cleanup Test Data

### Remove Test Jobs (Be careful!)
```sql
-- Remove stuck job tests
DELETE FROM bulk_email_jobs
WHERE batch_id LIKE 'test-stuck-%';

-- Remove test email logs
DELETE FROM email_logs
WHERE metadata->>'batch_id' IN (
  SELECT batch_id FROM bulk_email_jobs WHERE subject LIKE '%Test%'
);

-- Remove test jobs
DELETE FROM bulk_email_jobs
WHERE subject LIKE '%Test%'
AND status IN ('completed', 'failed', 'cancelled');
```
