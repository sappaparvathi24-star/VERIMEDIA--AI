import {
  createInvestigation,
  createTimelineEvent,
  createNote,
  createArtifactRelationship
} from './models.js';
import {
  getObservationsForArtifact,
  getEvidenceForArtifact,
  getFindingsForArtifact,
  getAnalysisRunsForArtifact,
  findingsStore,
  evidenceStore
} from './evidence.js';

export const investigationsStore = new Map();
export const timelineEventsStore = new Map();
export const notesStore = new Map();
export const relationshipsStore = new Map();
export const globalArtifactsStore = new Map();

// Record an auditable timeline/activity event
export function recordTimelineEvent({
  investigationId,
  type,
  actor = 'System',
  description = '',
  metadata = {}
}) {
  if (!investigationId) return null;
  const evt = createTimelineEvent({
    investigationId,
    type,
    actor,
    description,
    metadata
  });
  timelineEventsStore.set(evt.id, evt);
  return evt;
}

export function getTimelineEventsForInvestigation(investigationId) {
  const events = [];
  for (const evt of timelineEventsStore.values()) {
    if (evt.investigationId === investigationId) {
      events.push(evt);
    }
  }
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function createNewInvestigation(data = {}) {
  const inv = createInvestigation(data);
  investigationsStore.set(inv.id, inv);

  recordTimelineEvent({
    investigationId: inv.id,
    type: 'INVESTIGATION_CREATED',
    actor: inv.createdBy || 'Analyst',
    description: `Investigation '${inv.title}' created (${inv.mode || 'REAL_INVESTIGATION'}).`,
    metadata: { status: inv.status, priority: inv.priority, tags: inv.tags }
  });

  return inv;
}

export function getInvestigation(id) {
  return investigationsStore.get(id) || null;
}

export function listInvestigations({ title, status, tag, priority, mode, q } = {}) {
  let list = Array.from(investigationsStore.values());

  if (status) {
    list = list.filter(inv => inv.status.toUpperCase() === status.toUpperCase());
  }
  if (priority) {
    list = list.filter(inv => inv.priority.toUpperCase() === priority.toUpperCase());
  }
  if (mode) {
    list = list.filter(inv => (inv.mode || inv.metadata?.mode) === mode);
  }
  if (tag) {
    list = list.filter(inv => Array.isArray(inv.tags) && inv.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
  }
  if (title || q) {
    const term = (title || q).toLowerCase();
    list = list.filter(inv => inv.title.toLowerCase().includes(term) || (inv.description && inv.description.toLowerCase().includes(term)));
  }

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateInvestigation(id, updates = {}, actor = 'Analyst') {
  const inv = investigationsStore.get(id);
  if (!inv) return null;

  const oldStatus = inv.status;
  if (updates.status && ['OPEN', 'IN_REVIEW', 'RESOLVED', 'ARCHIVED', 'COMPLETED'].includes(updates.status.toUpperCase())) {
    inv.status = updates.status.toUpperCase();
  }
  if (updates.title) inv.title = updates.title;
  if (updates.description !== undefined) inv.description = updates.description;
  if (updates.priority) inv.priority = updates.priority.toUpperCase();
  if (Array.isArray(updates.tags)) inv.tags = updates.tags;
  inv.updatedAt = new Date().toISOString();

  if (updates.status && updates.status.toUpperCase() !== oldStatus) {
    recordTimelineEvent({
      investigationId: inv.id,
      type: 'STATUS_CHANGED',
      actor,
      description: `Investigation status changed from ${oldStatus} to ${inv.status}.`,
      metadata: { oldStatus, newStatus: inv.status }
    });
  }

  investigationsStore.set(inv.id, inv);
  return inv;
}

export function addArtifactToInvestigation(investigationId, artifact, actor = 'Analyst', artifactsStore = null) {
  const inv = investigationsStore.get(investigationId);
  if (!inv) {
    throw new Error(`Investigation '${investigationId}' not found.`);
  }

  const isDemoArtifact = artifact.sourceType === 'demo' || artifact.metadata?.isDemo === true;
  const isDemoInvestigation = inv.mode === 'DEMO_SCENARIO' || inv.metadata?.isDemo === true;

  if (isDemoArtifact && !isDemoInvestigation) {
    throw new Error('DEMO ISOLATION POLICY: Demo artifacts cannot be attached to a REAL_INVESTIGATION.');
  }

  if (!inv.artifactIds.includes(artifact.id)) {
    inv.artifactIds.push(artifact.id);
  }
  if (!inv.artifactId) {
    inv.artifactId = artifact.id;
  }
  inv.updatedAt = new Date().toISOString();

  globalArtifactsStore.set(artifact.id, artifact);
  if (artifactsStore) {
    artifactsStore.set(artifact.id, artifact);
  }

  recordTimelineEvent({
    investigationId: inv.id,
    type: 'ARTIFACT_ADDED',
    actor,
    description: `Media artifact '${artifact.filename}' (${artifact.mimeType}, SHA-256: ${artifact.sha256.slice(0, 12)}...) added to investigation.`,
    metadata: { artifactId: artifact.id, filename: artifact.filename, mimeType: artifact.mimeType, sha256: artifact.sha256 }
  });

  investigationsStore.set(inv.id, inv);
  return inv;
}

export function addNoteToInvestigation(investigationId, text, authorId = 'Analyst') {
  const inv = investigationsStore.get(investigationId);
  if (!inv) {
    throw new Error(`Investigation '${investigationId}' not found.`);
  }

  const note = createNote({
    investigationId,
    authorId,
    text
  });
  notesStore.set(note.id, note);

  recordTimelineEvent({
    investigationId,
    type: 'NOTE_ADDED',
    actor: authorId,
    description: `Analyst note recorded by ${authorId}.`,
    metadata: { noteId: note.id, textPreview: text.slice(0, 80) }
  });

  inv.updatedAt = new Date().toISOString();
  investigationsStore.set(inv.id, inv);

  return note;
}

export function getNotesForInvestigation(investigationId) {
  const notes = [];
  for (const n of notesStore.values()) {
    if (n.investigationId === investigationId) {
      notes.push(n);
    }
  }
  return notes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function addArtifactRelationship(investigationId, { sourceArtifactId, targetArtifactId, type, description, evidenceIds = [] }) {
  const inv = investigationsStore.get(investigationId);
  if (!inv) throw new Error(`Investigation '${investigationId}' not found.`);

  const rel = createArtifactRelationship({
    investigationId,
    sourceArtifactId,
    targetArtifactId,
    type: type || 'UNKNOWN',
    evidenceIds,
    description
  });
  relationshipsStore.set(rel.id, rel);

  recordTimelineEvent({
    investigationId,
    type: 'EVIDENCE_ADDED',
    actor: 'Analyst',
    description: `Artifact relationship '${rel.type}' recorded between ${sourceArtifactId} and ${targetArtifactId}.`,
    metadata: { relationshipId: rel.id, type: rel.type }
  });

  return rel;
}

export function getRelationshipsForInvestigation(investigationId) {
  const result = [];
  for (const rel of relationshipsStore.values()) {
    if (rel.investigationId === investigationId) {
      result.push(rel);
    }
  }
  return result;
}

export function getInvestigationPackage(investigationId, artifactsStore = null) {
  const inv = investigationsStore.get(investigationId);
  if (!inv) return null;

  const store = artifactsStore || globalArtifactsStore;
  const artifacts = [];
  const allObservations = [];
  const allEvidence = [];
  const allFindings = [];
  const allRuns = [];

  for (const artId of inv.artifactIds || []) {
    const art = store ? store.get(artId) : null;
    if (art) artifacts.push(art);

    const obs = getObservationsForArtifact(artId);
    const evd = getEvidenceForArtifact(artId);
    const fnd = getFindingsForArtifact(artId);
    const runs = getAnalysisRunsForArtifact(artId);

    allObservations.push(...obs);
    allEvidence.push(...evd);
    allFindings.push(...fnd);
    allRuns.push(...runs);
  }

  if (Array.isArray(inv.findings)) {
    for (const f of inv.findings) {
      if (!allFindings.some(existing => existing.id === f.id)) {
        allFindings.push(f);
      }
    }
  }

  const whatWeKnow = allFindings.filter(f => ['OBSERVED', 'SUPPORTED', 'INFERRED'].includes(f.epistemicStatus)).map(f => {
    const supporting = (f.evidenceIds || []).map(eid => evidenceStore.get(eid)).filter(Boolean);
    return {
      id: f.id,
      category: f.category,
      statement: f.statement,
      epistemicStatus: f.epistemicStatus,
      confidence: f.confidence,
      supportingEvidence: supporting,
      limitations: f.limitations
    };
  });

  const whatRemainsUnknown = [];
  artifacts.forEach(art => {
    if (!art.metadata || !art.metadata.hasExif) {
      whatRemainsUnknown.push({
        artifactId: art.id,
        filename: art.filename,
        topic: 'Camera & EXIF Metadata',
        statement: `Camera EXIF metadata unavailable for ${art.filename}. Metadata may have been stripped during transcoding.`
      });
    }
    whatRemainsUnknown.push({
      artifactId: art.id,
      filename: art.filename,
      topic: 'Original Source Publication',
      statement: `Original source publication history unverified for ${art.filename}.`
    });
  });

  allEvidence.filter(e => e.status === 'UNKNOWN' || e.status === 'INCONCLUSIVE').forEach(e => {
    whatRemainsUnknown.push({
      artifactId: e.artifactId,
      topic: e.type,
      statement: e.description || e.limitations || 'Measurement was inconclusive or unavailable.'
    });
  });

  const conflictingEvidence = [];
  allEvidence.filter(e => e.status === 'CONFLICTING').forEach(e => {
    conflictingEvidence.push({
      id: e.id,
      artifactId: e.artifactId,
      type: e.type,
      description: e.description,
      status: e.status,
      limitations: e.limitations
    });
  });
  allFindings.filter(f => f.epistemicStatus === 'CONFLICTING').forEach(f => {
    conflictingEvidence.push({
      id: f.id,
      artifactId: f.artifactId,
      category: f.category,
      statement: f.statement,
      status: f.epistemicStatus,
      limitations: f.limitations
    });
  });

  const timeline = getTimelineEventsForInvestigation(investigationId);
  const notes = getNotesForInvestigation(investigationId);
  const relationships = getRelationshipsForInvestigation(investigationId);

  return {
    investigation: inv,
    artifacts,
    findings: allFindings,
    evidence: allEvidence,
    observations: allObservations,
    analysisRuns: allRuns,
    whatWeKnow,
    whatRemainsUnknown,
    conflictingEvidence,
    timeline,
    activity: timeline,
    notes,
    relationships
  };
}
