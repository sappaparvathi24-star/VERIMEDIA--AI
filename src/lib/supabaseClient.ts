// VeriMedia AI — Frontend Supabase Auth Client
import { createClient, type User, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

// Local fallback auth storage for demo / offline sandbox
const LOCAL_SESSION_KEY = 'verimedia_demo_session';

export interface AuthProfile {
  id: string;
  email: string;
  role: string;
  org_id: string;
  full_name?: string;
  organization_name?: string;
}

export async function getCurrentSession(): Promise<{ user: User | null; token: string | null; profile: AuthProfile | null }> {
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      return {
        user: session.user,
        token: session.access_token,
        profile: profile || {
          id: session.user.id,
          email: session.user.email || '',
          role: 'ANALYST',
          org_id: 'default-org'
        }
      };
    }
  }

  // Fallback demo local session
  const stored = localStorage.getItem(LOCAL_SESSION_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        user: { id: parsed.id, email: parsed.email } as User,
        token: parsed.token || 'demo-bearer-token',
        profile: parsed
      };
    } catch (_) {}
  }

  return { user: null, token: null, profile: null };
}

export async function getToken(): Promise<string | null> {
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  }
  const stored = localStorage.getItem(LOCAL_SESSION_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.token || 'demo-bearer-token';
    } catch (_) {}
  }
  return null;
}

export async function signInWithEmail(email: string, password: string) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // Simulated fallback login
  const mockUser: AuthProfile = {
    id: `usr_${Math.random().toString(36).substring(2, 9)}`,
    email,
    role: 'ANALYST',
    org_id: 'org_main',
    full_name: email.split('@')[0],
    organization_name: 'VeriMedia Trust Lab'
  };
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ ...mockUser, token: 'demo-bearer-token' }));
  return { user: { id: mockUser.id, email: mockUser.email } as User, session: { access_token: 'demo-bearer-token' } as Session };
}

export async function signUpWithEmail(email: string, password: string, organizationName?: string, fullName?: string) {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          organization_name: organizationName || `${email.split('@')[0]} Lab`,
          full_name: fullName || email.split('@')[0],
          role: 'ANALYST'
        }
      }
    });
    if (error) throw error;
    return data;
  }

  const mockUser: AuthProfile = {
    id: `usr_${Math.random().toString(36).substring(2, 9)}`,
    email,
    role: 'ANALYST',
    org_id: `org_${Math.random().toString(36).substring(2, 9)}`,
    full_name: fullName || email.split('@')[0],
    organization_name: organizationName || 'VeriMedia Trust Lab'
  };
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ ...mockUser, token: 'demo-bearer-token' }));
  return { user: { id: mockUser.id, email: mockUser.email } as User, session: { access_token: 'demo-bearer-token' } as Session };
}

export async function continueAsDemoGuest() {
  const guestUser: AuthProfile = {
    id: 'guest_analyst_id',
    email: 'guest@verimedia.ai',
    role: 'ANALYST',
    org_id: 'org_demo',
    full_name: 'Forensic Guest Analyst',
    organization_name: 'Public Verification Sandbox'
  };
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ ...guestUser, token: 'demo-bearer-token' }));
  return guestUser;
}

export async function signOutUser() {
  localStorage.removeItem(LOCAL_SESSION_KEY);
  if (supabase) {
    await supabase.auth.signOut();
  }
}
