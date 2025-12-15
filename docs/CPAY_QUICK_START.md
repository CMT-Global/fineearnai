# CPAY Quick Start Guide 🚀

## For Admins - 3 Steps to Go Live

### Step 1: Activate CPAY Processors (2 minutes)
1. Login as admin
2. Navigate to: **Admin Panel → Payment Settings**
3. Find these two entries:
   - **CPAY (USDT)** - For deposits
   - **CPAY USDT (TRC20)** - For withdrawals
4. Toggle both switches to **ON** (Active)

✅ Done! CPAY is now active on your platform.

---

### Step 2: Test Deposit Flow (5 minutes)
1. **User Side:**
   - Go to Wallet page
   - Click "Deposit"
   - Select "CPAY (USDT)"
   - Enter test amount ($10-$20 recommended)
   - Click "Confirm Deposit"
   - Complete payment on CPAY gateway
   
2. **Expected Result:**
   - User redirected to `/deposit-result` with success message
   - Balance updates automatically via webhook
   - Transaction visible in Wallet

3. **Admin Verification:**
   - Go to **Admin → CPAY Monitoring** (`/admin/monitoring/cpay`)
   - Verify transaction appears
   - Check status is "completed"

---

### Step 3: Test Withdrawal Flow (5 minutes)
1. **User Side:**
   - Go to Wallet page
   - Click "Withdraw" (ensure you have balance)
   - Select "CPAY USDT (TRC20)"
   - Enter valid USDT TRC20 address
   - Submit request

2. **Admin Processing:**
   - Go to **Admin → Withdrawals**
   - Find the pending request
   - Click "Approve"
   - System automatically calls CPAY API
   - Payout processes instantly

3. **Verification:**
   - Check transaction status changes to "completed"
   - Verify on CPAY dashboard
   - User receives funds

---

## Key Admin URLs

| Feature | URL | Description |
|---------|-----|-------------|
| Payment Settings | `/admin/settings/payments` | Activate/configure processors |
| CPAY Monitoring | `/admin/monitoring/cpay` | Real-time transaction tracking |
| Withdrawals | `/admin/withdrawals` | Process pending withdrawals |
| Deposit Result | `/deposit-result` | User sees this after payment |

---

## Quick Troubleshooting

### ❌ "No payment methods available"
**Problem:** CPAY processors not activated
**Solution:** Go to Payment Settings, toggle CPAY processors ON

### ❌ Deposit completed but balance not updated
**Problem:** Webhook not received
**Solution:** 
1. Check CPAY dashboard webhook configuration
2. Verify webhook URL: `https://your-project.supabase.co/functions/v1/cpay-webhook`
3. Check edge function logs

### ❌ Withdrawal fails when approved
**Problem:** CPAY account balance low or wrong address
**Solution:**
1. Verify CPAY account has funds
2. Check user entered valid TRC20 address
3. Review edge function logs for error details

---

## Monitoring Dashboard Features

Access: **Admin → CPAY Monitoring** (`/admin/monitoring/cpay`)

**What You See:**
- ✅ Total deposits processed (USD value)
- ✅ Total withdrawals processed (USD value)
- ✅ Pending deposits count
- ✅ Pending withdrawals count
- ✅ Filterable transaction table
- ✅ Real-time refresh button

**Filter Options:**
- All Transactions
- Deposits Only
- Withdrawals Only

**Transaction Details:**
- Date & time
- User info (username/email)
- Transaction type
- Amount
- Status
- Gateway transaction ID
- Order/Payout IDs

---

## User Experience

### What Users See:

**Deposit:**
1. Select CPAY payment method
2. Enter amount
3. Redirected to CPAY payment page
4. Complete payment
5. See beautiful success page at `/deposit-result`
6. Auto-redirected to wallet in 10 seconds

**Withdrawal:**
1. Select CPAY withdrawal method
2. Enter TRC20 address (with validation)
3. See fee disclosure
4. Submit request
5. Wait for admin approval
6. Receive funds to wallet

---

## Daily Operations Checklist

### Morning (5 minutes):
- [ ] Check CPAY Monitoring dashboard
- [ ] Review pending withdrawals
- [ ] Verify overnight deposits completed

### During Day (As needed):
- [ ] Process withdrawal requests
- [ ] Monitor transaction statuses
- [ ] Handle any user support issues

### Evening (5 minutes):
- [ ] Review day's transactions
- [ ] Check for any failed transactions
- [ ] Verify all payouts completed

---

## Security Reminders

✅ **What's Secure:**
- API keys stored in Lovable Cloud secrets
- Webhook signature verification
- Admin-only withdrawal approval
- Complete transaction audit trail

⚠️ **Stay Safe:**
- Never share API keys
- Verify addresses before approving withdrawals
- Monitor for unusual transaction patterns
- Test with small amounts first

---

## Performance Expectations

| Action | Expected Time |
|--------|--------------|
| Deposit redirect to CPAY | < 2 seconds |
| Webhook processing | < 5 seconds |
| Balance update | < 10 seconds |
| Withdrawal approval | Instant |
| CPAY payout | < 30 seconds |

---

## Support Resources

**For CPAY Issues:**
- CPAY Dashboard: Check your account
- CPAY Support: Contact their team
- API Status: Monitor their status page

**For Platform Issues:**
- Edge Function Logs: Check Lovable Cloud logs
- Database: Check transactions table
- Admin Dashboard: Monitor CPAY dashboard

---

## Next Steps After Going Live

1. **Week 1:**
   - Process small amounts only
   - Monitor all transactions closely
   - Gather user feedback

2. **Week 2-4:**
   - Gradually increase limits
   - Optimize processing times
   - Add email notifications (Phase 4)

3. **Month 2+:**
   - Consider adding more currencies
   - Implement auto-approval for trusted users
   - Add advanced analytics

---

**Status:** ✅ Ready for Production
**Last Updated:** Phase 3 Complete
**Questions?** Check `CPAY_INTEGRATION_GUIDE.md` for detailed docs
