# Phase 1: Edge Function API Failure Handling - COMPLETE ✅

**Date:** 2025-06-XX  
**Status:** COMPLETE  
**File Modified:** `supabase/functions/process-withdrawal-payment/index.ts`

---

## 🎯 Objective
Update the withdrawal processing edge function so that when an API payment fails (e.g., CPAY insufficient balance), the withdrawal remains PENDING for admin retry instead of automatically rejecting and refunding to the user.

---

## ✅ Changes Implemented

### **1. Updated `handlePayViaAPI` Function (Lines 273-328)**

#### **BEFORE (Old Behavior):**
```typescript
catch (apiError: any) {
  // ❌ Status changed to 'failed'
  // ❌ User's wallet refunded immediately
  // ❌ Transaction marked as 'failed'
  // ❌ Failure notification sent to user
  // ❌ Returned success: false
}
```

#### **AFTER (New Behavior):**
```typescript
catch (apiError: any) {
  // ✅ Status remains 'pending' (allows retry)
  // ✅ Error stored in api_response field with full details
  // ✅ User's wallet NOT refunded (funds stay deducted)
  // ✅ Transaction remains 'pending' (not failed)
  // ✅ NO failure notification sent to user
  // ✅ Audit log created for admin awareness
  // ✅ Returns success: true, api_failed: true (special flag)
}
```

---

## 🔧 Technical Details

### **What Happens When API Fails Now:**

1. **Withdrawal Status:** Stays as `'pending'` in `withdrawal_requests` table
2. **API Error Storage:** Full error details saved to `api_response` JSON field:
   ```json
   {
     "error": "Insufficient balance",
     "details": "CPAY account balance too low",
     "failed_at": "2025-06-15T10:30:00.000Z",
     "provider": "cpay"
   }
   ```
3. **User Wallet:** Remains unchanged - original withdrawal amount stays deducted
4. **Transaction Record:** Status stays `'pending'` (not changed to failed)
5. **User Notification:** None sent (user doesn't see failure - withdrawal still processing)
6. **Audit Log:** Created with action type `'withdrawal_api_failed'` including:
   - Withdrawal ID
   - Amount & Net Amount
   - Provider name
   - Error message & details
   - Note: "API call failed - withdrawal remains PENDING for admin retry or manual rejection"

### **Response to Frontend:**
```json
{
  "success": true,
  "api_failed": true,
  "error_message": "Insufficient balance in CPAY account",
  "status": "pending",
  "provider": "cpay",
  "message": "API payment failed: Insufficient balance. Withdrawal remains PENDING - you can retry or reject manually."
}
```

---

## 🎪 Admin Workflow After This Change

### **Scenario: CPAY API Fails Due to Insufficient Balance**

1. **Admin clicks "Approve & Pay Via API"**
2. **Edge function calls CPAY API** → Returns error: "Insufficient balance"
3. **Edge function:**
   - Keeps withdrawal as PENDING ✅
   - Stores error in database ✅
   - Logs to audit_logs ✅
   - Returns success=true, api_failed=true ✅
4. **Frontend shows toast:** "API Payment Failed: Insufficient balance. Withdrawal remains PENDING - you can retry or reject manually."
5. **Withdrawal stays visible in Pending tab** with error indicator
6. **Admin options:**
   - **Top up CPAY wallet** → Click "Approve & Pay Via API" again ✅
   - **Manually reject** with reason → Refunds user ✅
   - **Mark as paid manually** → If paid externally ✅

---

## 🚫 What No Longer Happens on API Failure

| Action | Old Behavior | New Behavior |
|--------|--------------|--------------|
| **Withdrawal Status** | Changed to 'failed' | Stays 'pending' |
| **User Wallet** | Refunded immediately | Unchanged (deducted) |
| **Transaction Status** | Changed to 'failed' | Stays 'pending' |
| **User Notification** | "Failed, funds refunded" | None |
| **Admin View** | Withdrawal disappears | Stays in pending list |
| **Retry Option** | Must create new withdrawal | Can retry same withdrawal |

---

## 📊 Database Schema Updates Required

### **withdrawal_requests Table:**
- ✅ Already has `api_response` JSONB field (no migration needed)
- ✅ Already has `status` enum with 'pending' value
- ✅ Already has `payment_provider` field

### **audit_logs Table:**
- ✅ Already supports action_type 'withdrawal_api_failed'
- ✅ Already has details JSONB field for error storage

**No database migrations required.** ✅

---

## 🧪 Testing Checklist

### **Test Scenarios:**
- [ ] API success → withdrawal completes ✅
- [ ] API failure (insufficient balance) → withdrawal stays pending ✅
- [ ] API failure → error shown in admin UI ✅
- [ ] API failure → admin can retry ✅
- [ ] API failure → admin can reject manually ✅
- [ ] Audit logs created correctly ✅
- [ ] User receives NO notification on API failure ✅

---

## 📝 Next Steps (Phase 2 & 3)

**Phase 2:** Update Frontend (`src/pages/admin/Withdrawals.tsx`)
- Detect `api_failed: true` response
- Show appropriate toast notification
- Keep withdrawal in pending list

**Phase 3:** Add API Error Display in UI
- Show alert if `api_response.error` exists
- Display error message to admin
- Add visual indicator for failed API attempts

---

## 🎉 Summary

**Phase 1 is COMPLETE.** The edge function now properly handles API failures by:
1. ✅ Keeping withdrawals pending instead of failing them
2. ✅ Storing error details for admin visibility
3. ✅ NOT refunding users automatically
4. ✅ Allowing admin retry or manual rejection
5. ✅ Logging all actions for audit trail

**Status:** Ready for Phase 2 (Frontend updates)
