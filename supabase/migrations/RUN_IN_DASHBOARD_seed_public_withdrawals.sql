-- =============================================================================
-- ProfitChips Public Withdrawals Seed Script (v2 - Fixed)
-- Batch ID: pc-withdrawals-seed-v1
-- Records: 230 completed withdrawals across 11 Sundays (Feb 15 – Apr 26, 2026)
-- =============================================================================
-- Rollback (3 steps):
--   DELETE FROM public.withdrawal_requests WHERE metadata->>'seed_batch' = 'pc-withdrawals-seed-v1';
--   DELETE FROM public.profiles WHERE email LIKE '%@pc-seed.local';
--   DELETE FROM auth.users WHERE email LIKE '%@pc-seed.local';
-- =============================================================================
-- Run in Supabase SQL Editor (Role: postgres — runs as superuser, bypasses RLS)
-- =============================================================================

DO $$
DECLARE
  -- 30 seed user UUIDs (generated once, reused for all steps)
  u UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  ];

  -- Parallel arrays: username, ISO country code, country display name
  unames TEXT[] := ARRAY[
    'marcelino_ph','janine_ph','rodrigo_ph','aiko_ph','kristopher_ph','florencia_ph',
    'budi_id','siti_id','agus_id','dewi_id','rizky_id',
    'nguyen_vn','thi_vn','minh_vn','linh_vn','phuong_vn',
    'jisoo_kr','hyun_kr','minho_kr',
    'dmitri_ru','natasha_ru','olga_ru','ivan_ru',
    'kwame_gh','abena_gh','kofi_gh',
    'shanique_jm','tristan_tt','aaliyah_bb','caleb_bs'
  ];
  ucodes TEXT[] := ARRAY[
    'PH','PH','PH','PH','PH','PH',
    'ID','ID','ID','ID','ID',
    'VN','VN','VN','VN','VN',
    'KR','KR','KR',
    'RU','RU','RU','RU',
    'GH','GH','GH',
    'JM','TT','BB','BS'
  ];
  unames_full TEXT[] := ARRAY[
    'Philippines','Philippines','Philippines','Philippines','Philippines','Philippines',
    'Indonesia','Indonesia','Indonesia','Indonesia','Indonesia',
    'Vietnam','Vietnam','Vietnam','Vietnam','Vietnam',
    'South Korea','South Korea','South Korea',
    'Russia','Russia','Russia','Russia',
    'Ghana','Ghana','Ghana',
    'Jamaica','Trinidad and Tobago','Barbados','Bahamas'
  ];

  -- 11 Sundays: Feb 15 – Apr 26, 2026
  -- (Feb 15 added so February has two weeks of history)
  sundays TIMESTAMPTZ[] := ARRAY[
    '2026-02-15 00:00:00+00'::TIMESTAMPTZ,
    '2026-02-22 00:00:00+00'::TIMESTAMPTZ,
    '2026-03-01 00:00:00+00'::TIMESTAMPTZ,
    '2026-03-08 00:00:00+00'::TIMESTAMPTZ,
    '2026-03-15 00:00:00+00'::TIMESTAMPTZ,
    '2026-03-22 00:00:00+00'::TIMESTAMPTZ,
    '2026-03-29 00:00:00+00'::TIMESTAMPTZ,
    '2026-04-05 00:00:00+00'::TIMESTAMPTZ,
    '2026-04-12 00:00:00+00'::TIMESTAMPTZ,
    '2026-04-19 00:00:00+00'::TIMESTAMPTZ,
    '2026-04-26 00:00:00+00'::TIMESTAMPTZ
  ];

  -- Payment methods (raw DB values as stored in payment_method column)
  methods TEXT[] := ARRAY[
    'mpesa','mpesa','mpesa',
    'payeer','payeer',
    'usdt-bep20','usdt-bep20',
    'mobile_money','mobile_money',
    'bank_transfer'
  ];

  -- Placeholder for payout_address (NOT NULL, never shown publicly)
  payout_placeholder TEXT := 'REDACTED_SEED';

  i       INT;
  ui      INT;
  si      INT;
  mi      INT;
  amt     NUMERIC;
  net     NUMERIC;
  fee     NUMERIC;
  ts_base TIMESTAMPTZ;
  ts_proc TIMESTAMPTZ;
  ts_cre  TIMESTAMPTZ;
  rand_hr INT;
  rand_mi INT;
  rand_sc INT;

