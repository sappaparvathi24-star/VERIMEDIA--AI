// VeriMedia AI — Audit Logging Service
// Implements 12_SECURITY_SPEC.md §10: Comprehensive Security & Provenance Audit Trail
import crypto from 'crypto';
import { persistence } from '../db/persistence.js';

export const AuditAction = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  AUTH_FAILURE: 'AUTH_FAILURE',
  UPLOAD_ARTIFACT: 'UPLOAD_ARTIFACT',
  ARTIFACT_ACCESS: 'ARTIFACT_ACCESS',
  ARTIFACT_DELETE: 'ARTIFACT_DELETE',
  INVESTIGATION_CREATE: 'INVESTIGATION_CREATE',
  INVESTIGATION_UPDATE: 'INVESTIGATION_UPDATE',
  INVESTIGATION_DELETE: 'INVESTIGATION_DELETE',
  ANALYSIS_RUN: 'ANALYSIS_RUN',
  REPORT_GENERATE: 'REPORT_GENERATE',
  REPORT_EXPORT: 'REPORT_EXPORT',
  EVIDENCE_CREATE: 'EVIDENCE_CREATE',
  EVIDENCE_ACCESS: 'EVIDENCE_ACCESS',
  EVIDENCE_DELETE: 'EVIDENCE_DELETE',
  MONITORING_JOB_CREATE: 'MONITORING_JOB_CREATE',
  MONITORING_JOB_UPDATE: 'MONITORING_JOB_UPDATE',
  ALERT_REVIEW: 'ALERT_REVIEW',
  ALERT_DISMISS: 'ALERT_DISMISS',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  FINDING_CREATE: 'FINDING_CREATE',
  FINDING_UPDATE: 'FINDING_UPDATE',
  FINDING_REVIEW: 'FINDING_REVIEW',
  INVESTIGATION_STATUS_CHANGE: 'INVESTIGATION_STATUS_CHANGE'
};

export const AuditObjectType = {
  AUTH: 'AUTH',
  MEDIA_ARTIFACT: 'MEDIA_ARTIFACT',
  INVESTIGATION: 'INVESTIGATION',
  ANALYSIS_RUN: 'ANALYSIS_RUN',
  REPORT: 'REPORT',
  EVIDENCE: 'EVIDENCE',
  MONITORING_JOB: 'MONITORING_JOB',
  ALERT: 'ALERT',
  SECURITY: 'SECURITY',
  CONFIG: 'CONFIG',
  FINDING: 'FINDING',
  REVIEW: 'REVIEW'
};

/**
 * Log an auditable event with full context
 */
export function logAuditEvent({
  investigationId = null,
  actor = null,
  action,
  objectType,
  objectId = null,
  beforeState = null,
  afterState = null,
  req = null
}) {
  try {
    let resolvedActor = actor;
    if (!resolvedActor && req) {
      resolvedActor = req.user?.email || req.apiKey || req.ip || 'ANONYMOUS';
    }
    if (!resolvedActor) {
      resolvedActor = 'SYSTEM';
    }

    const event = {
      id: `AUD-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      investigationId,
      actor: resolvedActor,
      action: action || 'ACTION_PERFORMED',
      objectType: objectType || 'GENERAL',
      objectId,
      beforeState,
      afterState: afterState ? {
        ...afterState,
        ip: req?.ip || req?.headers?.['x-forwarded-for'] || undefined,
        userAgent: req?.headers?.['user-agent'] || undefined
      } : (req ? {
        ip: req.ip || req.headers['x-forwarded-for'] || undefined,
        userAgent: req.headers['user-agent'] || undefined
      } : null),
      createdAt: new Date().toISOString()
    };

    persistence.saveAuditEvent(event);
    return event;
  } catch (err) {
    console.warn('[AuditService] Failed to record audit event:', err.message);
    return null;
  }
}

/**
 * Retrieve audit log events
 */
export function getAuditEvents(filter = {}) {
  return persistence.loadAuditEvents(filter);
}
