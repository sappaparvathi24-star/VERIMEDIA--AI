// VeriMedia AI — Supabase Table Health & Verification Script
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const REQUIRED_TABLES = [
  'organizations',
  'profiles',
  'investigations',
  'media_artifacts',
  'analysis_runs',
  'observations',
  'evidence',
  'findings',
  'sources',
  'appearances',
  'media_versions',
  'artifact_relationships',
  'claims',
  'discovery_jobs',
  'discovery_candidates',
  'transformations',
  'propagation_events',
  'propagation_relationships',
  'monitoring_jobs',
  'alerts',
  'report_audit_records',
  'audit_log'
];

async function checkSchema() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  VERIMEDIA AI — SUPABASE POSTGRESQL TABLES VERIFICATION');
  console.log(`  Target Instance: ${supabaseUrl}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let missing = 0;

  for (const table of REQUIRED_TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
          console.log(`  ❌ Table [public.${table}]: NOT CREATED YET (Schema cache missing)`);
        } else {
          console.log(`  ⚠️ Table [public.${table}]: ${error.message} (${error.code || 'ERR'})`);
        }
        missing++;
      } else {
        console.log(`  ✅ Table [public.${table}]: READY & ACTIVE`);
        passed++;
      }
    } catch (err) {
      console.log(`  ❌ Table [public.${table}]: ${err.message}`);
      missing++;
    }
  }

  console.log('\n────────────────────────────────────────────────────────────────');
  console.log(`  Summary: ${passed}/${REQUIRED_TABLES.length} tables active.`);
  if (missing > 0) {
    console.log(`\n  👉 To create all missing tables:`);
    console.log(`     1. Open: https://supabase.com/dashboard/project/pcdlhawdbapiakrvmlib/sql/new`);
    console.log(`     2. Paste the contents of 'supabase/schema.sql'`);
    console.log(`     3. Click 'Run'`);
  } else {
    console.log('  ✨ All Supabase cloud tables are active and synchronized with VeriMedia AI!');
  }
  console.log('════════════════════════════════════════════════════════════════\n');
}

checkSchema();
