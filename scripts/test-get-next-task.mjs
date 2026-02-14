#!/usr/bin/env node
/**
 * Test get-next-task edge function.
 * Usage:
 *   node scripts/test-get-next-task.mjs
 *   TEST_USER_EMAIL=user@example.com TEST_USER_PASSWORD=secret node scripts/test-get-next-task.mjs
 *
 * Reads from .env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 * Optional env: TEST_USER_EMAIL, TEST_USER_PASSWORD (otherwise you'll be prompted or use existing token)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const content = readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...process.env, ...loadEnv() };
const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
const FUNC_URL = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/get-next-task` : '';

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.msg || json.error_description || json.message || JSON.stringify(json));
  }
  const token = json.access_token ?? json.data?.access_token;
  if (!token) {
    console.error('Auth response (no access_token):', JSON.stringify(json, null, 2));
    throw new Error('No access_token in auth response');
  }
  return token;
}

async function getNextTask(accessToken) {
  const res = await fetch(FUNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
    process.exit(1);
  }
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('Function URL:', FUNC_URL);

  let token = env.GET_NEXT_TASK_TOKEN;
  if (!token) {
    const email = env.TEST_USER_EMAIL || process.argv[2];
    const password = env.TEST_USER_PASSWORD || process.argv[3];
    if (!email || !password) {
      console.error('\nUsage: provide user credentials to get a task as that user.');
      console.error('  TEST_USER_EMAIL=... TEST_USER_PASSWORD=... node scripts/test-get-next-task.mjs');
      console.error('  or: node scripts/test-get-next-task.mjs <email> <password>');
      console.error('\nAlternatively set GET_NEXT_TASK_TOKEN to a valid JWT (e.g. from browser session).');
      process.exit(1);
    }
    console.log('Signing in as', email, '...');
    token = await signIn(email, password);
    console.log('Got access token.');
  }

  console.log('\nCalling get-next-task...');
  const result = await getNextTask(token);
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.body, null, 2));

  if (result.body?.error === 'profile_incomplete') {
    console.log('\n→ User must complete profile (profile wizard) to access tasks.');
  }
  if (result.body?.error === 'no_tasks_available' || (result.body?.success === false && !result.body?.task)) {
    console.log('\n→ No tasks returned. Check: (1) there are rows in ai_tasks with is_active = true, (2) user has not completed all of them.');
  }
  if (result.body?.task) {
    console.log('\n→ Task is being returned successfully.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
