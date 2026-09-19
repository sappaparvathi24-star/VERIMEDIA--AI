-- =============================================================================
-- VeriMedia AI — Supabase PostgreSQL Schema & Security Policies
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Multi-Tenant Organizations & Profiles
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'ENTERPRISE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'ANALYST',
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: Automatically provision an Organization and Profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    org_name TEXT;
BEGIN
    org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', split_part(NEW.email, '@', 1) || ' Organization');
    
    INSERT INTO public.organizations (name)
    VALUES (org_name)
    RETURNING id INTO new_org_id;

    INSERT INTO public.profiles (id, org_id, role, email, full_name)
    VALUES (
        NEW.id,
        new_org_id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'ANALYST'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. Core Provenance & Investigation Tables (Dedicated Schema Columns)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.investigations (
    id TEXT PRIMARY KEY,
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    lead_investigator TEXT DEFAULT 'ANALYST',
    is_demo BOOLEAN DEFAULT FALSE,
    forensic_confidence NUMERIC,
    provenance_confidence NUMERIC,
    earliest_observed_appearance_id TEXT,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    limitations_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_artifacts (
    id TEXT PRIMARY KEY,
    investigation_id TEXT REFERENCES public.investigations(id) ON DELETE CASCADE,
    filename TEXT,
    byte_size BIGINT DEFAULT 0,
    mime_type TEXT,
    sha256 TEXT NOT NULL,
    phash TEXT,
    acquisition_method TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    is_demo BOOLEAN DEFAULT FALSE,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    limitations_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Generic JSONB Store Tables (17 Sub-Resource Entity Types)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.observations (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evidence (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.findings (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sources (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appearances (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_versions (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.artifact_relationships (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.claims (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discovery_jobs (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discovery_candidates (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transformations (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.propagation_events (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.propagation_relationships (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.monitoring_jobs (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alerts (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_audit_records (
    id TEXT PRIMARY KEY,
    investigation_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. Audit Trail Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transformations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propagation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propagation_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper to get caller's organization ID
CREATE OR REPLACE FUNCTION public.auth_user_org_id()
RETURNS UUID AS $$
    SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users can read their own profile and profiles in their org
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT USING (id = auth.uid() OR org_id = public.auth_user_org_id());

-- Investigations: org-scoped access + global demo access
CREATE POLICY "Org access on investigations" ON public.investigations
    FOR ALL USING (org_id IS NULL OR org_id = public.auth_user_org_id());

-- Service role bypasses RLS for automated background sync and snapshots
