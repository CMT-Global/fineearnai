# Deployment Guide for Edge Functions

## Issue: Project Not Accessible

The project `mobikymhzchzakwzpqep` is not in your accessible projects list. 

**Your accessible projects:**
- `ajjhwammuqxgwruwofdv` - sk2011-ship-it's Project
- `teodxmbgwdotbcygnzll` - n8n-retell
- `amzsbzalratnltylunam` - caretalk-administration-db
- `lmlysjqziosiqhlfiogf` - sk2011-ship-it's Project
- `ikxzlmovmrqqkgmziulg` - saurabh.excel2011@gmail.com's Project

---

## Option 1: Get Access to the Project

1. **Contact the project owner** to add you as a collaborator
2. **Or** log in with the account that has access to `mobikymhzchzakwzpqep`
3. **Or** check if the project is in a different organization

---

## Option 2: Deploy via Supabase Dashboard

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select project: `mobikymhzchzakwzpqep` (if you have access)
3. Navigate to **Edge Functions**

### Step 2: Deploy Function
1. Click **"Create a new function"** or find `send-verification-otp`
2. If function exists, click **"Edit"**
3. Copy the code from: `supabase/functions/send-verification-otp/index.ts`
4. Paste into the editor
5. Click **"Deploy"**

### Step 3: Set Environment Variables
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Ensure these secrets are set:
   - `RESEND_API_KEY` - Your Resend API key
   - `SUPABASE_URL` - Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key
   - `HOOK_SECRET` - Secret for auth hook (if using)

---

## Option 3: Use Supabase CLI with Different Account

If you have access with a different account:

```bash
# Logout current account
supabase logout

# Login with account that has access
supabase login

# Link to project
supabase link --project-ref mobikymhzchzakwzpqep

# Deploy function
supabase functions deploy send-verification-otp
```

---

## Option 4: Deploy All Functions

Once linked, deploy all functions:

```bash
# Deploy specific function
supabase functions deploy send-verification-otp

# Deploy all functions
supabase functions deploy

# Deploy with no verify (if needed)
supabase functions deploy send-verification-otp --no-verify-jwt
```

---

## Option 5: Run Migrations

After linking, run migrations:

```bash
# Push all migrations
supabase db push

# Or reset and apply all migrations
supabase db reset
```

---

## Quick Deploy Script

If you get access, you can use this:

```bash
# 1. Link to project
supabase link --project-ref mobikymhzchzakwzpqep

# 2. Deploy the verification function
supabase functions deploy send-verification-otp

# 3. Deploy the email template function (dependency)
supabase functions deploy send-template-email

# 4. Push database migrations
supabase db push
```

---

## Verify Deployment

After deployment, verify:

1. **Check function exists:**
   - Go to Supabase Dashboard → Edge Functions
   - Verify `send-verification-otp` is listed

2. **Test the function:**
   - Use the test button in dashboard
   - Or call from your frontend

3. **Check logs:**
   - Go to Edge Functions → `send-verification-otp` → Logs
   - Look for execution logs

---

## Troubleshooting

### "Project not found"
- Verify project ID: `mobikymhzchzakwzpqep`
- Check you have access to the project
- Try logging in with different account

### "Permission denied"
- Ask project owner to add you as collaborator
- Check your role in the project (Admin, Developer, etc.)

### "Function deployment failed"
- Check function code for syntax errors
- Verify all dependencies are available
- Check environment variables are set

---

## Next Steps

1. **Get access** to project `mobikymhzchzakwzpqep`
2. **Link** the project: `supabase link --project-ref mobikymhzchzakwzpqep`
3. **Deploy** the function: `supabase functions deploy send-verification-otp`
4. **Test** the function from your frontend






