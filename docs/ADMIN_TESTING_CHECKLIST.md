# Admin User Management - Comprehensive Testing Checklist

## Pre-Testing Setup
- [ ] Ensure you have admin access
- [ ] Clear browser cache
- [ ] Check console for any existing errors
- [ ] Verify database has test users with different plans and statuses
- [ ] Open browser DevTools (F12) to monitor network and console

---

## 1. User List Page (`/admin/users`)

### 1.1 Page Load
- [ ] Page loads without errors
- [ ] Stats cards display correct numbers
- [ ] User table loads with data
- [ ] Pagination displays correctly if more than 20 users

### 1.2 Search Functionality
- [ ] Search by username (partial match)
- [ ] Search by email (partial match)
- [ ] Search by full name
- [ ] Debounce works (wait 500ms before search triggers)
- [ ] Results update correctly
- [ ] Clear search returns all users

### 1.3 Filters
- [ ] **Plan Filter**:
  - [ ] Filter by "Free" plan
  - [ ] Filter by "Basic" plan
  - [ ] Filter by "Premium" plan
  - [ ] Filter by "VIP" plan
  - [ ] "All Plans" shows all users
- [ ] **Status Filter**:
  - [ ] Filter by "Active" status
  - [ ] Filter by "Suspended" status
  - [ ] Filter by "Banned" status
  - [ ] "All Status" shows all users
- [ ] **Country Filter**:
  - [ ] Enter country name
  - [ ] Results filter correctly
  - [ ] Clear filter returns all users

### 1.4 Sorting
- [ ] Sort by Username (ASC/DESC)
- [ ] Sort by Email (ASC/DESC)
- [ ] Sort by Membership Plan (ASC/DESC)
- [ ] Sort by Total Earned (ASC/DESC)
- [ ] Sort by Joined Date (ASC/DESC)
- [ ] Arrow icon indicates sort direction

### 1.5 Pagination
- [ ] Click "Next" page
- [ ] Click "Previous" page
- [ ] Click specific page number
- [ ] First page button disabled on page 1
- [ ] Last page button disabled on last page
- [ ] Page numbers update correctly

### 1.6 User Selection
- [ ] Select individual user checkbox
- [ ] Checkbox state updates correctly
- [ ] Select all users checkbox
- [ ] Select all works correctly
- [ ] Deselect all works correctly
- [ ] Selected count displays correctly

### 1.7 Bulk Actions Bar
- [ ] Bulk actions bar appears when users selected
- [ ] Selected count is accurate
- [ ] "Clear Selection" button works
- [ ] "Update Plan" button opens dialog
- [ ] "Suspend Users" button opens dialog
- [ ] "Export Selected" downloads CSV file

### 1.8 Export
- [ ] Export all users (no selection) downloads CSV
- [ ] CSV file contains correct data
- [ ] CSV file has proper formatting
- [ ] Export selected users downloads correct data

### 1.9 Navigation
- [ ] Click eye icon opens user detail page
- [ ] User detail page loads correct user
- [ ] Back button returns to user list
- [ ] Filters persist when returning (if applicable)

---

## 2. User Detail Page (`/admin/users/:userId`)

### 2.1 Page Load
- [ ] Page loads without errors
- [ ] Username displays correctly in header
- [ ] Email displays correctly in header
- [ ] Status badge shows correct status and color
- [ ] All tabs render

### 2.2 Overview Tab
- [ ] **Profile Information Card**:
  - [ ] Displays full name
  - [ ] Displays email
  - [ ] Displays country
  - [ ] Displays phone number
  - [ ] Displays joined date
  - [ ] Displays last login
- [ ] **Membership Information Card**:
  - [ ] Displays current plan
  - [ ] Displays plan expiry date
  - [ ] Displays account status
  - [ ] "Change Plan" button opens dialog
  - [ ] "Suspend/Unsuspend" button works
- [ ] **Account Actions Card**:
  - [ ] All action buttons display
  - [ ] Master Login button works
  - [ ] Reset Limits button triggers action

### 2.3 Financial Tab
- [ ] **Wallet Balances Card**:
  - [ ] Deposit wallet balance displays correctly
  - [ ] Earnings wallet balance displays correctly
  - [ ] "Adjust Wallet" button opens dialog
- [ ] **Earnings Summary Card**:
  - [ ] Total earned displays
  - [ ] Task earnings display
  - [ ] Referral earnings display
  - [ ] Group earnings display (if applicable)
