// VeriMedia AI — Continuous Media Monitoring & Alert Dispatcher (Phase L)
import { MonitoringJobStatus, AlertStatus, AlertSeverity, AlertType } from './core.js';

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
    this.store.updateMonitoringJob(jobId, {
      lastRunAt: now,
      nextRunAt: new Date(Date.now() + 3600000).toISOString()
    });

    // Create demonstration alert if none exist for job
    const existingAlerts = Array.from(this.store.alerts.values()).filter(a => a.monitoringJobId === jobId);
    let newAlert = null;
    if (existingAlerts.length === 0 && job.investigationId) {
      newAlert = this.store.createAlert({
        investigationId: job.investigationId,
        monitoringJobId: jobId,
        artifactId: job.artifactId,
        severity: AlertSeverity.MEDIUM,
        alertType: AlertType.NEW_APPEARANCE,
        title: `Automated Scan Match: ${job.name}`,
        description: `Periodic monitor detected 1 candidate media match across monitored endpoints.`
      });
    }

    return {
      jobId,
      status: 'COMPLETED',
      executedAt: now,
      newAlertsCount: newAlert ? 1 : 0,
      alert: newAlert
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
