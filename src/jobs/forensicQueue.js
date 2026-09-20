// VeriMedia AI — Asynchronous Forensic In-Process Job Queue
// Provides durable SQLite + in-memory task scheduling for non-blocking media analysis
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { getDatabase } from '../db/database.js';

export const JobStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED'
};

export const JobType = {
  FORENSIC_ANALYSIS: 'FORENSIC_ANALYSIS'
};

export const DEFAULT_PIPELINE_STAGES = [
  { id: 1, key: 'ingest', label: 'Stage 1: Ingest & Cryptographic Fingerprinting', status: 'PENDING', progress: 15 },
  { id: 2, key: 'ela', label: 'Stage 2: Error Level Analysis (ELA)', status: 'PENDING', progress: 35 },
  { id: 3, key: 'exif_c2pa', label: 'Stage 3: EXIF Metadata & C2PA Credentials', status: 'PENDING', progress: 55 },
  { id: 4, key: 'stats_ocr', label: 'Stage 4: Pixel Statistics & OCR Extraction', status: 'PENDING', progress: 75 },
  { id: 5, key: 'vision_ai', label: 'Stage 5: Multimodal AI Vision Inspection', status: 'PENDING', progress: 90 },
  { id: 6, key: 'fusion', label: 'Stage 6: Epistemic Signal Fusion & Verdict', status: 'PENDING', progress: 100 }
];

export class ForensicJobQueue extends EventEmitter {
  constructor({ provenanceService, callGeminiFn = null } = {}) {
    super();
    this.provenanceService = provenanceService;
    this.callGeminiFn = callGeminiFn;
    this.jobs = new Map();
    this.queue = [];
    this.isProcessing = false;
    this.db = null;

    this.initDatabase();
  }

  setDependencies({ provenanceService, callGeminiFn }) {
    if (provenanceService) this.provenanceService = provenanceService;
    if (callGeminiFn) this.callGeminiFn = callGeminiFn;
  }