- [ ] **Recent Financial Activity**:
  - [ ] Recent transactions list displays
  - [ ] Transaction types show correctly
  - [ ] Amounts display correctly
  - [ ] Dates display correctly

### 2.4 Tasks & Activity Tab
- [ ] **Task Statistics Card**:
  - [ ] Total tasks completed
  - [ ] Tasks completed today
  - [ ] Daily task limit
  - [ ] Accuracy percentage
  - [ ] Progress bar displays correctly
- [ ] **Daily Progress Card**:
  - [ ] Shows tasks remaining today
  - [ ] Shows skips used/remaining
  - [ ] Progress indicators correct
- [ ] **Recent Tasks List**:
  - [ ] Displays recent task completions
  - [ ] Shows task correctness
  - [ ] Shows earnings per task
  - [ ] Shows completion timestamp

### 2.5 Referrals Tab
- [ ] **Referral Statistics Card**:
  - [ ] Total referrals count
  - [ ] Active referrals count
  - [ ] Total commission earned
  - [ ] Displays correctly
- [ ] **Upline Information**:
  - [ ] Shows upline (referrer) if exists
  - [ ] Shows "No upline" if not referred
  - [ ] "Change Upline" button present
- [ ] **Referral List**:
  - [ ] Displays list of referred users
  - [ ] Shows referral username
  - [ ] Shows referral status
  - [ ] Shows commission earned from each
  - [ ] Pagination works if many referrals

### 2.6 Transactions Tab
- [ ] **Transaction List**:
  - [ ] All transactions display
  - [ ] Correct transaction types
  - [ ] Correct amounts (positive/negative)
  - [ ] Correct dates
  - [ ] Correct wallet types
  - [ ] Status badges display correctly
- [ ] **Filters** (if implemented):
  - [ ] Filter by transaction type
  - [ ] Filter by wallet type
  - [ ] Filter by date range
- [ ] **Pagination**:
  - [ ] Pagination works for large transaction lists

### 2.7 Activity Logs Tab
- [ ] Activity logs load
- [ ] Displays activity type
- [ ] Displays timestamp
- [ ] Displays IP address
- [ ] Displays details (JSON)
- [ ] Recent activities show first
- [ ] Empty state if no logs

### 2.8 Master Login
- [ ] Click "Master Login" button
- [ ] Toast shows "copied to clipboard"
- [ ] URL copied to clipboard
- [ ] URL format is correct
- [ ] (Optional) Test URL in incognito - should log in as that user

---

## 3. Wallet Adjustment Dialog

### 3.1 Dialog Open/Close
- [ ] Opens when "Adjust Wallet" clicked
- [ ] Displays correct username
- [ ] Displays current balances
- [ ] Close button works
- [ ] Cancel button works
- [ ] Clicking outside closes dialog (if enabled)

### 3.2 Wallet Type Selection
- [ ] Deposit wallet option selectable
- [ ] Earnings wallet option selectable
- [ ] Current balance updates when switching
- [ ] Radio button visual state correct

### 3.3 Amount Input
- [ ] Can enter positive number (credit)
- [ ] Can enter negative number (debit)
- [ ] Label changes to "(Credit)" or "(Debit)"
- [ ] Cannot enter non-numeric characters
- [ ] Decimal input works (e.g., 10.50)

### 3.4 Balance Preview
- [ ] Preview card appears when amount entered
- [ ] Current balance displays correctly
- [ ] Adjustment amount displays correctly
- [ ] New balance calculates correctly
- [ ] Green color for credit, red for debit
- [ ] Arrow icon displays correctly

### 3.5 Reason Input
- [ ] Can enter reason text
- [ ] Character count displays (X/500)
- [ ] Cannot exceed 500 characters
- [ ] Required field validation

### 3.6 Validation
- [ ] Cannot submit with empty amount
- [ ] Cannot submit with zero amount
- [ ] Cannot submit with empty reason
- [ ] Error messages display for invalid inputs

### 3.7 Submission
- [ ] "Apply Adjustment" button disabled until valid
- [ ] Button shows "Processing..." during submission
- [ ] Success toast appears on success
- [ ] Error toast appears on failure
- [ ] Dialog closes on success
- [ ] User detail page refreshes with new balance
- [ ] Transaction appears in transaction history

---

## 4. Change Plan Dialog

### 4.1 Dialog Open/Close
- [ ] Opens when "Change Plan" clicked
- [ ] Displays correct username
- [ ] Displays current plan
- [ ] Displays current expiry date
- [ ] Close/Cancel works

