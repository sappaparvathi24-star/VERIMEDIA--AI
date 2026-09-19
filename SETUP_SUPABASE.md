# VeriMedia AI — Supabase Architecture & Migration Guide

This document explains the enterprise PostgreSQL & Row-Level Security (RLS) architecture powered by **Supabase** in VeriMedia AI.

---

## 1. Architecture Overview

VeriMedia AI utilizes Supabase to provide:
- **Cloud-Native PostgreSQL Storage**: Persistent relational & JSONB ledger backing all 19 provenance entity models.
- **Authentication & RBAC**: JWT session verification, cryptographic signatures, and role-based permissions (`ADMIN`, `INVESTIGATOR`, `ANALYST`, `AUDITOR`, `READONLY`).
- **Organization-Scoped Multi-Tenancy**: Automated schema-level triggers and RLS policies ensuring each organization or lab only accesses its own forensic evidence, claims, discovery runs, monitoring jobs, and reports.
- **Audit Logging**: Immutable action ledger stored in `public.audit_log`.
- **High-Performance In-Memory Hydration**: The Node.js application hydrates an in-memory graph at boot for sub-millisecond query execution, backed by continuous 10s background snapshotting and graceful shutdown flushes.

---

## 2. Database Schema (`supabase/schema.sql`)

The database consists of:
1. **Core Relational Tables**:
   - `public.organizations`: Organization / lab accounts with status, tier, and forensic settings.
   - `public.profiles`: Analyst user profiles tied to `auth.users`, with foreign keys to organizations.
   - `public.investigations`: Root investigation dossiers with metadata, forensic/provenance scores, and strict `org_id` isolation.
   - `public.media_artifacts`: Uploaded media files, SHA-256 hashes, perceptual hashes (pHash), byte sizes, and metadata.
   - `public.audit_log`: Tamper-evident forensic audit trail.
2. **17 Generic JSONB Provenance Collections**:
   - `analysis_runs`, `observations`, `evidence`, `findings`
   - `sources`, `appearances`, `media_versions`, `artifact_relationships`
   - `claims`, `discovery_jobs`, `discovery_candidates`
   - `transformations`, `propagation_events`, `propagation_relationships`
   - `monitoring_jobs`, `alerts`, `report_audit_records`

---

## 3. Quick Setup & Configuration

### Step 1: Run the Schema Migration in Supabase SQL Editor
1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to the **SQL Editor**.
3. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and execute the query.

### Step 2: Configure Environment Variables
Set the following environment variables in your deployment settings or `.env`:

```env
# Backend Service-Role Configuration
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-public-key>

# Frontend Client Configuration
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

---

## 4. Multi-Tenant Organization Isolation & RLS

- **Automatic User Provisioning**: When an analyst registers via `supabase.auth.signUp()`, a PostgreSQL trigger (`on_auth_user_created`) automatically registers their profile and provisions a default organization if none is provided.
- **Access Guard Middleware**:
  - `authenticate`: Validates the bearer token against Supabase Auth, retrieving the user profile and organization ID.
  - `investigationAccessGuard`: Ensures requests to `/api/investigations/:id/*` only succeed if the caller belongs to the investigation's owning organization (demo investigations without an `orgId` remain accessible globally).
  - `entityAccessGuard`: Verifies ownership of sub-resources (claims, discovery candidates, monitoring jobs, alerts) through parent investigation relationship lookups.

---

## 5. Development & Sandbox Mode

If Supabase environment variables are omitted, VeriMedia AI automatically transitions to **High-Speed In-Memory Mode**:
- Full deterministic test suites execute seamlessly.
- The UI provides an instant "Guest Analyst" sandbox access mode for frictionless local evaluation.
