# PR Review: Add input validation for name & phone number

**PR #1** · Branch: `feat/improvement` → `dev`

---

## Summary

The PR adds name and phone validation, a reusable `PhoneInputWithCountry` component, E.164 handling, and Vite env handling. The direction is good; the following points will make it consistent and correct.

---

## Typos and copy

### 1. `src/integrations/supabase/client.ts` – plural/singular

- **Issue:** Error message uses singular "environment variable" while two variables are checked.
- **Current (from diff):**  
  `'Missing Supabase environment variable. Please check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'`
- **Change:** Use plural: **"environment variables"**.

### 2. `src/pages/Settings.tsx` – wrong i18n key for empty state

- **Issue:** `emptyText={t("common.error")}` shows a generic "Error" when the country search has no results. That's misleading.
- **Recommendation:** Use a dedicated string for "no results", e.g. add `common.noCountryFound` (e.g. "No country found.") and use `t("common.noCountryFound")`, or pass the same default as in `EditProfileDialog`: `emptyText="No country found."` and add the key to locales later.

---

## Best practices and logic

### 3. `src/lib/auth-schema.ts` – phone validation vs message

- **Issue:** Refine allows `digits.length <= PHONE_NATIONAL_MAX + 4` (i.e. up to 22 digits) but the message says "between 8 and **18** digits (excluding country code)". So the message and the check don't match.
- **Recommendation:**  
  - If validation should be "national digits only, 8–18": remove the `+ 4` and use `digits.length <= PHONE_NATIONAL_MAX`.  
  - If you intentionally allow more (e.g. for formatting), document it and change the message to match (e.g. "8 to 22 digits").

### 4. `src/lib/auth-schema.ts` – single source of truth for phone limits

- **Issue:** `country-dial-codes.ts` exports `MIN_PHONE_DIGITS` / `MAX_PHONE_DIGITS` (8 / 18), while `auth-schema.ts` defines `PHONE_NATIONAL_MIN` / `PHONE_NATIONAL_MAX`. Duplication can drift.
- **Recommendation:** Import and use `MIN_PHONE_DIGITS` and `MAX_PHONE_DIGITS` from `@/lib/country-dial-codes` in the schema (and optionally use `validatePhoneNational` there) so limits and messages stay in sync.

### 5. `src/components/settings/PhoneInputWithCountry.tsx` – `useEffect` and controlled value

- **Issue:** The `useEffect` that syncs from `value` and `countryHint` runs on every change. If the parent (e.g. form state) updates `value` while the user is typing, this can overwrite local state and cause cursor jump or lost input.
- **Recommendation:** Consider syncing from props only when the value is "external" (e.g. initial load or after submit), not on every keystroke. For example:  
  - Use a ref to track "last value we initialized from" and only run the parse/sync when `value` differs from that and looks like a full E.164 from the server, or  
  - Only run the sync when `countryHint` changes or when `value` is empty and we're resetting.  
  This keeps the input controlled but avoids fighting the user's input.

### 6. `src/components/settings/PhoneInputWithCountry.tsx` – `maxLength`

- **Issue:** `maxLength={MAX_PHONE_DIGITS + 4}` is unclear (why +4?).
- **Recommendation:** Either use `MAX_PHONE_DIGITS` if you only allow digits, or add a short comment (e.g. "+4 for spaces/dashes if we allow formatting") so future readers know the intent.

### 7. `src/integrations/supabase/client.ts` – comment accuracy

- **Issue:** Comment says "Use env vars with fallbacks" but this file does not add fallbacks; fallbacks are in `vite.config.ts` via `define`.
- **Recommendation:** Reword the comment, e.g.: "Env vars are injected by Vite (see vite.config.ts); when .env isn't loaded (e.g. dev server cwd / OneDrive), define fallbacks in vite.config ensure the app still runs."

### 8. `vite.config.ts` – `loadEnv` prefix

- **Issue:** `loadEnv(mode, envDir, "")` uses an empty prefix, so all env vars are loaded. Only `VITE_SUPABASE_*` are used in `define`.
- **Recommendation:** For clarity and to avoid loading unnecessary vars, use prefix `"VITE_"` and then only read `env.VITE_SUPABASE_URL` and `env.VITE_SUPABASE_PUBLISHABLE_KEY`. Same behavior, clearer intent.

---

## What's working well

- **`PhoneInputWithCountry`**: Clear props, JSDoc, E.164 handling, and sensible defaults.
- **`country-dial-codes.ts`**: Good structure (list, helpers, validation), dial-code sorting for parsing, and handling of shared dial codes (e.g. US/CA) with `countryHint`.
- **Name validation**: Regex for letters, spaces, hyphens, apostrophes is clear and matches the error message.
- **EditProfileDialog** and **Settings** integration of `PhoneInputWithCountry` (value/onChange/countryHint) is consistent.
- **Vite `define`** for Supabase env helps when `.env` isn't loaded (e.g. cwd/OneDrive).

---

## Action items

| Priority | Item |
|----------|------|
| High | Fix typo: "environment variable" → "environment variables" in `client.ts`. |
| High | Align phone refine with message: either remove `+ 4` and keep "8–18 digits", or update the message to match the actual max. |
| Medium | Use `emptyText` for "No country found" in Settings (new i18n key or literal), not `t("common.error")`. |
| Medium | Use `MIN_PHONE_DIGITS` / `MAX_PHONE_DIGITS` from `country-dial-codes` in `auth-schema` (and optionally `validatePhoneNational`). |
| Low | Adjust `PhoneInputWithCountry` sync logic so it doesn't overwrite user input on every `value` change. |
| Low | Fix misleading "fallbacks" comment in `client.ts` and document `maxLength` (+4) in `PhoneInputWithCountry` if you keep it. |