### 4.2 Plan Selection
- [ ] Dropdown shows all available plans
- [ ] Can select different plan
- [ ] Current plan is indicated
- [ ] Plan descriptions show (if applicable)

### 4.3 Expiry Date
- [ ] Date picker opens
- [ ] Can select future date
- [ ] Cannot select past date (validation)
- [ ] Selected date displays correctly

### 4.4 Validation
- [ ] Must select a plan
- [ ] Must select a future date
- [ ] Error messages for validation failures

### 4.5 Submission
- [ ] "Update Plan" button works
- [ ] Shows "Updating..." during process
- [ ] Success toast on success
- [ ] Error toast on failure
- [ ] Dialog closes on success
- [ ] User detail refreshes with new plan
- [ ] New expiry date reflects in overview

---

## 5. Suspend User Dialog

### 5.1 Dialog Open/Close
- [ ] Opens when "Suspend" clicked
- [ ] Displays correct username and status
- [ ] Close/Cancel works

### 5.2 Current Status Display
- [ ] Shows current status (Active/Suspended)
- [ ] Color coding correct

### 5.3 Action Toggle
- [ ] If active, shows "Suspend" action
- [ ] If suspended, shows "Unsuspend" action
- [ ] Dialog content changes based on action

### 5.4 Reason Input
- [ ] Optional reason field present
- [ ] Character limit (500) enforced
- [ ] Character count displays

### 5.5 Submission
- [ ] "Suspend User" or "Unsuspend User" button works
- [ ] Loading state during processing
- [ ] Success toast with message
- [ ] Error toast on failure
- [ ] Dialog closes on success
- [ ] Status badge updates in user detail header
- [ ] Activity log entry created

---

## 6. Ban User Dialog

### 6.1 Dialog Open/Close
- [ ] Opens when "Ban User" clicked
- [ ] Displays severe warning
- [ ] Displays user info (username, email, ID)
- [ ] Close/Cancel works

### 6.2 Warning Alert
- [ ] Warning alert displays prominently
- [ ] Lists consequences of ban
- [ ] Uses destructive color scheme

### 6.3 Ban Reason Input
- [ ] Reason textarea present
- [ ] Placeholder text helpful
- [ ] Character limit (1000) enforced
- [ ] Character count displays
- [ ] Required field

### 6.4 Confirmation Checkbox
- [ ] Checkbox present with confirmation text
- [ ] Must be checked to enable submit
- [ ] Checkbox state visual feedback

### 6.5 Validation
- [ ] Cannot submit without reason (min 20 chars)
- [ ] Cannot submit without checkbox checked
- [ ] Error feedback for validation failures

### 6.6 Submission
- [ ] "Ban User Permanently" button disabled until valid
- [ ] Shows "Banning User..." during process
- [ ] Success toast on success
- [ ] Error toast on failure
- [ ] Dialog closes on success
- [ ] User status changes to "banned"
- [ ] User cannot log in (test separately)
- [ ] Activity log entry created with reason

---

## 7. Bulk Update Plan Dialog

### 7.1 Dialog Open/Close
- [ ] Opens when "Update Plan" clicked in bulk bar
- [ ] Displays selected user count
- [ ] Close/Cancel works

### 7.2 Plan Selection
- [ ] Dropdown shows all plans
- [ ] Can select target plan
- [ ] Plan is required

### 7.3 Expiry Date
- [ ] Date picker works
- [ ] Must select future date
- [ ] Validation error for past dates

### 7.4 Validation
- [ ] Plan selection required
- [ ] Expiry date required
- [ ] Future date validation

### 7.5 Submission
- [ ] "Update X Users" button correct count
- [ ] Shows "Updating..." during process
- [ ] Success toast with count
- [ ] Error toast on failure
- [ ] Dialog closes on success
- [ ] User list refreshes
- [ ] Selected users deselected
- [ ] All affected users have new plan

---

## 8. Bulk Suspend Dialog

### 8.1 Dialog Open/Close
- [ ] Opens when "Suspend" clicked in bulk bar
- [ ] Displays selected user count
- [ ] Close/Cancel works

### 8.2 Reason Input
- [ ] Optional reason field
- [ ] Character limit (500)
- [ ] Character count displays

