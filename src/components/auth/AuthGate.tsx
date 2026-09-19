// VeriMedia AI — Authentication Gate & Multi-Tenant Login/Signup UI
import React, { useState, useEffect } from 'react';
import {
  getCurrentSession,
  signInWithEmail,
  signUpWithEmail,
  continueAsDemoGuest,
  signOutUser,
  isSupabaseConfigured,
  type AuthProfile
} from '../../lib/supabaseClient';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<{ profile: AuthProfile | null; token: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sess = await getCurrentSession();
      if (sess.user && sess.profile) {
        setSession({ profile: sess.profile, token: sess.token });
      } else {
        setSession(null);
      }
    } catch (err: any) {
      console.error('Session check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      await checkSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, orgName, fullName);
      await checkSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Signup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestDemo = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await continueAsDemoGuest();
      await checkSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize demo session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-slate-400 font-mono">Authenticating VeriMedia Node...</p>
        </div>
      </div>
    );
  }

  // If not logged in, render the Auth Dialog
  if (!session || !session.profile) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 font-sans overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-950/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-950/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-2 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-emerald-400 mb-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">VeriMedia AI</h1>
            <p className="text-xs text-slate-400">Forensic Provenance & Media Integrity Investigation Platform</p>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMsg(null); }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setErrorMsg(null); }}
              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register Lab / Org
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-md text-red-200 text-xs flex items-start gap-2">
              <span className="text-red-400 font-bold">✕</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">Full Name / Analyst Tag</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">Organization / Newsroom / Agency</label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Reuters Trust Lab"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@verimedia.org"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase rounded-md transition duration-150 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : mode === 'signin' ? (
                'Access Investigation Console'
              ) : (
                'Create Multi-Tenant Organization'
              )}
            </button>
          </form>

          {/* Instant Demo Sandbox Access */}
          <div className="pt-2 border-t border-slate-800/80 text-center space-y-2">
            <p className="text-xs text-slate-500">Evaluating or testing without credentials?</p>
            <button
              type="button"
              onClick={handleGuestDemo}
              disabled={submitting}
              className="w-full py-2 px-3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 rounded-md text-xs font-medium transition"
            >
              ⚡ Enter as Guest Analyst (Demo Sandbox)
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
            <span>Supabase: {isSupabaseConfigured ? '🟢 Connected' : '🟡 In-Memory Mode'}</span>
            <span>RLS Active</span>
          </div>
        </div>
      </div>
    );
  }

  // When authenticated, render app children + small top status bar or profile pill
  return (
    <div className="relative h-full w-full">
      {/* Floating Identity & Sign-Out Bar */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800/80 px-3 py-1.5 rounded-full shadow-lg text-xs font-mono text-slate-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-slate-400 truncate max-w-[120px]">{session.profile.email}</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/50 rounded font-semibold">
          {session.profile.role}
        </span>
        <button
          onClick={handleSignOut}
          title="Sign out of VeriMedia"
          className="ml-1 text-slate-400 hover:text-red-400 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {children}
    </div>
  );
}
