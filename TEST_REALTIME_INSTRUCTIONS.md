# Real-Time Transaction Updates - Testing Instructions

## What Was Fixed

✅ **Real-time subscription hook simplified and fixed**
- Removed complex module-level registry that was causing conflicts
- Matched the working `useRealtimeProfile` pattern exactly
- Now listens to ALL events (INSERT, UPDATE, DELETE)
- Better error logging and status tracking

✅ **Database configured for real-time**
- `transactions` table has REPLICA IDENTITY FULL
- Table is in supabase_realtime publication
- RLS policies allow users to view their own transactions

✅ **Hook integrated in all pages**
- Dashboard
- Wallet
- Tasks
- Transactions page
- RecentTransactionsCard component

## How to Test Real-Time Updates

### Test 1: Task Completion (task_earning)
1. Open the app in browser
2. Open Developer Console (F12)
3. Look for log: `✅ Successfully subscribed to transaction updates`
4. Navigate to Tasks page
5. Complete a task
6. **EXPECTED**: Recent Transactions Card updates instantly with new task earning
7. **CHECK CONSOLE**: Should see `🔴 Real-time transaction event received:` with type: task_earning

### Test 2: Deposit (deposit)
1. Stay on the same page (don't refresh)
2. Navigate to Wallet
3. Click "Deposit Funds"
4. Initiate a CPAY deposit (any amount)
5. Complete the payment in CPAY checkout
6. **EXPECTED**: Once webhook processes, Recent Transactions Card shows new deposit instantly
7. **CHECK CONSOLE**: Should see real-time event with type: deposit, status: completed

### Test 3: Withdrawal Request (withdrawal)
1. Navigate to Wallet → Withdraw tab
2. Create a withdrawal request
3. **EXPECTED**: Recent Transactions Card shows pending withdrawal instantly
4. **CHECK CONSOLE**: Should see real-time event with type: withdrawal, status: pending

### Test 4: Withdrawal Rejection (balance adjustment)
1. As admin, go to Admin Panel → Withdrawals
2. Reject a pending withdrawal
3. **EXPECTED**: 
   - Withdrawal status updates to rejected instantly
   - Refund adjustment transaction appears instantly
4. **CHECK CONSOLE**: Should see TWO real-time events (withdrawal UPDATE + adjustment INSERT)

### Test 5: Referral Commission (referral_commission)
1. If you have referrals, have them complete a task
2. **EXPECTED**: Your Recent Transactions Card shows referral commission instantly
3. **CHECK CONSOLE**: Should see real-time event with type: referral_commission

## What to Look For in Console

### Success Logs:
```
🔴 Setting up real-time subscription for transactions: [user-id]
🔴 Real-time transactions subscription status: SUBSCRIBED
✅ Successfully subscribed to transaction updates
🔴 Real-time transaction event received: { event: 'INSERT', type: 'task_earning', ... }
✅ Transaction caches invalidated - UI will update automatically
```

### Error Logs (BAD):
```
❌ Real-time subscription error: CHANNEL_ERROR
❌ Real-time subscription error: TIMED_OUT
```

If you see errors, the real-time subscription failed. This could be due to:
- Network issues
- Supabase realtime quotas exceeded
- Browser blocking WebSocket connections

## Troubleshooting

### If transactions don't appear instantly:

1. **Check subscription status in console**
   - Should see "SUBSCRIBED" not "CHANNEL_ERROR"

2. **Verify real-time is working at all**
   - Open 2 browser tabs/windows with same user logged in
   - Complete action in one tab
   - Check if other tab updates

3. **Check network tab**
   - Should see WebSocket connection to `wss://...supabase.co/realtime/v1/websocket`
   - Should stay connected (not constantly reconnecting)

4. **Clear React Query cache**
   - Open React Query DevTools
   - Invalidate all queries
   - Try again

### Fallback Behavior

Even if real-time fails:
- Page refresh will show latest data
- Navigation between pages triggers refetch
- Manual pull-to-refresh on mobile works

## CRON Job Verification

The cleanup CRON job runs every 6 hours:
```sql
-- Check job status
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'cleanup-pending-transactions';

-- Check recent runs
SELECT * FROM cron.job_run_details 
WHERE jobid = 11 
ORDER BY end_time DESC 
LIMIT 5;
```

**What it does**: Deletes pending deposit transactions older than 24 hours (these are orphaned placeholders that never received webhook confirmation)

**Why it's safe**: 
- Only deletes `type='deposit' AND status='pending'`
- Unique indexes prevent completed transactions from being duplicated
- Runs when webhook already processed or never will
- Creates audit log of all deletions

## Success Criteria

✅ All 5 transaction types appear instantly without refresh
✅ Console shows SUBSCRIBED status
✅ No CHANNEL_ERROR messages
✅ Multiple tabs update simultaneously
✅ CRON job runs successfully every 6 hours
✅ No duplicate transactions appear
