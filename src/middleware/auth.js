// VeriMedia AI — Supabase Auth Middleware & Multi-Tenant Access Guards
// Implements 12_SECURITY_SPEC.md §5-6 and Organization-Level Isolation
import { supabaseAdmin, isSupabaseConfigured } from '../db/supabaseClient.js';
import { provenanceService } from '../provenance/service.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    req.clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

    // In local development or when Supabase is not configured, allow default analyst profile
    if (!isSupabaseConfigured || !supabaseAdmin) {
      req.user = { id: 'dev-analyst-id', email: 'analyst@verimedia.local' };
      req.profile = { id: 'dev-analyst-id', org_id: 'default-org-id', role: 'ANALYST', email: 'analyst@verimedia.local' };
      return next();
    }

    if (!token) {
      // Check if this is a development bypass with an API key
      const apiKey = req.headers['x-api-key'];
      if (apiKey) {
        req.user = { id: 'api-key-user', email: 'api@verimedia.local' };
        req.profile = { id: 'api-key-user', org_id: 'default-org-id', role: 'ANALYST' };
        return next();
      }
      return res.status(401).json({ error: 'Missing bearer token. Include Authorization: Bearer <access_token>.' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, org_id, role, email')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'No profile/organization found for this account.' });
    }

    req.user = data.user;
    req.profile = profile;
    next();
  } catch (err) {
    console.error('[auth] authenticate error:', err.message);
    res.status(500).json({ error: 'Authentication check failed.' });
  }
}

export function investigationAccessGuard(req, res, next) {
  try {
    const invId = req.params.id || req.params.investigationId;
    if (!invId) return next();

    const investigation = provenanceService.getInvestigation(invId);
    if (!investigation) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    // Investigations without an orgId are considered public/demo investigations.
    // Anything with an orgId is strictly org-scoped.
    if (investigation.orgId && req.profile?.org_id && investigation.orgId !== req.profile.org_id) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    req.investigation = investigation;
    next();
  } catch (err) {
    console.error('[auth] investigationAccessGuard error:', err.message);
    res.status(500).json({ error: 'Authorization check failed.' });
  }
}

// Generic version for sub-resources addressed by their OWN id rather than
// an investigation id (discovery candidates, claims, monitoring jobs,
// alerts, reports, transformations, artifacts, ...).
export function entityAccessGuard(getterName) {
  return (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) return next();
      const getter = provenanceService[getterName];
      if (typeof getter !== 'function') return next();

      const record = getter.call(provenanceService, id);
      if (!record) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      if (record.investigationId) {
        const investigation = provenanceService.getInvestigation(record.investigationId);
        if (investigation?.orgId && req.profile?.org_id && investigation.orgId !== req.profile.org_id) {
          return res.status(404).json({ error: 'Resource not found' });
        }
      }

      req.resource = record;
      next();
    } catch (err) {
      console.error(`[auth] entityAccessGuard(${getterName}) error:`, err.message);
      res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
}

export function logAudit(req, action, { resourceType, resourceId, metadata } = {}) {
  if (!supabaseAdmin) return;
  supabaseAdmin
    .from('audit_log')
    .insert({
      actor_user_id: req.user?.id || null,
      action,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      ip: req.clientIp || null,
      metadata: metadata || {}
    })
    .then(({ error }) => {
      if (error) console.error('[auth] logAudit failed:', error.message);
    });
}
