# Testing Documentation - FineEarn Platform

## Overview
This document outlines comprehensive testing procedures for the FineEarn platform, covering unit tests, integration tests, and end-to-end testing scenarios.

---

## 1. Unit Tests

### 1.1 Proration Calculation Tests

**File:** `src/lib/plan-utils.ts` - `calculateProration()`

**Test Cases:**

```typescript
// Test 1: Full billing period remaining
Test: User upgrades on first day
Input: 
  - currentPlan: { price: 30, billing_period_days: 30 }
  - currentPlanStartDate: Today
  - newPlan: { price: 100 }
Expected:
  - credit: ~30 (full current plan value)
  - newCost: 70
  - daysRemaining: 30

// Test 2: Half billing period remaining
Test: User upgrades at mid-period
Input:
  - currentPlan: { price: 30, billing_period_days: 30 }
  - currentPlanStartDate: 15 days ago
  - newPlan: { price: 100 }
Expected:
  - credit: ~15 (half of current plan)
  - newCost: 85
  - daysRemaining: 15

// Test 3: Expired plan (no credit)
Test: User upgrades after plan expires
Input:
  - currentPlan: { price: 30, billing_period_days: 30 }
  - currentPlanStartDate: 31 days ago
  - newPlan: { price: 100 }
Expected:
  - credit: 0
  - newCost: 100
  - daysRemaining: 0

// Test 4: Downgrade scenario
Test: User downgrades to cheaper plan
Input:
  - currentPlan: { price: 100, billing_period_days: 30 }
  - currentPlanStartDate: 10 days ago
  - newPlan: { price: 30 }
Expected:
  - credit: ~66.67
  - newCost: 0 (credit exceeds new plan cost)
  - daysRemaining: 20
```

### 1.2 Commission Calculation Tests

**File:** `supabase/functions/process-referral-earnings/index.ts`

**Test Cases:**

```typescript
// Test 1: Task commission calculation
Test: Calculate referral commission for task completion
Input:
  - baseAmount: 10.00 (task earning)
  - commissionRate: 0.15 (15%)
Expected:
  - commissionAmount: 1.50

// Test 2: Deposit commission calculation
Test: Calculate referral commission for deposit
Input:
  - baseAmount: 100.00 (deposit amount)
  - commissionRate: 0.05 (5%)
Expected:
  - commissionAmount: 5.00

// Test 3: Zero commission rate (free plan)
Test: Free plan user referring someone
Input:
  - baseAmount: 10.00
  - commissionRate: 0.00
Expected:
  - commissionAmount: 0.00

// Test 4: Maximum commission rate
Test: Premium plan with maximum commission
Input:
  - baseAmount: 50.00
  - commissionRate: 0.25 (25%)
Expected:
  - commissionAmount: 12.50

// Test 5: Rounding precision
Test: Ensure 2 decimal precision
Input:
  - baseAmount: 10.33
  - commissionRate: 0.15
Expected:
  - commissionAmount: 1.55 (rounded correctly)
```

### 1.3 Referral Code Validation Tests

**File:** `src/lib/referral-utils.ts` - `validateReferralCode()`

**Test Cases:**

```typescript
// Test 1: Valid code
Test: 8-character uppercase alphanumeric
Input: "ABC12345"
Expected: true

// Test 2: Invalid - lowercase
Test: Contains lowercase letters
Input: "abc12345"
Expected: false

// Test 3: Invalid - too short
Test: Less than 8 characters
Input: "ABC123"
Expected: false

// Test 4: Invalid - too long
Test: More than 8 characters
Input: "ABC123456"
Expected: false

// Test 5: Invalid - special characters
Test: Contains special characters
Input: "ABC-1234"
Expected: false

// Test 6: Invalid - empty
Test: Empty string
Input: ""
Expected: false

// Test 7: Valid - all numbers
Test: 8 digits
Input: "12345678"
Expected: true

// Test 8: Valid - all letters
Test: 8 uppercase letters
Input: "ABCDEFGH"
Expected: true
```