BEGIN

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 1: Insert seed auth users
  -- Uses ON CONFLICT (email) DO NOTHING — safe to re-run
  -- NOTE: The on_auth_user_created trigger will fire and auto-create
  --       a profile with a generic username. Step 2 overwrites it.
  -- ═══════════════════════════════════════════════════════════════════
  FOR i IN 1..30 LOOP
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data,
      role,
      aud
    ) VALUES (
      u[i],
      '00000000-0000-0000-0000-000000000000',
      unames[i] || '@pc-seed.local',
      crypt('seed_password_not_real', gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('username', unames[i]),
      'authenticated',
      'authenticated'
    )
    ON CONFLICT (email) DO NOTHING;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 2: Upsert profiles with correct usernames and country data
  -- Uses DO UPDATE SET — overwrites the trigger-created generic profile
  -- so the public page shows "ma***" (marcelino_ph) not "us***" (user_xxx)
  -- ═══════════════════════════════════════════════════════════════════
  FOR i IN 1..30 LOOP
    -- Re-resolve the UUID for this user from email (safe since ON CONFLICT
    -- above may have preserved an existing user with a different UUID)
    INSERT INTO public.profiles (
      id,
      username,
      email,
      country,
      registration_country,
      registration_country_name,
      referral_code,
      membership_plan,
      created_at
    )
    SELECT
      au.id,
      unames[i],
      unames[i] || '@pc-seed.local',
      ucodes[i],
      ucodes[i],
      unames_full[i],
      upper(substr(md5(unames[i] || 'seed_v2'), 1, 8)),
      'free',
      now() - interval '120 days'
    FROM auth.users au
    WHERE au.email = unames[i] || '@pc-seed.local'
    ON CONFLICT (id) DO UPDATE SET
      username                  = EXCLUDED.username,
      country                   = EXCLUDED.country,
      registration_country      = EXCLUDED.registration_country,
      registration_country_name = EXCLUDED.registration_country_name;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 3: Insert 230 withdrawal records
  -- Distribution: 21 records × 10 Sundays + 20 records × 1 Sunday = 230
  -- Most recent Sunday (Apr 26) is index 11 → gets 20 records
  -- ═══════════════════════════════════════════════════════════════════
  FOR i IN 1..230 LOOP

    -- Sunday index: first 210 records = 21 each across sundays 1–10
    -- Records 211–230 = 20 records on sunday 11 (Apr 26, most recent)
    IF i <= 210 THEN
      si := ((i - 1) / 21) + 1;
    ELSE
      si := 11;
    END IF;

    -- Resolve the actual user_id from auth.users (handles ON CONFLICT DO NOTHING case)
    ui := ((i - 1) % 30) + 1;

    -- Payment method cycles
    mi := ((i - 1) % array_length(methods, 1)) + 1;

    -- Random time on that Sunday: 06:00–22:59 (realistic payout window)
    rand_hr := floor(random() * 16 + 6)::INT;
    rand_mi := floor(random() * 60)::INT;
    rand_sc := floor(random() * 60)::INT;

    ts_base := sundays[si] + make_interval(
      hours => rand_hr,
      mins  => rand_mi,
      secs  => rand_sc
    );

    -- processed_at = 5–90 minutes after created_at (admin review window)
    ts_proc := ts_base + make_interval(mins => floor(random() * 85 + 5)::INT);
    ts_cre  := ts_base;

    -- Amount: $50–$897 in whole dollars, 2% fee matches platform config
    amt := (floor(random() * 848) + 50)::NUMERIC;
    fee := round(amt * 0.02, 2);
    net := amt - fee;

    INSERT INTO public.withdrawal_requests (
      id,
      user_id,
      amount,
      net_amount,
      fee,
      payout_address,
      payment_method,
      status,
      processed_at,
      created_at,
      updated_at,
      metadata
    )
    SELECT
      gen_random_uuid(),
      au.id,                 -- resolved from email, not hardcoded UUID
      amt,
      net,
      fee,
      payout_placeholder,
      methods[mi],
      'completed',
      ts_proc,
      ts_cre,
      ts_proc,
      jsonb_build_object(
        'seed_batch', 'pc-withdrawals-seed-v1',
        'seed_index',  i
      )
    FROM auth.users au
    WHERE au.email = unames[ui] || '@pc-seed.local';

  END LOOP;

  RAISE NOTICE '✅ Seed complete: 30 seed users + 230 completed withdrawals inserted.';
  RAISE NOTICE 'Verify: SELECT count(*) FROM withdrawal_requests WHERE metadata->>''seed_batch'' = ''pc-withdrawals-seed-v1'';';
  RAISE NOTICE 'Rollback: DELETE FROM withdrawal_requests WHERE metadata->>''seed_batch'' = ''pc-withdrawals-seed-v1'';';

END $$;
