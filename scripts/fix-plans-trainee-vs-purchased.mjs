#!/usr/bin/env node
/**
 * Fix membership plans: Trainee = users who never purchased; others = from plan_upgrade (subscription).
 * Run the SQL in Supabase Dashboard → SQL Editor (or run the migration via supabase db push).
 *
 * Usage: node scripts/fix-plans-trainee-vs-purchased.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260215100000_fix_plans_trainee_vs_purchased.sql');

console.log('Fix plans: Trainee = never purchased, others = from subscription (plan_upgrade)\n');
console.log('Run the SQL below in Supabase Dashboard → SQL Editor:\n');
console.log('---');
console.log(readFileSync(migrationPath, 'utf8'));
console.log('---');
console.log('\n→ Copy the SQL above and run it in Supabase Dashboard → SQL Editor.');