### 8.3 Submission
- [ ] "Suspend X Users" button correct count
- [ ] Shows "Suspending..." during process
- [ ] Success toast with count
- [ ] Error toast on failure
- [ ] Dialog closes on success
- [ ] User list refreshes
- [ ] Selected users deselected
- [ ] All affected users suspended

---

## 9. Error Handling

### 9.1 Network Errors
- [ ] Test with network offline
- [ ] Error toast displays
- [ ] User-friendly error message
- [ ] No app crash

### 9.2 Validation Errors
- [ ] Client-side validation works
- [ ] Error messages clear and helpful
- [ ] Fields highlighted on error

### 9.3 Server Errors
- [ ] Test with invalid user ID
- [ ] Test with unauthorized action
- [ ] Error toast displays
- [ ] No app crash

### 9.4 Error Boundary
- [ ] Triggers on unhandled errors
- [ ] Displays error fallback UI
- [ ] Reload button works
- [ ] Home button works
- [ ] Error logged to console

---

## 10. Performance

### 10.1 Load Times
- [ ] User list loads < 1s
- [ ] User detail loads < 1s
- [ ] Search responds < 500ms (with debounce)
- [ ] Dialogs open instantly (< 100ms)

### 10.2 Responsiveness
- [ ] No UI freezing
- [ ] Smooth animations
- [ ] Button clicks responsive
- [ ] Pagination smooth

### 10.3 Monitoring
- [ ] Open browser console
- [ ] Check for performance warnings
- [ ] Use Performance tab to profile
- [ ] Check adminMonitor.getPerformanceSummary() in console

---

## 11. Mobile Responsiveness

### 11.1 User List (Mobile)
- [ ] Stats cards stack vertically
- [ ] Filters stack vertically
- [ ] Table scrolls horizontally if needed
- [ ] Bulk actions bar adapts
- [ ] Pagination usable

### 11.2 User Detail (Mobile)
- [ ] Tabs scroll horizontally
- [ ] Cards stack vertically
- [ ] Buttons appropriately sized
- [ ] Dialogs fit screen
- [ ] Text readable

### 11.3 Dialogs (Mobile)
- [ ] Dialogs fit screen
- [ ] Inputs accessible
- [ ] Buttons accessible
- [ ] Scrollable if content overflows

---

## 12. Accessibility

### 12.1 Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter key activates buttons
- [ ] Escape key closes dialogs
- [ ] Focus indicators visible

### 12.2 Screen Reader
- [ ] Page titles announced
- [ ] Button labels clear
- [ ] Form labels associated
- [ ] Error messages announced

### 12.3 Color Contrast
- [ ] Text readable on backgrounds
- [ ] Status badges have sufficient contrast
- [ ] Buttons have sufficient contrast

---

## 13. Security

### 13.1 Input Validation
- [ ] XSS attempt blocked (enter `<script>alert('xss')</script>`)
- [ ] HTML tags stripped from inputs
- [ ] SQL injection patterns rejected
- [ ] Amount limits enforced

### 13.2 Access Control
- [ ] Non-admin redirected to dashboard
- [ ] Unauthenticated redirected to login
- [ ] Cannot access other admin user data (test if applicable)

### 13.3 CSRF Protection
- [ ] Supabase handles CSRF automatically
- [ ] No exposed sensitive data in console (in production)

---

## 14. Data Integrity

### 14.1 Wallet Adjustments
- [ ] Balance updates correctly in database
- [ ] Transaction record created
- [ ] Audit log entry created
- [ ] Cannot adjust to negative balance (if enforced)

### 14.2 Plan Changes
- [ ] Plan updates in database
- [ ] Expiry date updates correctly
- [ ] Old plan data not lost (audit trail)

### 14.3 Suspensions/Bans
- [ ] Status updates correctly
- [ ] Reason stored in audit log
- [ ] User cannot log in after ban
- [ ] Referrals still linked (but inactive)

---

## 15. Final Checks

- [ ] No console errors on any page
- [ ] No console warnings (except dev-only)
- [ ] All TypeScript errors resolved
- [ ] All features documented
- [ ] Code commented where complex
- [ ] Performance acceptable
- [ ] Security measures in place
- [ ] Error handling comprehensive
- [ ] User experience smooth
- [ ] Ready for production

---

## Testing Sign-Off

**Tester Name**: _________________________

**Date**: _________________________

**Environment**: [ ] Development [ ] Staging [ ] Production

**Browser**: _________________________

**Device**: _________________________

**Overall Result**: [ ] PASS [ ] FAIL

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Blocker Issues Found**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
