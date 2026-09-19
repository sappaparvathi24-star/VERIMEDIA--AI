// VeriMedia AI — Supabase Backend Service Role Client
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

export const supabaseAdmin = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export const supabaseAnon = isSupabaseConfigured && process.env.SUPABASE_ANON_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY)
  : supabaseAdmin;

if (isSupabaseConfigured) {
  console.log('⚡ [Supabase] Client initialized with service role.');
} else {
  console.log('ℹ️ [Supabase] Environment variables not provided. Operating in high-speed in-memory mode.');
}
