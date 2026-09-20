// VeriMedia AI — Real Detection Trend Analytics Aggregator
// Resolves Prompt 12: Replaces 100% synthetic hardcoded seeds with real database queries
import { getAuditEvents } from '../audit/auditService.js';

/**
 * Aggregates real historical detection events, forensic findings, and appearances into time-series buckets.
 * @param {object} store - ProvenanceStore instance
 * @param {object} options - { timeRange: '24h' | '7d' | '30d', platform: 'ALL' | string }
 * @returns {object} { points, platformBreakdown, totalEvents, hasHistoricalData, isIllustrative, dataSource, disclaimer }
 */
export function aggregateDetectionTrends(store, options = {}) {
  const timeRange = options.timeRange || '24h';
  const platformFilter = options.platform || 'ALL';
  const now = Date.now();

  let count = 24;
  let stepMs = 3600 * 1000; // 1 hour
  let formatLabel = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (timeRange === '7d') {
    count = 7;
    stepMs = 24 * 3600 * 1000; // 1 day
    formatLabel = (d) => d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
  } else if (timeRange === '30d') {
    count = 15;
    stepMs = 2 * 24 * 3600 * 1000; // 2 days
    formatLabel = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const windowStart = now - count * stepMs;

  // Initialize time buckets
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    const bucketEnd = now - i * stepMs;
    const bucketStart = bucketEnd - stepMs;
    const dateObj = new Date(bucketEnd);
    buckets.push({
      time: formatLabel(dateObj),
      timestamp: bucketEnd,
      start: bucketStart,
      end: bucketEnd,
      unauthorized: 0,
      suspect: 0,
      authorized: 0,
      total: 0
    });
  }

  const platformCounts = {};

  function normalizePlatformName(name) {
    if (!name) return 'Web';
    const lower = String(name).toLowerCase();
    if (lower.includes('youtube')) return 'YouTube';
    if (lower.includes('reddit')) return 'Reddit';
    if (lower.includes('twitter') || lower === 'x') return 'X / Twitter';
    if (lower.includes('instagram')) return 'Instagram';
    if (lower.includes('tiktok')) return 'TikTok';
    if (lower.includes('mastodon') || lower.includes('fediverse')) return 'Mastodon';
    if (lower.includes('archive')) return 'Wayback Machine';
    return name;
  }

  function matchesPlatform(itemPlatform) {
    if (platformFilter === 'ALL') return true;
    const norm = normalizePlatformName(itemPlatform).toLowerCase();
    const filter = platformFilter.toLowerCase();
    return norm.includes(filter) || filter.includes(norm);
  }

  function findBucket(ts) {
    if (ts < windowStart || ts > now) return null;
    return buckets.find(b => ts >= b.start && ts <= b.end) || null;
  }

  let matchedEventsCount = 0;

  // 1. Ingest real findings from provenance store
  if (store && store.findings) {
    for (const finding of store.findings.values()) {
      const ts = finding.createdAt ? new Date(finding.createdAt).getTime() : null;
      if (!ts || isNaN(ts)) continue;

      const p = finding.metadata?.platform || 'Web';
      if (!matchesPlatform(p)) continue;

      const bucket = findBucket(ts);
      if (!bucket) continue;

      const titleLower = (finding.title || '').toLowerCase();
      const summaryLower = (finding.summary || '').toLowerCase();
      const statusUpper = (finding.status || '').toUpperCase();
      const dec = (finding.metadata?.decision || '').toUpperCase();

      if (
        dec === 'TAKEDOWN' ||
        dec === 'EMERGENCY_TAKEDOWN' ||
        statusUpper === 'TAKEDOWN' ||
        statusUpper === 'VIOLATION' ||
        titleLower.includes('deepfake') ||
        titleLower.includes('synthetic') ||
        titleLower.includes('manipulat') ||
        titleLower.includes('infring')
      ) {
        bucket.unauthorized += 1;
        bucket.total += 1;
        matchedEventsCount += 1;
        const normP = normalizePlatformName(p);
        platformCounts[normP] = (platformCounts[normP] || 0) + 1;
      } else if (
        dec === 'REVIEW' ||
        dec === 'SUSPECT' ||
        statusUpper === 'SUSPECT' ||
        statusUpper === 'REVIEW_REQUIRED' ||
        titleLower.includes('anomal') ||
        titleLower.includes('suspect')
      ) {
        bucket.suspect += 1;
        bucket.total += 1;
        matchedEventsCount += 1;
      } else if (
        dec === 'ALLOW' ||
        dec === 'ATTRIBUTION' ||
        statusUpper === 'SUPPORTED' ||
        statusUpper === 'AUTHENTIC' ||
        statusUpper === 'ALLOW'
      ) {
        bucket.authorized += 1;
        bucket.total += 1;
        matchedEventsCount += 1;
      }
    }
  }

  // 2. Ingest real audit log events (ANALYSIS_RUN, UPLOAD_ARTIFACT, ALERT_REVIEW)
  try {
    const auditEvents = getAuditEvents({ limit: 10000 });
    if (Array.isArray(auditEvents)) {
      for (const event of auditEvents) {
        const ts = event.createdAt ? new Date(event.createdAt).getTime() : null;
        if (!ts || isNaN(ts)) continue;

        const bucket = findBucket(ts);
        if (!bucket) continue;

        const action = event.action || '';
        const after = event.afterState || {};
        const p = after.platform || event.metadata?.platform || 'Web';
        if (!matchesPlatform(p)) continue;

        if (action === 'ANALYSIS_RUN') {
          const decision = (after.decision || after.verdict || '').toUpperCase();
          if (decision === 'TAKEDOWN' || decision === 'EMERGENCY_TAKEDOWN') {
            bucket.unauthorized += 1;
            bucket.total += 1;
            matchedEventsCount += 1;
            const normP = normalizePlatformName(p);
            platformCounts[normP] = (platformCounts[normP] || 0) + 1;
          } else if (decision === 'REVIEW' || decision === 'SUSPECT') {
            bucket.suspect += 1;
            bucket.total += 1;
            matchedEventsCount += 1;
          } else if (decision === 'ALLOW' || decision === 'ATTRIBUTION' || decision === 'CLEAN') {
            bucket.authorized += 1;
            bucket.total += 1;
            matchedEventsCount += 1;
          }
        } else if (action === 'RATE_LIMIT_EXCEEDED' || action === 'AUTH_FAILURE') {
          bucket.unauthorized += 1;
          bucket.total += 1;
          matchedEventsCount += 1;
        }
      }
    }
  } catch (_) {
    // Non-fatal if audit events table is empty or inaccessible
  }

  // 3. Ingest real discovery candidates & appearances for platform distribution
  if (store && store.appearances) {
    for (const app of store.appearances.values()) {
      const p = normalizePlatformName(app.platform || (store.sources?.get(app.sourceId)?.platform));
      if (matchesPlatform(p)) {
        platformCounts[p] = (platformCounts[p] || 0) + 1;
      }
    }
  }
  if (store && store.discoveryCandidates) {
    for (const cand of store.discoveryCandidates.values()) {
      const p = normalizePlatformName(cand.sourcePlatform || cand.platform);
      if (matchesPlatform(p)) {
        platformCounts[p] = (platformCounts[p] || 0) + 1;
      }
    }
  }

  // Format points for Recharts (remove internal start/end fields)
  const points = buckets.map(b => ({
    time: b.time,
    timestamp: b.timestamp,
    unauthorized: b.unauthorized,
    suspect: b.suspect,
    authorized: b.authorized,
    total: b.total
  }));

  const platformBreakdown = Object.entries(platformCounts).map(([name, count]) => ({
    name,
    count
  })).sort((a, b) => b.count - a.count);

  const totalDetections = points.reduce((sum, p) => sum + p.total, 0);
  const hasHistoricalData = totalDetections > 0;

  return {
    status: 'ok',
    timeRange,
    platform: platformFilter,
    points,
    platformBreakdown,
    totalEvents: totalDetections,
    hasHistoricalData,
    isIllustrative: false,
    dataSource: 'DATABASE_RECORDED_EVENTS',
    disclaimer: hasHistoricalData
      ? 'Verified Operational Data: Metrics derived directly from recorded audit logs and forensic findings.'
      : 'Zero historical detections recorded in this time interval. No synthetic data is fabricated.'
  };
}
