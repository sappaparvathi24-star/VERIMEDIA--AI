// VeriMedia AI — Continuous Media Monitoring & Alert Dispatcher (Phase L)
import { MonitoringJobStatus, AlertStatus, AlertSeverity, AlertType } from './core.js';
import {
  searchReddit,
  searchYouTube,
  searchMastodon,
  searchArchiveOrg,
  searchGoogleImages
} from '../proxy/searchProxy.js';

// Platform-ID to real search function mapping
const PROVIDER_SEARCH_FNS = {
  REDDIT:      (q) => searchReddit(q),
  YOUTUBE:     (q) => searchYouTube(q),
  MASTODON:    (q) => searchMastodon(q),
  ARCHIVE_ORG: (q) => searchArchiveOrg(q),
  GOOGLE_IMAGES: (q) => searchGoogleImages(q),
};

export class MonitoringService {
  constructor(store) {
    this.store = store;
  }

  createJob(payload) {
    return this.store.createMonitoringJob(payload);
  }

  getJob(jobId) {
    return this.store.getMonitoringJob(jobId);
  }

  getJobs(investigationId) {
    if (investigationId) {
      return this.store.getMonitoringJobsByInvestigation(investigationId);
    }
    return Array.from(this.store.monitoringJobs.values());
  }

  updateJob(jobId, patch) {
    return this.store.updateMonitoringJob(jobId, patch);
  }

  deleteJob(jobId) {
    return this.store.deleteMonitoringJob(jobId);
  }

  async runJob(jobId, options = {}) {
    const job = this.store.getMonitoringJob(jobId);
    if (!job) {
      throw new Error(`Monitoring job not found: ${jobId}`);
    }

    const now = new Date().toISOString();
    const intervalMs = _intervalToMs(job.intervalSchedule || 'HOURLY');
    this.store.updateMonitoringJob(jobId, {
      lastRunAt: now,
      nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
      status: 'RUNNING'
    });

    const query = job.targetQuery || job.name || '';
    const platforms = Array.isArray(job.platforms) && job.platforms.length > 0
      ? job.platforms
      : ['REDDIT', 'MASTODON', 'ARCHIVE_ORG'];

    // Run real searches across all configured platforms in parallel
    const searchResults = await Promise.all(
      platforms.map(async (platformId) => {
        const fn = PROVIDER_SEARCH_FNS[platformId];
        if (!fn || !query.trim()) {
          return { platformId, results: [], skipped: true };
        }
        try {
          const raw = await fn(query);
          // Normalise to array of results
          const results = Array.isArray(raw)
            ? raw
            : (raw?.results || raw?.candidates || []);
          return { platformId, results, skipped: false };
        } catch (err) {
          return { platformId, results: [], error: err.message, skipped: true };
        }
      })
    );

    // Compute new-appearance candidates: results with timestamps newer than lastRunAt
    const previousRunAt = job.lastRunAt || null;
    const newCandidates = [];
    let totalResultsFound = 0;

    for (const { platformId, results, skipped } of searchResults) {
      if (skipped) continue;
      totalResultsFound += results.length;

      for (const r of results) {
        const pubAt = r.publishedAt || r.createdAt || r.createdUtc || null;
        const isNew = !previousRunAt || !pubAt || new Date(pubAt) > new Date(previousRunAt);
        if (isNew) {
          newCandidates.push({
            platform: platformId,
            url: r.url || r.permalink || r.archivedUrl || null,
            title: r.title || r.content?.slice(0, 80) || null,
            publishedAt: pubAt,
            author: r.author || null,
          });
        }
      }
    }

    this.store.updateMonitoringJob(jobId, { status: 'ACTIVE' });

    // Create alerts only for genuinely new candidates
    const alertsGenerated = [];
    for (const candidate of newCandidates.slice(0, 5)) {
      if (!job.investigationId) break;
      const alert = this.store.createAlert({
        investigationId: job.investigationId,
        monitoringJobId: jobId,
        artifactId: job.artifactId || null,
        severity: AlertSeverity.MEDIUM,
        alertType: AlertType.NEW_APPEARANCE,
        title: `New Appearance Detected: ${candidate.platform}`,
        description: candidate.title
          ? `"${candidate.title}" observed on ${candidate.platform}${candidate.publishedAt ? ' at ' + candidate.publishedAt.slice(0, 10) : ''}.`
          : `New media post detected on ${candidate.platform}.`,
        metadata: {
          url: candidate.url,
          publishedAt: candidate.publishedAt,
          author: candidate.author,
          platform: candidate.platform,
          detectedAt: now,
          query
        }
      });
      alertsGenerated.push(alert);
    }

    return {
      jobId,
      status: 'COMPLETED',
      executedAt: now,
      query,
      platformsSearched: platforms.filter(p => PROVIDER_SEARCH_FNS[p]),
      totalResultsFound,
      newCandidatesFound: newCandidates.length,
      alertsGenerated,
      newAlertsCount: alertsGenerated.length,
      searchSummary: searchResults.map(r => ({
        platform: r.platformId,
        count: r.results.length,
        skipped: r.skipped,
        error: r.error || null
      }))
    };
  }

  getAlerts(investigationId, filters = {}) {
    let alerts = investigationId
      ? this.store.getAlertsByInvestigation(investigationId)
      : Array.from(this.store.alerts.values());

    if (filters.status) {
      alerts = alerts.filter(a => a.status === filters.status);
    }
    if (filters.severity) {
      alerts = alerts.filter(a => a.severity === filters.severity);
    }
    return alerts;
  }

  getAlert(alertId) {
    return this.store.getAlert(alertId);
  }

  updateAlert(alertId, patch) {
    return this.store.updateAlert(alertId, patch);
  }

  acknowledgeAlert(alertId, status = AlertStatus.ACKNOWLEDGED) {
    return this.store.updateAlert(alertId, { status, acknowledgedAt: new Date().toISOString() });
  }

  deleteAlert(alertId) {
    return this.store.deleteAlert(alertId);
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
// Runs all overdue monitoring jobs automatically.
// Called from server.js setInterval.
export async function tickMonitoringScheduler(store) {
  const now = Date.now();
  const jobs = Array.from(store.monitoringJobs.values());
  const service = new MonitoringService(store);

  for (const job of jobs) {
    if (job.status === 'PAUSED' || job.status === 'CANCELLED') continue;
    const nextRun = job.nextRunAt ? new Date(job.nextRunAt).getTime() : 0;
    if (nextRun > now) continue; // Not due yet

    try {
      await service.runJob(job.id);
    } catch (err) {
      console.warn(`[MonitoringScheduler] Job ${job.id} failed:`, err.message);
    }
  }
}

function _intervalToMs(schedule) {
  switch (schedule) {
    case 'EVERY_15_MIN': return 15 * 60 * 1000;
    case 'HOURLY':       return 60 * 60 * 1000;
    case 'EVERY_6_HOURS': return 6 * 60 * 60 * 1000;
    case 'DAILY':        return 24 * 60 * 60 * 1000;
    case 'WEEKLY':       return 7 * 24 * 60 * 60 * 1000;
    default:             return 60 * 60 * 1000;
  }
}