### 1.4 Edge Cases - Circular Referrals

**File:** `supabase/functions/link-user-to-referrer/index.ts`

**Test Cases:**

```typescript
// Test 1: Self-referral prevention
Test: User tries to use their own referral code
Input:
  - userId: "user-a"
  - referralCode: "ABC12345" (belongs to user-a)
Expected: Error - "Cannot refer yourself"

// Test 2: Direct circular referral (A refers B, B tries to refer A)
Test: Prevent A->B->A circle
Input:
  - User A refers User B (allowed)
  - User B tries to refer User A
Expected: Error - "Circular referral detected"

// Test 3: Indirect circular referral (A->B->C->A)
Test: Prevent longer circular chains
Input:
  - User A refers User B
  - User B refers User C
  - User C tries to refer User A
Expected: Error - "Circular referral detected"
```

### 1.5 Idempotency Tests - Commission Processing

**File:** `supabase/functions/process-referral-earnings/index.ts`

**Test Cases:**

```typescript
// Test 1: Duplicate task completion
Test: Same task completed twice by same user
Input:
  - taskCompletionId: "task-123"
  - Process commission twice
Expected:
  - Commission only credited once
  - Second call returns success but no duplicate entry

// Test 2: Duplicate deposit commission
Test: Same deposit processed multiple times
Input:
  - depositId: "deposit-456"
  - Process commission twice
Expected:
  - Commission only credited once
  - Idempotency key prevents duplicate

// Test 3: Concurrent processing
Test: Multiple simultaneous requests for same event
Input:
  - 3 concurrent API calls for same commission
Expected:
  - Only one commission recorded
  - Database constraints prevent duplicates
```

### 1.6 Auto-Renewal Logic Tests

**File:** `supabase/functions/cleanup-expired-plans/index.ts`

**Test Cases:**

```typescript
// Test 1: Successful auto-renewal
Test: User has sufficient funds in deposit wallet
Input:
  - user.deposit_wallet_balance: 100.00
  - plan.price: 30.00
  - plan.auto_renew: true
Expected:
  - Plan renewed
  - Funds deducted from deposit wallet
  - Transaction logged
  - Notification sent

// Test 2: Failed auto-renewal - insufficient funds
Test: User lacks sufficient funds
Input:
  - user.deposit_wallet_balance: 10.00
  - plan.price: 30.00
  - plan.auto_renew: true
Expected:
  - Auto-renewal fails
  - Plan downgraded to free
  - Notification sent about failure
  - No funds deducted

// Test 3: Auto-renewal disabled
Test: User has auto-renewal turned off
Input:
  - user.deposit_wallet_balance: 100.00
  - plan.price: 30.00
  - plan.auto_renew: false
Expected:
  - No renewal attempt
  - Plan expires normally
  - User downgraded to free

// Test 4: Edge case - exact balance
Test: Balance exactly equals plan price
Input:
  - user.deposit_wallet_balance: 30.00
  - plan.price: 30.00
  - plan.auto_renew: true
Expected:
  - Renewal succeeds
  - Balance becomes 0.00
  - Plan renewed
```

---

## 2. Integration Tests

### 2.1 Complete Upgrade Flow with Proration

**Scenario:** User upgrades from Basic to Pro plan mid-cycle

**Steps:**
1. User registers and activates Basic plan ($30/month)
2. Wait 15 days
3. User deposits $100 to Deposit Wallet
4. User upgrades to Pro plan ($100/month)

**Expected Outcomes:**
- ✅ Proration calculated correctly (~$85 cost after $15 credit)
- ✅ Funds deducted from Deposit Wallet
- ✅ Transaction logged with type "plan_upgrade"
- ✅ New plan immediately active with Pro benefits
- ✅ Daily task limit increased immediately
- ✅ Plan expiry set to 30 days from upgrade
- ✅ In-app notification created
- ✅ Email sent confirming upgrade