  initDatabase() {
    try {
      this.db = getDatabase();
      if (this.db) {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS forensic_jobs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            status TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            stage TEXT,
            investigation_id TEXT,
            artifact_id TEXT,
            filename TEXT,
            mime_type TEXT,
            result TEXT,
            logs TEXT,
            error TEXT,
            created_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_forensic_jobs_artifact ON forensic_jobs(artifact_id);
          CREATE INDEX IF NOT EXISTS idx_forensic_jobs_status ON forensic_jobs(status);
        `);

        // Load existing active or recent jobs into memory
        const rows = this.db.prepare('SELECT * FROM forensic_jobs ORDER BY created_at DESC LIMIT 100').all();
        for (const row of rows) {
          let parsedResult = null;
          let parsedLogs = [];
          try {
            if (row.result) parsedResult = JSON.parse(row.result);
          } catch (_) {}
          try {
            if (row.logs) parsedLogs = JSON.parse(row.logs);
          } catch (_) {}

          this.jobs.set(row.id, {
            id: row.id,
            type: row.type,
            status: row.status,
            progress: row.progress || 0,
            stage: row.stage || 'fusion',
            stageIndex: 5,
            stageTitle: 'Analysis Complete',
            stageDetail: 'Finished',
            stages: DEFAULT_PIPELINE_STAGES.map(s => ({ ...s, status: row.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING' })),
            investigationId: row.investigation_id,
            artifactId: row.artifact_id,
            filename: row.filename,
            mimeType: row.mime_type,
            result: parsedResult,
            logs: parsedLogs,
            error: row.error,
            createdAt: row.created_at,
            startedAt: row.started_at,
            completedAt: row.completed_at
          });
        }
      }
    } catch (err) {
      console.warn('[ForensicQueue] SQLite initialization notice:', err.message);
    }
  }

  persistJob(job) {
    if (!this.db) {
      try {
        this.db = getDatabase();
      } catch (_) {}
    }

    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO forensic_jobs (
            id, type, status, progress, stage, investigation_id, artifact_id,
            filename, mime_type, result, logs, error, created_at, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            progress = excluded.progress,
            stage = excluded.stage,
            result = excluded.result,
            logs = excluded.logs,
            error = excluded.error,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at
        `);

        stmt.run(
          job.id,
          job.type,
          job.status,
          job.progress || 0,
          job.stage || null,
          job.investigationId || null,
          job.artifactId || null,
          job.filename || null,
          job.mimeType || null,
          job.result ? JSON.stringify(job.result) : null,
          job.logs ? JSON.stringify(job.logs) : null,
          job.error || null,
          job.createdAt,
          job.startedAt || null,
          job.completedAt || null
        );
      } catch (err) {
        console.warn('[ForensicQueue] Failed to persist job to SQLite:', err.message);
      }
    }
  }

  emitJobEvent(job, eventType = 'stage', extra = {}) {
    const eventPayload = {
      event: eventType,
      jobId: job.id,
      id: job.id,
      status: job.status,
      progress: job.progress || 0,
      stage: job.stage || 'ingest',
      stageIndex: job.stageIndex || 0,
      stageTitle: job.stageTitle || 'Processing',
      stageDetail: job.stageDetail || '',
      stages: job.stages,
      logs: job.logs || [],
      result: job.result,
      error: job.error,
      timestamp: new Date().toISOString(),
      ...extra
    };

    this.emit('progress', eventPayload);
    this.emit(`job:${job.id}`, eventPayload);
  }

  enqueueJob({
    investigationId,
    artifactId,
    filename,
    mimeType = 'application/octet-stream',
    buffer = null,
    exif = null
  }) {
    const id = `JOB-FOR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const stages = DEFAULT_PIPELINE_STAGES.map((s, idx) => ({
      ...s,
      status: idx === 0 ? 'RUNNING' : 'PENDING'
    }));

    const initialLog = {
      id: `log-${Date.now()}-0`,
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      stage: 'ingest',
      message: `Media queued for multi-spectral analysis: ${filename} (${mimeType})`
    };

    const job = {
      id,
      type: JobType.FORENSIC_ANALYSIS,
      status: JobStatus.QUEUED,
      progress: 5,
      stage: 'ingest',
      stageIndex: 0,
      stageTitle: 'Stage 1: Media Ingest & Fingerprinting',
      stageDetail: 'Extracting SHA-256 bitstream and perceptual hash...',
      stages,
      logs: [initialLog],
      investigationId,
      artifactId,
      filename,
      mimeType,
      result: null,
      error: null,
      createdAt: now,
      startedAt: null,
      completedAt: null
    };

    // Store in-memory and in SQLite
    this.jobs.set(id, job);
    this.persistJob(job);
    this.emitJobEvent(job, 'queued');

    // Add to work queue with attached payload for worker
    this.queue.push({
      jobId: id,
      investigationId,
      artifactId,
      filename,
      mimeType,
      buffer,
      exif
    });

    // Trigger async processing loop
    setImmediate(() => this.processNext());

    return {
      jobId: id,
      id,
      status: job.status,
      type: job.type,
      progress: job.progress,
      stage: job.stage,
      stageIndex: job.stageIndex,
      stages: job.stages,
      artifactId,
      investigationId,
      createdAt: job.createdAt,
      pollUrl: `/api/jobs/${id}`,
      streamUrl: `/api/jobs/${id}/stream`
    };
  }

  getJob(jobId) {
    if (!jobId) return null;
    let job = this.jobs.get(jobId);
    if (!job && this.db) {
      try {
        const row = this.db.prepare('SELECT * FROM forensic_jobs WHERE id = ?').get(jobId);
        if (row) {
          let parsedResult = null;
          let parsedLogs = [];
          try {
            if (row.result) parsedResult = JSON.parse(row.result);
          } catch (_) {}
          try {
            if (row.logs) parsedLogs = JSON.parse(row.logs);
          } catch (_) {}
          job = {
            id: row.id,
            type: row.type,
            status: row.status,
            progress: row.progress || 0,
            stage: row.stage || 'fusion',
            stageIndex: 5,
            stageTitle: 'Analysis Complete',
            stageDetail: 'Finished',
            stages: DEFAULT_PIPELINE_STAGES.map(s => ({ ...s, status: row.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING' })),
            investigationId: row.investigation_id,
            artifactId: row.artifact_id,
            filename: row.filename,
            mimeType: row.mime_type,
            result: parsedResult,
            logs: parsedLogs,
            error: row.error,
            createdAt: row.created_at,
            startedAt: row.started_at,
            completedAt: row.completed_at
          };
          this.jobs.set(job.id, job);
        }
      } catch (err) {
        console.warn('[ForensicQueue] Database lookup error:', err.message);
      }
    }
    return job || null;
  }

  listJobs({ investigationId, artifactId, status, limit = 50 } = {}) {
    let list = Array.from(this.jobs.values());

    if (investigationId) {
      list = list.filter(j => j.investigationId === investigationId);
    }
    if (artifactId) {
      list = list.filter(j => j.artifactId === artifactId);
    }
    if (status) {
      list = list.filter(j => j.status === status);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(0, limit);
  }

  async processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();
    const job = this.jobs.get(task.jobId);

    if (!job) {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
      return;
    }

    job.status = JobStatus.PROCESSING;
    job.progress = 15;
    job.stage = 'ingest';
    job.stageIndex = 0;
    job.startedAt = new Date().toISOString();
    this.persistJob(job);
    this.emitJobEvent(job, 'started');

    try {
      const mimeType = task.mimeType || 'application/octet-stream';
      const isVideoOrAudio = mimeType.startsWith('video/') || mimeType.startsWith('audio/');

      if (isVideoOrAudio) {
        const skippedResult = {
          status: 'SKIPPED',
          reason: 'video/audio forensic analysis not implemented',
          authenticity: null,
          trustScore: null,
          manipulationProbability: null,
          confidence: null,
          verdict: 'Analysis Skipped — Video/Audio Forensics Not Implemented',
          summary: 'Forensic evaluation was skipped because video and audio forensic pipelines (frame extraction, spectral analysis, voice cloning detection) are not implemented.',
          action: 'MANUAL_REVIEW_REQUIRED',
          limitations: [
            'Video and audio forensic analysis is currently not implemented.',
            'No automated authenticity, manipulation, or synthetic audio determination was made.',
            'Manual forensic inspection required.'
          ]
        };

        if (this.provenanceService) {
          const art = this.provenanceService.getArtifact(task.artifactId);
          if (art) {
            art.metadata = {
              ...(art.metadata || {}),
              forensicAnalysis: skippedResult
            };
          }
        }

        job.status = JobStatus.SKIPPED;
        job.progress = 100;
        job.stage = 'fusion';
        job.stageIndex = 5;
        job.stages = job.stages.map(s => ({ ...s, status: 'SKIPPED' }));
        job.result = skippedResult;
        job.completedAt = new Date().toISOString();
        this.persistJob(job);
        this.emitJobEvent(job, 'completed');
      } else if (mimeType.startsWith('image/')) {
        if (this.provenanceService && task.buffer) {
          const forensicOutcome = await this.provenanceService.runImageForensicAnalysis({
            investigationId: task.investigationId,
            artifactId: task.artifactId,
            buffer: task.buffer,
            mimeType: task.mimeType,
            exif: task.exif,
            callGeminiFn: this.callGeminiFn,
            onStageChange: (stageData) => {
              job.stage = stageData.stage?.toLowerCase() || 'processing';
              job.stageIndex = stageData.stageIndex ?? job.stageIndex;
              job.stageTitle = stageData.stageTitle || job.stageTitle;
              job.stageDetail = stageData.stageDetail || job.stageDetail;
              job.progress = stageData.progress ?? job.progress;

              job.stages = job.stages.map((st, idx) => {
                if (idx < job.stageIndex) return { ...st, status: 'COMPLETED' };
                if (idx === job.stageIndex) return { ...st, status: 'RUNNING', detail: stageData.stageDetail };
                return { ...st, status: 'PENDING' };
              });

              if (stageData.log) {
                job.logs = [
                  ...(job.logs || []).slice(-99),
                  {
                    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: new Date().toLocaleTimeString(),
                    level: 'info',
                    stage: job.stage,
                    message: stageData.log
                  }
                ];
              }

              this.persistJob(job);
              this.emitJobEvent(job, 'stage');
            }
          });

          job.status = JobStatus.COMPLETED;
          job.progress = 100;
          job.stage = 'fusion';
          job.stageIndex = 5;
          job.stageTitle = 'Pipeline Complete';
          job.stageDetail = 'All forensic signals calibrated and evidence record compiled.';
          job.stages = job.stages.map(s => ({ ...s, status: 'COMPLETED' }));
          job.result = forensicOutcome.forensicAnalysis || {
            status: 'COMPLETED',
            evidenceId: forensicOutcome.evidence?.id,
            findingId: forensicOutcome.finding?.id
          };
          job.completedAt = new Date().toISOString();
          this.persistJob(job);
          this.emitJobEvent(job, 'completed');
        } else {
          // No buffer available for physical analysis
          job.status = JobStatus.COMPLETED;
          job.progress = 100;
          job.stage = 'fusion';
          job.stageIndex = 5;
          job.stages = job.stages.map(s => ({ ...s, status: 'COMPLETED' }));
          job.result = {
            status: 'INCONCLUSIVE',
            reason: 'Media binary buffer was not provided for pixel-level forensic evaluation.'
          };
          job.completedAt = new Date().toISOString();
          this.persistJob(job);
          this.emitJobEvent(job, 'completed');
        }
      } else {
        // Unsupported format
        job.status = JobStatus.SKIPPED;
        job.progress = 100;
        job.stage = 'fusion';
        job.stageIndex = 5;
        job.stages = job.stages.map(s => ({ ...s, status: 'SKIPPED' }));
        job.result = {
          status: 'SKIPPED',
          reason: `Forensic pipeline does not support mime-type '${mimeType}'`
        };
        job.completedAt = new Date().toISOString();
        this.persistJob(job);
        this.emitJobEvent(job, 'completed');
      }
    } catch (err) {
      console.error(`[ForensicQueue] Error executing job ${task.jobId}:`, err);
      job.status = JobStatus.FAILED;
      job.progress = 100;
      job.error = err.message || 'Forensic analysis encountered an unhandled execution failure';
      job.stages = job.stages.map(s => (s.status === 'RUNNING' ? { ...s, status: 'FAILED' } : s));
      job.completedAt = new Date().toISOString();
      this.persistJob(job);
      this.emitJobEvent(job, 'failed', { error: job.error });
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }
}

