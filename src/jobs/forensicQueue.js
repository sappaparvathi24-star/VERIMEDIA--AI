// VeriMedia AI — Asynchronous Forensic In-Process Job Queue
// Provides durable SQLite + in-memory task scheduling for non-blocking media analysis
import crypto from 'crypto';
import { EventEmitter } from 'events';
import sharp from 'sharp';
import exifr from 'exifr';
import { getDatabase } from '../db/database.js';
import { computeAverageHash, hashSimilarity } from '../forensics/perceptualHash.js';
import { storeArtifactMedia } from '../forensics/imageForensics.js';

export const JobStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED'
};

export const JobType = {
  FORENSIC_ANALYSIS: 'FORENSIC_ANALYSIS',
  BATCH_COMPARE: 'BATCH_COMPARE'
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
  constructor(optionsOrService = {}, maybeOpts = {}) {
    super();
    let provenanceService = null;
    let callGeminiFn = null;

    if (optionsOrService && optionsOrService.provenanceService) {
      provenanceService = optionsOrService.provenanceService;
      callGeminiFn = optionsOrService.callGeminiFn || null;
    } else if (optionsOrService && typeof optionsOrService === 'object' && optionsOrService.createInvestigation) {
      provenanceService = optionsOrService;
      callGeminiFn = maybeOpts?.callGeminiFn || null;
    } else if (typeof optionsOrService === 'object') {
      provenanceService = optionsOrService.provenanceService || null;
      callGeminiFn = optionsOrService.callGeminiFn || null;
    }

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

        // Check if any required columns are missing from existing forensic_jobs table and add them dynamically
        try {
          const columns = this.db.prepare('PRAGMA table_info(forensic_jobs)').all();
          const colSet = new Set(columns.map(c => c.name));
          const expectedCols = [
            { name: 'progress', type: 'INTEGER DEFAULT 0' },
            { name: 'stage', type: 'TEXT' },
            { name: 'investigation_id', type: 'TEXT' },
            { name: 'artifact_id', type: 'TEXT' },
            { name: 'filename', type: 'TEXT' },
            { name: 'mime_type', type: 'TEXT' },
            { name: 'result', type: 'TEXT' },
            { name: 'logs', type: 'TEXT' },
            { name: 'error', type: 'TEXT' },
            { name: 'started_at', type: 'TEXT' },
            { name: 'completed_at', type: 'TEXT' }
          ];

          for (const col of expectedCols) {
            if (!colSet.has(col.name)) {
              this.db.exec(`ALTER TABLE forensic_jobs ADD COLUMN ${col.name} ${col.type}`);
            }
          }
        } catch (colErr) {
          console.warn('[ForensicQueue] Notice while verifying columns:', colErr.message);
        }

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
        if (err.message && err.message.includes('has no column named')) {
          try {
            const columns = this.db.prepare('PRAGMA table_info(forensic_jobs)').all();
            const colSet = new Set(columns.map(c => c.name));
            const expectedCols = [
              { name: 'progress', type: 'INTEGER DEFAULT 0' },
              { name: 'stage', type: 'TEXT' },
              { name: 'investigation_id', type: 'TEXT' },
              { name: 'artifact_id', type: 'TEXT' },
              { name: 'filename', type: 'TEXT' },
              { name: 'mime_type', type: 'TEXT' },
              { name: 'result', type: 'TEXT' },
              { name: 'logs', type: 'TEXT' },
              { name: 'error', type: 'TEXT' },
              { name: 'started_at', type: 'TEXT' },
              { name: 'completed_at', type: 'TEXT' }
            ];
            for (const col of expectedCols) {
              if (!colSet.has(col.name)) {
                this.db.exec(`ALTER TABLE forensic_jobs ADD COLUMN ${col.name} ${col.type}`);
              }
            }
            const retryStmt = this.db.prepare(`
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
            retryStmt.run(
              job.id, job.type, job.status, job.progress || 0, job.stage || null,
              job.investigationId || null, job.artifactId || null, job.filename || null,
              job.mimeType || null, job.result ? JSON.stringify(job.result) : null,
              job.logs ? JSON.stringify(job.logs) : null, job.error || null,
              job.createdAt, job.startedAt || null, job.completedAt || null
            );
            return;
          } catch (retryErr) {
            console.warn('[ForensicQueue] Retry persist failed:', retryErr.message);
          }
        }
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

  enqueueBatchCompareJob({
    batchId,
    investigationId,
    referenceArtifactId,
    referenceAnalysis,
    referenceSha256,
    referencePHash,
    validCandidates = [],
    userEmail = 'analyst@verimedia.ai'
  }) {
    const id = `JOB-BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
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
      message: `Batch reference comparison queued: ${validCandidates.length} candidate images against reference ${referenceArtifactId}`
    };

    const job = {
      id,
      type: JobType.BATCH_COMPARE,
      status: JobStatus.QUEUED,
      progress: 5,
      stage: 'ingest',
      stageIndex: 0,
      stageTitle: 'Batch Media Ingest & Fingerprinting',
      stageDetail: `Queued ${validCandidates.length} candidate images for bulk reference audit...`,
      stages,
      logs: [initialLog],
      investigationId,
      artifactId: referenceArtifactId,
      filename: `batch_${batchId}.zip`,
      mimeType: 'application/zip',
      result: null,
      error: null,
      createdAt: now,
      startedAt: null,
      completedAt: null
    };

    this.jobs.set(id, job);
    this.persistJob(job);
    this.emitJobEvent(job, 'queued');

    this.queue.push({
      jobId: id,
      type: JobType.BATCH_COMPARE,
      batchId,
      investigationId,
      referenceArtifactId,
      referenceAnalysis,
      referenceSha256,
      referencePHash,
      validCandidates,
      userEmail
    });

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
      artifactId: referenceArtifactId,
      investigationId,
      batchId,
      candidateCount: validCandidates.length,
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
      if (task.type === JobType.BATCH_COMPARE) {
        await this.processBatchCompare(task, job);
        return;
      }

      if (this.provenanceService && task.buffer) {
        const forensicOutcome = await this.provenanceService.runUnifiedForensicAnalysis({
          investigationId: task.investigationId,
          artifactId: task.artifactId,
          buffer: task.buffer,
          filename: task.filename,
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
        job.result = forensicOutcome?.forensicAnalysis || forensicOutcome?.result || forensicOutcome;
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
          reason: 'Media binary buffer was not provided for physical forensic evaluation.'
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

  async processBatchCompare(task, job) {
    const {
      batchId,
      investigationId,
      referenceArtifactId,
      referenceAnalysis,
      referenceSha256,
      referencePHash,
      validCandidates = [],
      userEmail = 'analyst@verimedia.ai'
    } = task;

    const candidatesResult = [];
    let identicalCount = 0;
    let nearIdenticalCount = 0;
    let derivativeCount = 0;
    let unrelatedCount = 0;
    const total = validCandidates.length;

    for (let i = 0; i < total; i++) {
      const candidate = validCandidates[i];
      const currentIdx = i + 1;

      // 1. Fingerprint candidate
      const candSha256 = crypto.createHash('sha256').update(candidate.buffer).digest('hex');
      let candPHash = null;
      let candDimensions = null;
      let candExif = null;

      try {
        candPHash = await computeAverageHash(candidate.buffer);
      } catch (_) {}

      try {
        const meta = await sharp(candidate.buffer).metadata();
        if (meta.width && meta.height) {
          candDimensions = { width: meta.width, height: meta.height };
        }
      } catch (_) {}

      try {
        candExif = await exifr.parse(candidate.buffer);
      } catch (_) {}

      // 2. Create Candidate Artifact
      const candArtifact = this.provenanceService.createArtifact({
        investigationId,
        filename: candidate.filename,
        mimeType: candidate.mimeType,
        byteSize: candidate.byteSize,
        sha256: candSha256,
        perceptualHash: candPHash,
        dimensions: candDimensions || null,
        metadata: {
          ...(candExif ? { exif: candExif } : {}),
          originalName: candidate.filename,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userEmail,
          batchId,
          isBatchCandidate: true
        }
      });

      // 3. Store in media store for preview / retrieval
      storeArtifactMedia(candArtifact.id, {
        buffer: candidate.buffer,
        mimeType: candidate.mimeType,
        filename: candidate.filename,
        originalName: candidate.filename
      });

      // 4. Update job progress & emit event
      const baseProgress = Math.round(5 + (i / total) * 90);
      job.progress = baseProgress;
      job.stage = 'batch_candidate';
      job.stageIndex = Math.min(5, Math.floor((i / total) * 6));
      job.stageTitle = `Analyzing Candidate ${currentIdx} of ${total}`;
      job.stageDetail = `Analyzing candidate ${currentIdx} of ${total}: ${candidate.filename}...`;

      job.logs = [
        ...(job.logs || []).slice(-99),
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          stage: 'batch_compare',
          message: `[${currentIdx}/${total}] Processing ${candidate.filename}. Running physical and multimodal forensic pipeline...`
        }
      ];
      this.persistJob(job);
      this.emitJobEvent(job, 'stage');

      // 5. Run runImageForensicAnalysis on candidate
      let candForensicOutcome = null;
      try {
        candForensicOutcome = await this.provenanceService.runImageForensicAnalysis({
          investigationId,
          artifactId: candArtifact.id,
          buffer: candidate.buffer,
          mimeType: candidate.mimeType,
          exif: candExif,
          callGeminiFn: this.callGeminiFn,
          onStageChange: (stageData) => {
            job.stageDetail = `Analyzing candidate ${currentIdx} of ${total} (${candidate.filename}): ${stageData.stageDetail || stageData.stageTitle}`;
            if (stageData.log) {
              job.logs = [
                ...(job.logs || []).slice(-99),
                {
                  id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: new Date().toLocaleTimeString(),
                  level: 'info',
                  stage: 'batch_compare',
                  message: `[Candidate ${currentIdx}/${total}] ${candidate.filename}: ${stageData.log}`
                }
              ];
            }
            this.persistJob(job);
            this.emitJobEvent(job, 'stage');
          }
        });
      } catch (candErr) {
        console.warn(`[ForensicQueue] Candidate ${candidate.filename} analysis error:`, candErr.message);
      }

      // 6. Compute relationship to reference
      let relation = 'UNRELATED';
      let similarity = 0.0;

      if (candSha256 && referenceSha256 && candSha256 === referenceSha256) {
        relation = 'IDENTICAL_COPY';
        similarity = 1.0;
      } else {
        const sim = hashSimilarity(candPHash, referencePHash);
        similarity = sim != null ? sim : 0.0;
        if (similarity > 0.95) {
          relation = 'NEAR_IDENTICAL';
        } else if (similarity >= 0.80 && similarity <= 0.95) {
          relation = 'DERIVATIVE';
        } else {
          relation = 'UNRELATED';
        }
      }

      if (relation === 'IDENTICAL_COPY') identicalCount++;
      else if (relation === 'NEAR_IDENTICAL') nearIdenticalCount++;
      else if (relation === 'DERIVATIVE') derivativeCount++;
      else unrelatedCount++;

      // 7. Store relation alongside forensicAnalysis
      const candAnalysis = candForensicOutcome?.forensicAnalysis || candArtifact.metadata?.forensicAnalysis || {
        status: 'COMPLETED',
        isAnalyzed: true,
        analyzedAt: new Date().toISOString()
      };
      candAnalysis.relation = relation;
      candAnalysis.similarity = similarity;

      candArtifact.metadata = {
        ...(candArtifact.metadata || {}),
        forensicAnalysis: candAnalysis,
        relation,
        similarity
      };

      // Record Relationship in store
      try {
        if (this.provenanceService.store?.createRelationship) {
          this.provenanceService.store.createRelationship({
            investigationId,
            fromArtifactId: referenceArtifactId,
            toArtifactId: candArtifact.id,
            relationshipType: relation,
            confidence: similarity,
            metadata: { similarity, relation, candidateFilename: candidate.filename }
          });
        }
      } catch (_) {}

      candidatesResult.push({
        artifactId: candArtifact.id,
        filename: candidate.filename,
        similarity,
        relation,
        forensicAnalysis: candAnalysis
      });
    }

    // 8. Build final batch result
    const finalResult = {
      batchId,
      investigationId,
      reference: {
        artifactId: referenceArtifactId,
        forensicAnalysis: referenceAnalysis
      },
      candidates: candidatesResult,
      summary: {
        totalCandidates: total,
        identicalCount,
        nearIdenticalCount,
        derivativeCount,
        unrelatedCount
      }
    };

    job.status = JobStatus.COMPLETED;
    job.progress = 100;
    job.stage = 'fusion';
    job.stageIndex = 5;
    job.stageTitle = 'Batch Audit Complete';
    job.stageDetail = `Analyzed ${total} candidate images against reference. Identical: ${identicalCount}, Near-Identical: ${nearIdenticalCount}, Derivative: ${derivativeCount}, Unrelated: ${unrelatedCount}.`;
    job.stages = job.stages.map(s => ({ ...s, status: 'COMPLETED' }));
    job.result = finalResult;
    job.completedAt = new Date().toISOString();
    this.persistJob(job);
    this.emitJobEvent(job, 'completed');
  }
}