**Database Checks:**
```sql
-- Verify transaction
SELECT * FROM transactions 
WHERE user_id = '<user_id>' 
AND type = 'plan_upgrade' 
ORDER BY created_at DESC LIMIT 1;

-- Verify profile updated
SELECT membership_plan, plan_expires_at, deposit_wallet_balance 
FROM profiles 
WHERE id = '<user_id>';

-- Verify notification created
SELECT * FROM notifications 
WHERE user_id = '<user_id>' 
AND type = 'plan' 
ORDER BY created_at DESC LIMIT 1;
```

### 2.2 Referral Signup and Commission Earning

**Scenario:** User A refers User B, User B completes tasks and makes deposit

**Steps:**
1. User A shares referral link
2. User B signs up using User A's referral code
3. User B completes 5 AI tasks (earning $2 per task)
4. User B deposits $50 to their Deposit Wallet

**Expected Outcomes:**
- ✅ User B linked to User A as referrer
- ✅ Referral record created
- ✅ Task commissions credited to User A (5 tasks × $2 × commission rate)
- ✅ Deposit commission credited to User A ($50 × deposit commission rate)
- ✅ Referral earnings logged in referral_earnings table
- ✅ User A receives notifications for each commission
- ✅ User B appears in User A's referrals list

**Database Checks:**
```sql
-- Verify referral link
SELECT * FROM profiles 
WHERE id = '<user_b_id>' 
AND referred_by = '<user_a_id>';

-- Verify task commissions
SELECT * FROM referral_earnings 
WHERE referrer_id = '<user_a_id>' 
AND earning_type = 'task_commission';

-- Verify deposit commission
SELECT * FROM referral_earnings 
WHERE referrer_id = '<user_a_id>' 
AND earning_type = 'deposit_commission';
```

### 2.3 Auto-Renewal Success and Failure

**Scenario A:** Successful auto-renewal

**Steps:**
1. User has Pro plan ($100/month) with auto_renew = true
2. User has $150 in Deposit Wallet
3. Plan expires
4. System runs cleanup-expired-plans function

**Expected Outcomes:**
- ✅ Plan automatically renewed
- ✅ $100 deducted from Deposit Wallet
- ✅ New expiry date set to +30 days
- ✅ Transaction logged
- ✅ Success notification sent
- ✅ Email sent confirming renewal

**Scenario B:** Failed auto-renewal

**Steps:**
1. User has Pro plan ($100/month) with auto_renew = true
2. User has $50 in Deposit Wallet (insufficient)
3. Plan expires
4. System runs cleanup-expired-plans function

**Expected Outcomes:**
- ✅ Renewal attempt fails
- ✅ Plan downgraded to Free
- ✅ No funds deducted
- ✅ Failure notification sent
- ✅ Email sent explaining insufficient funds
- ✅ User's daily task limit reduced to Free plan limits

### 2.4 Admin Change Upline

**Scenario:** Admin changes User B's upline from User A to User C

**Steps:**
1. User B is referred by User A
2. Admin navigates to User B's detail page
3. Admin clicks "Change Upline"
4. Admin searches for and selects User C
5. Admin confirms the change

**Expected Outcomes:**
- ✅ User B's referred_by field updated to User C's ID
- ✅ Referral record updated
- ✅ Audit log created recording admin action
- ✅ Future commissions go to User C, not User A
- ✅ Historical commissions remain with User A
- ✅ System validates no circular referral created

**Database Checks:**
```sql
-- Verify upline changed
SELECT referred_by FROM profiles WHERE id = '<user_b_id>';

-- Verify audit log
SELECT * FROM audit_logs 
WHERE target_user_id = '<user_b_id>' 
AND action_type = 'change_upline' 
ORDER BY created_at DESC LIMIT 1;

-- Verify no circular referral
-- Should not allow if User C is in User B's downline
```

### 2.5 Batch Processing of Expired Plans

**Scenario:** Multiple users have plans expiring simultaneously

**Steps:**
1. Create 100 test users with plans expiring today
2. Mix of auto_renew = true/false
3. Mix of sufficient/insufficient deposit balances
4. Run cleanup-expired-plans function

**Expected Outcomes:**
- ✅ All expired plans processed
- ✅ Auto-renewals attempted where enabled
- ✅ Successful renewals logged
- ✅ Failed renewals downgrade to Free
- ✅ All users receive appropriate notifications
- ✅ No duplicate processing
- ✅ Process completes within acceptable time (<5 minutes)

**Performance Checks:**
- Execution time logged
- No database deadlocks
- No memory issues
- All transactions committed or rolled back properly

---

## 3. Security Audit Checklist

### 3.1 RLS Policies Comprehensive Coverage ✓

**Tables to Audit:**

#### profiles
- ✅ Users can view their own profile
- ✅ Users can update their own profile
- ✅ Admins can view all profiles
- ✅ Admins can update all profiles
- ❌ Missing: Users CANNOT insert their own profile (handled by trigger)
- ❌ Missing: Users CANNOT delete their own profile

#### transactions
- ✅ Users can view their own transactions
- ✅ Admins can view all transactions
- ✅ Admins can insert transactions
- ✅ Admins can update transactions
- ❌ Missing: Users cannot insert transactions directly

#### referrals
- ✅ Users can view their own referrals
- ✅ Admins can manage all referrals

#### referral_earnings
- ✅ Users can view their own earnings
- ✅ Admins can manage all earnings

#### notifications (NEW)
- ✅ Users can view their own notifications
- ✅ Users can update their own notifications (mark as read)
- ✅ Admins can insert notifications
- ✅ Admins can view all notifications

**Recommendation:** All critical tables have appropriate RLS policies ✓

### 3.2 Edge Function Authorization Checks

**Functions to Audit:**

1. **create-notification** ✓
   - No JWT verification needed (called server-side only)
   - Should add verify_jwt = false in config

2. **link-user-to-referrer** ✓
   - Requires authentication
   - Validates user owns the account being linked

3. **process-referral-earnings** ✓
   - Service role only
   - No direct user access

4. **upgrade-plan** ✓
   - Requires authentication
   - Validates user owns the account
   - Checks sufficient balance

5. **admin-manage-user** ✓
   - Requires admin role
   - Uses has_role() function

**Recommendation:** Add role checks to all admin functions ✓

### 3.3 Input Validation and Sanitization

**Areas to Validate:**

1. **Referral Code Input** ✓
   - Client-side: Regex validation
   - Server-side: Database lookup validation
   - Length check (exactly 8 characters)
   - Character whitelist (A-Z, 0-9 only)

2. **Email Addresses** ✓
   - Zod schema validation
   - Email format check
   - No script tags allowed

3. **Amounts (Deposits, Withdrawals)** ✓
   - Type validation (numeric)
   - Min/max range checks
   - Decimal precision (2 places)

4. **User-Generated Content** ✓
   - Usernames: Alphanumeric only
   - No HTML/script injection possible
   - Max length enforced

**Recommendation:** All inputs validated at multiple layers ✓

### 3.4 SQL Injection Prevention

**Query Patterns Checked:**

✅ All queries use Supabase client methods (not raw SQL)
✅ No string concatenation in queries
✅ Parameterized queries only
✅ Edge functions use service role safely
✅ No dynamic SQL execution

**Recommendation:** SQL injection risk is minimal ✓

### 3.5 Rate Limiting

**Operations Requiring Rate Limits:**

1. **Referral Code Validation** ⚠️
   - Current: No rate limit
   - Recommendation: Add rate limiting (10 attempts/minute)

2. **Withdrawal Requests** ⚠️
   - Current: Business logic prevents multiple pending
   - Recommendation: Add rate limit (5 requests/hour)

3. **Plan Upgrades** ✓
   - Natural rate limit (requires funds)

4. **Task Completions** ✓
   - Daily limit enforced by membership plan

**Recommendation:** Add rate limiting middleware for high-frequency operations

### 3.6 Audit Logging Completeness

**Actions Being Logged:**

✅ Admin actions (user management)
✅ Plan upgrades/downgrades
✅ Wallet adjustments
✅ Referral changes
✅ Withdrawal approvals/rejections

**Actions NOT Being Logged:**

⚠️ User login events
⚠️ Failed authentication attempts
⚠️ Referral code usage attempts
⚠️ Task completion events (consider for analytics)

**Recommendation:** Expand audit logging for security monitoring

---

## 4. Known Security Issues from Linter

### 4.1 ERROR: Security Definer View

**Issue:** Views defined with SECURITY DEFINER property detected
**Risk:** Views enforce permissions of creator, not querying user
**Action Required:** Review all SECURITY DEFINER views and ensure they're necessary
**Link:** https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

### 4.2 WARN: Extension in Public Schema

**Issue:** Extensions installed in public schema
**Risk:** Minor security concern
**Action Required:** Move extensions to dedicated schema when possible
**Link:** https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

### 4.3 WARN: Leaked Password Protection Disabled

**Issue:** Password leak detection not enabled
**Risk:** Users can use compromised passwords
**Action Required:** Enable leaked password protection in Auth settings
**Link:** https://supabase.com/docs/guides/auth/password-security

---

## 5. Testing Execution Schedule

### Phase 1: Unit Tests (Week 1)
- Day 1-2: Proration & commission calculations
- Day 3: Referral code validation
- Day 4-5: Edge cases & idempotency

### Phase 2: Integration Tests (Week 2)
- Day 1-2: Upgrade flows
- Day 3: Referral flows
- Day 4: Auto-renewal
- Day 5: Admin operations

### Phase 3: Security Audit (Week 3)
- Day 1-2: RLS policy review
- Day 3: Input validation audit
- Day 4: Rate limiting implementation
- Day 5: Final security scan

### Phase 4: Performance Testing (Week 4)
- Load testing with 1000+ concurrent users
- Database query optimization
- Edge function cold start times
- Batch processing efficiency

---

## 6. Test Data Requirements

### User Profiles
- 100 test users across all membership tiers
- Mix of active/expired plans
- Various referral depths (0-5 levels)
- Different countries and timezones

### Transactions
- 1000+ test transactions
- All transaction types represented
- Various amounts and statuses

### Referral Network
- Complex referral trees (5+ levels deep)
- Edge cases (circular attempts, self-referrals)
- Commission scenarios at various rates

---

## 7. Success Criteria

### Unit Tests
- ✅ 100% of critical functions covered
- ✅ All edge cases tested
- ✅ No regressions in calculations

### Integration Tests
- ✅ All user flows complete successfully
- ✅ No data corruption
- ✅ Notifications sent correctly

### Security
- ✅ All CRITICAL linter issues resolved
- ✅ RLS policies comprehensive
- ✅ Input validation complete
- ✅ Audit logging functional

### Performance
- ✅ Page load < 2 seconds
- ✅ API responses < 500ms
- ✅ Batch operations < 5 minutes
- ✅ No memory leaks

---

## 8. Bug Tracking Template

```markdown
### Bug Report

**Title:** [Short description]
**Severity:** Critical / High / Medium / Low
**Component:** [Frontend / Backend / Database]
**Affected Feature:** [Specific feature]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Logs:**
[Attach relevant evidence]

**Environment:**
- Browser: [Browser name and version]
- Device: [Desktop / Mobile]
- User Role: [Admin / User]
- Membership Plan: [Free / Personal / Business / Group]

**Priority:** [Must Fix / Should Fix / Nice to Fix]
```

---

## Conclusion

This testing documentation provides a comprehensive framework for ensuring the FineEarn platform is robust, secure, and production-ready. All tests should be executed before each major release, with automated testing implemented where possible.
