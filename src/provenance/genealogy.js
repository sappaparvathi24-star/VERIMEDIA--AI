// VeriMedia AI — Media Genealogy & Transformation Analysis Engine (Phase I)
import { 
  TransformationTypes, 
  TransformationEpistemicStatus, 
  TransformationDirection,
  RelationshipTypes, 
  EvidencePolarity, 
  FindingStatus 
} from './core.js';
import { hammingDistanceHex } from './discovery.js';
import { buildMediaTimeline } from './timeline.js';

/**
 * Normalizes hex hamming distance to a [0.0, 1.0] perceptual similarity score.
 */
export function calculatePerceptualSimilarity(hashA, hashB) {
  if (!hashA || !hashB) return 0.0;
  const distance = hammingDistanceHex(hashA, hashB);
  return {
    distance,
    similarity: Math.max(0, Math.min(1.0, 1.0 - (distance / 32.0))),
    isVisuallyRelated: distance <= 16
  };
}

/**
 * Compares two artifacts and executes deep transformation analysis across
 * Image, Video, Audio, Metadata, and Temporal dimensions adhering strictly
 * to the Epistemic Separation and Zero-Cost principles.
 */
export function analyzeArtifactTransformations(store, investigationId, artifactAId, artifactBId, options = {}) {
  const artifactA = store.getArtifact(artifactAId);
  const artifactB = store.getArtifact(artifactBId);

  if (!artifactA || !artifactB) {
    throw new Error(`Artifacts not found: ${artifactAId}, ${artifactBId}`);
  }

  const investigation = investigationId ? store.getInvestigation(investigationId) : null;
  const isDemo = Boolean(artifactA.isDemo || artifactB.isDemo || (investigation && investigation.isDemo));

  // 1. Create unified AnalysisRun
  const run = store.createAnalysisRun({
    investigationId: investigationId || artifactA.investigationId || artifactB.investigationId,
    artifactId: artifactB.id,
    method: 'MEDIA_GENEALOGY_TRANSFORMATION_ANALYSIS_ENGINE',
    status: 'COMPLETED',
    metadata: {
      comparedSource: artifactA.id,
      comparedTarget: artifactB.id,
      methodVersion: '1.0.0-phaseI',
      isDemo
    }
  });

  const observations = [];
  const evidenceList = [];
  const findings = [];
  const createdTransformations = [];
  const competingHypotheses = [];
  const limitationList = [
    'Visual similarity does not prove which artifact was created first.',
    'Transformation evidence demonstrates technical consistency, not historical order or authorial intent.',
    'Direction of derivation remains unverified without independent publication timestamps.',
    'Cryptographic and perceptual similarity metrics do not prove initial capture moment or origin.',
    'Neither artifact can be labeled absolute original from media comparison alone.'
  ];

  if (isDemo) {
    limitationList.unshift('DEMO SCENARIO — NOT REAL EVIDENCE: Generated for simulated genealogy demonstration.');
  }

  // ── 2. IDENTITY CHECK (SHA-256) ─────────────────────────────────────────────
  const isExactMatch = artifactA.sha256 === artifactB.sha256;
  const shaObs = store.createObservation({
    runId: run.id,
    artifactId: artifactB.id,
    observationType: 'CRYPTOGRAPHIC_HASH_COMPARISON',
    target: 'sha256',
    value: {
      artifactA_sha256: artifactA.sha256,
      artifactB_sha256: artifactB.sha256,
      exactMatch: isExactMatch
    },
    confidence: 1.0,
    metadata: { isDemo }
  });
  observations.push(shaObs);

  if (isExactMatch) {
    const exactEv = store.createEvidence({
      observationIds: [shaObs.id],
      independenceGroupId: `IG-HASH-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'EXACT_HASH_MATCH',
      description: `Artifacts ${artifactA.id} and ${artifactB.id} share identical SHA-256 fingerprint (${artifactA.sha256.slice(0, 16)}…).`,
      confidence: 1.0,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(exactEv);

    const exactRel = store.createRelationship({
      investigationId,
      fromArtifactId: artifactA.id,
      toArtifactId: artifactB.id,
      relationshipType: RelationshipTypes.OBSERVED_SAME_CONTENT,
      evidenceIds: [exactEv.id],
      confidence: 1.0,
      status: 'VERIFIED',
      metadata: { exactMatch: true, isDemo }
    });

    const exactFinding = store.createFinding({
      investigationId,
      title: 'Identical Content Bytes Observed',
      summary: `Artifact ${artifactB.id} has identical byte content to Artifact ${artifactA.id}.`,
      status: FindingStatus.SUPPORTED,
      confidence: 1.0,
      evidenceIds: [exactEv.id],
      limitations: ['Confirms identical bitstream; does not determine capture hardware or historical publisher.']
    });
    findings.push(exactFinding);

    return {
      run,
      observations,
      evidence: evidenceList,
      findings,
      relationship: exactRel,
      isExactMatch: true,
      perceptualSimilarity: 1.0,
      transformations: [],
      detailedTransformations: [],
      hypotheses: [
        {
          type: 'EXACT_DUPLICATE',
          statement: 'Both artifacts are bitstream identical copies.',
          status: 'SUPPORTED',
          confidence: 1.0
        }
      ],
      identity: {
        isExactMatch: true,
        sha256A: artifactA.sha256,
        sha256B: artifactB.sha256
      },
      visualComparison: {
        perceptualSimilarity: 1.0,
        hammingDistance: 0,
        isVisuallyRelated: true
      },
      timestamps: compareTimestamps(artifactA, artifactB),
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: limitationList,
      isDemo
    };
  }

  // ── 3. VISUAL / PERCEPTUAL SIMILARITY ──────────────────────────────────────
  const { distance: pDistance, similarity: visualSim, isVisuallyRelated } = calculatePerceptualSimilarity(
    artifactA.perceptualHash,
    artifactB.perceptualHash
  );

  const simObs = store.createObservation({
    runId: run.id,
    artifactId: artifactB.id,
    observationType: 'PERCEPTUAL_SIMILARITY_ANALYSIS',
    target: 'perceptualHash',
    value: {
      pHashA: artifactA.perceptualHash,
      pHashB: artifactB.perceptualHash,
      hammingDistance: pDistance,
      similarityScore: visualSim,
      isVisuallyRelated
    },
    confidence: 0.95,
    metadata: { isDemo }
  });
  observations.push(simObs);

  let simEv = null;
  if (isVisuallyRelated) {
    simEv = store.createEvidence({
      observationIds: [simObs.id],
      independenceGroupId: `IG-PERCEPTUAL-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'PERCEPTUAL_FINGERPRINT_MATCH',
      description: `Artifacts exhibit high perceptual visual similarity (${(visualSim * 100).toFixed(1)}%, Hamming distance ${pDistance}).`,
      confidence: 0.90,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo, hammingDistance: pDistance, visualSimilarity: visualSim }
    });
    evidenceList.push(simEv);
  }

  // ── 4. DIMENSIONS, RESIZE, CROP & LETTERBOXING ──────────────────────────────
  const dimA = artifactA.dimensions || { width: 1920, height: 1080 };
  const dimB = artifactB.dimensions || { width: 1920, height: 1080 };
  const aspectA = Number((dimA.width / dimA.height).toFixed(3));
  const aspectB = Number((dimB.width / dimB.height).toFixed(3));
  const aspectDelta = Math.abs(aspectA - aspectB);

  const dimObs = store.createObservation({
    runId: run.id,
    artifactId: artifactB.id,
    observationType: 'DIMENSIONAL_ANALYSIS',
    target: 'dimensions',
    value: {
      dimA,
      dimB,
      aspectRatioA: aspectA,
      aspectRatioB: aspectB,
      aspectDelta
    },
    confidence: 1.0,
    metadata: { isDemo }
  });
  observations.push(dimObs);

  // Check Dimension Resizing
  const isDimensionDifferent = dimA.width !== dimB.width || dimA.height !== dimB.height;
  const isAspectMatch = aspectDelta <= 0.05;

  if (isDimensionDifferent) {
    if (isAspectMatch) {
      // Clean RESIZE
      const scaleW = Number((dimB.width / dimA.width).toFixed(3));
      const scaleH = Number((dimB.height / dimA.height).toFixed(3));
      const isDownscale = scaleW < 1.0;

      const resizeEv = store.createEvidence({
        observationIds: simObs ? [dimObs.id, simObs.id] : [dimObs.id],
        independenceGroupId: `IG-RESIZE-${artifactA.id}-${artifactB.id}`,
        evidenceType: 'RESIZE_TRANSFORMATION_EVIDENCE',
        description: `Dimensions indicate consistent resolution scaling: ${dimA.width}x${dimA.height} (${aspectA}:1) to ${dimB.width}x${dimB.height} (${aspectB}:1) at scale factor ${scaleW}x.`,
        confidence: 0.92,
        polarity: EvidencePolarity.SUPPORTING,
        metadata: { isDownscale, scaleFactor: scaleW, isDemo }
      });
      evidenceList.push(resizeEv);

      const resizeTrf = store.createTransformation({
        investigationId,
        sourceArtifactId: artifactA.id,
        targetArtifactId: artifactB.id,
        type: TransformationTypes.RESIZE,
        direction: isDownscale ? TransformationDirection.FORWARD : TransformationDirection.HYPOTHETICAL,
        observations: simObs ? [dimObs.id, simObs.id] : [dimObs.id],
        evidenceIds: [resizeEv.id],
        analysisRunId: run.id,
        analysisMethodId: 'METHOD-GENEALOGY-RESIZE-01',
        confidence: 0.92,
        epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
        limitations: [
          'Target dimensions are consistent with a downscaled version.',
          'Does NOT establish that target was definitely derived directly from source file without intermediaries.'
        ],
        measurements: {
          originalDimensions: dimA,
          targetDimensions: dimB,
          scalingFactor: scaleW,
          aspectRatioPreserved: true
        },
        isDemo
      });
      createdTransformations.push(resizeTrf);

      competingHypotheses.push({
        type: 'RESIZE_DOWNSCALE',
        status: 'SUPPORTED',
        explanation: `Target is consistent with downscaled presentation from ${dimA.width}x${dimA.height} to ${dimB.width}x${dimB.height}.`
      });
    } else {
      // Aspect ratio mismatch indicates CROP or LETTERBOX / PADDING
      const hasLetterboxMeta = Boolean(
        artifactB.metadata?.letterbox || 
        artifactB.metadata?.padding || 
        artifactA.metadata?.letterbox
      );

      if (hasLetterboxMeta || (aspectB < aspectA && artifactB.metadata?.paddedBars)) {
        // LETTERBOX / PADDING
        const padEv = store.createEvidence({
          observationIds: simObs ? [dimObs.id, simObs.id] : [dimObs.id],
          independenceGroupId: `IG-PAD-${artifactA.id}-${artifactB.id}`,
          evidenceType: 'PADDING_TRANSFORMATION_EVIDENCE',
          description: `Aspect ratio variance (${aspectA} -> ${aspectB}) consistent with border padding/letterboxing.`,
          confidence: 0.88,
          polarity: EvidencePolarity.SUPPORTING,
          metadata: { isDemo }
        });
        evidenceList.push(padEv);

        const padTrf = store.createTransformation({
          investigationId,
          sourceArtifactId: artifactA.id,
          targetArtifactId: artifactB.id,
          type: TransformationTypes.LETTERBOX,
          direction: TransformationDirection.FORWARD,
          observations: simObs ? [dimObs.id, simObs.id] : [dimObs.id],
          evidenceIds: [padEv.id],
          analysisRunId: run.id,
          analysisMethodId: 'METHOD-GENEALOGY-LETTERBOX-01',
          confidence: 0.88,
          epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
          limitations: [
            'Letterbox borders observed; does not prove automated syndication vs manual editorial matte.'
          ],
          measurements: {
            sourceAspect: aspectA,
            targetAspect: aspectB,
            paddingDetected: true
          },
          isDemo
        });
        createdTransformations.push(padTrf);
      } else {
        // CROP
        const cropBbox = artifactB.metadata?.cropBbox || {
          x: 0,
          y: 0,
          width: dimB.width,
          height: dimB.height,
          retainedAreaPercentage: Math.min(100, Math.round((aspectB / aspectA) * 100))
        };

        const cropEv = store.createEvidence({
          observationIds: simObs ? [dimObs.id, simObs.id] : [dimObs.id],
          independenceGroupId: `IG-CROP-${artifactA.id}-${artifactB.id}`,
          evidenceType: 'CROP_TRANSFORMATION_EVIDENCE',
          description: `Geometric aspect ratio shift (${aspectA}:1 to ${aspectB}:1) consistent with spatial cropping.`,
          confidence: 0.89,
          polarity: EvidencePolarity.SUPPORTING,
          metadata: { cropBbox, isDemo }
        });
        evidenceList.push(cropEv);

        const cropTrf = store.createTransformation({
          investigationId,
          sourceArtifactId: artifactA.id,
          targetArtifactId: artifactB.id,
          type: TransformationTypes.CROP,
          direction: TransformationDirection.FORWARD,
          observations: simObs ? [dimObs.id, simObs.id] : [dimObs.id],
          evidenceIds: [cropEv.id],
          analysisRunId: run.id,
          analysisMethodId: 'METHOD-GENEALOGY-CROP-01',
          confidence: 0.89,
          epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
          limitations: [
            'Spatial cropping relationship is consistent with aspect shift, but retained framing may be secondary crop.',
            'Does not establish whether crop was automated by social platform or manually edited.'
          ],
          measurements: {
            sourceAspect: aspectA,
            targetAspect: aspectB,
            cropBbox,
            retainedPercentage: cropBbox.retainedAreaPercentage || 65
          },
          isDemo
        });
        createdTransformations.push(cropTrf);

        competingHypotheses.push({
          type: 'CROP_EXTRACTION',
          status: 'SUPPORTED',
          explanation: `Geometric aspect ratio shift indicates spatial crop from ${aspectA}:1 to ${aspectB}:1.`
        });
      }
    }
  }

  // ── 5. RECOMPRESSION & BITRATE / QUALITY ANALYSIS ───────────────────────────
  const sizeA = artifactA.byteSize || 1000000;
  const sizeB = artifactB.byteSize || 1000000;
  const sizeRatio = Number((sizeB / sizeA).toFixed(3));
  
  const hasRecompressionIndicators = 
    sizeRatio < 0.60 || 
    artifactB.metadata?.recompression === true ||
    artifactB.metadata?.quantizationDelta ||
    (artifactA.metadata?.bitrate && artifactB.metadata?.bitrate && artifactB.metadata.bitrate < artifactA.metadata.bitrate * 0.7);

  if (hasRecompressionIndicators) {
    const compObs = store.createObservation({
      runId: run.id,
      artifactId: artifactB.id,
      observationType: 'COMPRESSION_METRICS_OBSERVATION',
      target: 'byteSize_and_bitrate',
      value: {
        sizeA,
        sizeB,
        sizeRatio,
        quantizationDelta: artifactB.metadata?.quantizationDelta || null,
        bitrateA: artifactA.metadata?.bitrate || null,
        bitrateB: artifactB.metadata?.bitrate || null
      },
      confidence: 0.90,
      metadata: { isDemo }
    });
    observations.push(compObs);

    const compEv = store.createEvidence({
      observationIds: [compObs.id],
      independenceGroupId: `IG-COMPRESS-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'RECOMPRESSION_OBSERVATION',
      description: `Secondary compression artifacts observed: payload size reduced by ${Math.round((1 - sizeRatio) * 100)}% (${sizeA}B -> ${sizeB}B).`,
      confidence: 0.85,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(compEv);

    const compTrf = store.createTransformation({
      investigationId,
      sourceArtifactId: artifactA.id,
      targetArtifactId: artifactB.id,
      type: TransformationTypes.RECOMPRESSION,
      direction: TransformationDirection.FORWARD,
      observations: [compObs.id],
      evidenceIds: [compEv.id],
      analysisRunId: run.id,
      analysisMethodId: 'METHOD-GENEALOGY-COMPRESSION-01',
      confidence: 0.85,
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: [
        'Recompression indicates quality loss and transcode pipeline, but does NOT prove editing intent or malicious manipulation.',
        'Platform automated transcoding commonly causes substantial recompression artifacts.'
      ],
      measurements: {
        sizeA,
        sizeB,
        sizeRatio,
        qualityReductionPct: Math.max(0, Math.round((1 - sizeRatio) * 100))
      },
      isDemo
    });
    createdTransformations.push(compTrf);

    competingHypotheses.push({
      type: 'PLATFORM_RECOMPRESSION',
      status: 'SUPPORTED',
      explanation: 'Recompression characteristics consistent with social media transcode or re-encoding.'
    });
  }

  // ── 6. FORMAT & CONTAINER CONVERSION ───────────────────────────────────────
  const isFormatConversion = artifactA.mimeType !== artifactB.mimeType;
  if (isFormatConversion) {
    const fmtObs = store.createObservation({
      runId: run.id,
      artifactId: artifactB.id,
      observationType: 'MIME_CONTAINER_OBSERVATION',
      target: 'mimeType',
      value: {
        sourceMime: artifactA.mimeType,
        targetMime: artifactB.mimeType
      },
      confidence: 1.0,
      metadata: { isDemo }
    });
    observations.push(fmtObs);

    const fmtEv = store.createEvidence({
      observationIds: [fmtObs.id],
      independenceGroupId: `IG-FMT-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'FORMAT_CONVERSION_EVIDENCE',
      description: `Format container conversion detected: ${artifactA.mimeType} -> ${artifactB.mimeType}.`,
      confidence: 0.95,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(fmtEv);

    const fmtTrf = store.createTransformation({
      investigationId,
      sourceArtifactId: artifactA.id,
      targetArtifactId: artifactB.id,
      type: TransformationTypes.FORMAT_CONVERSION,
      direction: TransformationDirection.UNDIRECTED,
      observations: [fmtObs.id],
      evidenceIds: [fmtEv.id],
      analysisRunId: run.id,
      analysisMethodId: 'METHOD-GENEALOGY-FORMAT-01',
      confidence: 0.95,
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: [
        'Container format changes occur in standard distribution workflows and do not denote content manipulation.'
      ],
      measurements: {
        sourceFormat: artifactA.mimeType,
        targetFormat: artifactB.mimeType
      },
      isDemo
    });
    createdTransformations.push(fmtTrf);
  }

  // ── 7. METADATA STRIPPING & ADDITION ───────────────────────────────────────
  const metaA = artifactA.metadata || {};
  const metaB = artifactB.metadata || {};
  const keysA = Object.keys(metaA).filter(k => !['isDemo', 'isReference'].includes(k));
  const keysB = Object.keys(metaB).filter(k => !['isDemo', 'isReference'].includes(k));

  const strippedKeys = keysA.filter(k => !(k in metaB) && metaA[k] !== undefined);
  const addedKeys = keysB.filter(k => !(k in metaA) && metaB[k] !== undefined);

  if (strippedKeys.length > 0) {
    const stripObs = store.createObservation({
      runId: run.id,
      artifactId: artifactB.id,
      observationType: 'METADATA_STRIPPING_OBSERVATION',
      target: 'metadata',
      value: { strippedKeys },
      confidence: 0.95,
      metadata: { isDemo }
    });
    observations.push(stripObs);

    const stripEv = store.createEvidence({
      observationIds: [stripObs.id],
      independenceGroupId: `IG-METASTRIP-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'METADATA_STRIPPING_EVIDENCE',
      description: `Metadata fields present in ${artifactA.id} are absent in ${artifactB.id} (${strippedKeys.join(', ')}).`,
      confidence: 0.90,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(stripEv);

    const stripTrf = store.createTransformation({
      investigationId,
      sourceArtifactId: artifactA.id,
      targetArtifactId: artifactB.id,
      type: TransformationTypes.METADATA_STRIPPING,
      direction: TransformationDirection.FORWARD,
      observations: [stripObs.id],
      evidenceIds: [stripEv.id],
      analysisRunId: run.id,
      analysisMethodId: 'METHOD-GENEALOGY-META-01',
      confidence: 0.90,
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: [
        'Metadata stripping regularly occurs on social media platforms for user privacy and bandwidth reduction; does not prove malicious manipulation.'
      ],
      measurements: { strippedKeys },
      isDemo
    });
    createdTransformations.push(stripTrf);
  }

  if (addedKeys.length > 0) {
    const addObs = store.createObservation({
      runId: run.id,
      artifactId: artifactB.id,
      observationType: 'METADATA_ADDITION_OBSERVATION',
      target: 'metadata',
      value: { addedKeys },
      confidence: 0.90,
      metadata: { isDemo }
    });
    observations.push(addObs);

    const addEv = store.createEvidence({
      observationIds: [addObs.id],
      independenceGroupId: `IG-METAADD-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'METADATA_ADDITION_EVIDENCE',
      description: `New metadata fields introduced in ${artifactB.id} (${addedKeys.join(', ')}).`,
      confidence: 0.85,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(addEv);

    const addTrf = store.createTransformation({
      investigationId,
      sourceArtifactId: artifactA.id,
      targetArtifactId: artifactB.id,
      type: TransformationTypes.METADATA_ADDITION,
      direction: TransformationDirection.FORWARD,
      observations: [addObs.id],
      evidenceIds: [addEv.id],
      analysisRunId: run.id,
      analysisMethodId: 'METHOD-GENEALOGY-META-02',
      confidence: 0.85,
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: [
        'Added metadata tags (e.g. encoder or platform tags) reflect secondary handling, not necessarily malicious alteration.'
      ],
      measurements: { addedKeys },
      isDemo
    });
    createdTransformations.push(addTrf);
  }

  // ── 8. VIDEO SPECIFIC ANALYSIS (TRIMMING, FRAME RATE, RE-ENCODING) ─────────
  const isVideo = artifactA.mimeType?.includes('video') || artifactB.mimeType?.includes('video');
  const durationA = Number(artifactA.duration || artifactA.durationSeconds || 0);
  const durationB = Number(artifactB.duration || artifactB.durationSeconds || 0);
  const fpsA = artifactA.frameRate || artifactA.metadata?.frameRate || null;
  const fpsB = artifactB.frameRate || artifactB.metadata?.frameRate || null;
  const codecA = artifactA.videoCodec || artifactA.metadata?.videoCodec || null;
  const codecB = artifactB.videoCodec || artifactB.metadata?.videoCodec || null;

  if (isVideo) {
    // Check Duration Trimming
    if (durationA > 0 && durationB > 0 && Math.abs(durationA - durationB) > 0.5) {
      const isShorter = durationB < durationA;
      const trimDelta = Number(Math.abs(durationA - durationB).toFixed(2));

      const trimObs = store.createObservation({
        runId: run.id,
        artifactId: artifactB.id,
        observationType: 'VIDEO_DURATION_OBSERVATION',
        target: 'duration',
        value: {
          durationA,
          durationB,
          trimDelta,
          isShorter
        },
        confidence: 0.95,
        metadata: { isDemo }
      });
      observations.push(trimObs);

      const trimEv = store.createEvidence({
        observationIds: [trimObs.id],
        independenceGroupId: `IG-TRIM-${artifactA.id}-${artifactB.id}`,
        evidenceType: 'FRAME_TRIMMING_EVIDENCE',
        description: `Video duration variance observed: ${durationA}s vs ${durationB}s (${trimDelta}s delta consistent with segment trimming).`,
        confidence: 0.88,
        polarity: EvidencePolarity.SUPPORTING,
        metadata: { isDemo }
      });
      evidenceList.push(trimEv);

      const trimTrf = store.createTransformation({
        investigationId,
        sourceArtifactId: artifactA.id,
        targetArtifactId: artifactB.id,
        type: TransformationTypes.VIDEO_TRIMMING || TransformationTypes.FRAME_TRIMMING,
        direction: isShorter ? TransformationDirection.FORWARD : TransformationDirection.HYPOTHETICAL,
        observations: [trimObs.id],
        evidenceIds: [trimEv.id],
        analysisRunId: run.id,
        analysisMethodId: 'METHOD-GENEALOGY-TRIM-01',
        confidence: 0.88,
        epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
        limitations: [
          'Duration relationship is consistent with frame trimming; does not determine which segment was cut from which without timeline records.'
        ],
        measurements: {
          durationA,
          durationB,
          durationDelta: trimDelta,
          retainedDurationSeconds: durationB
        },
        isDemo
      });
      createdTransformations.push(trimTrf);

      competingHypotheses.push({
        type: 'VIDEO_TRIM',
        status: 'SUPPORTED',
        explanation: `Duration delta (${trimDelta}s) consistent with temporal highlight extraction or clipping.`
      });
    }

    // Check Frame Rate Differences
    if (fpsA && fpsB && Math.abs(fpsA - fpsB) > 0.5) {
      const fpsObs = store.createObservation({
        runId: run.id,
        artifactId: artifactB.id,
        observationType: 'FRAME_RATE_OBSERVATION',
        target: 'frameRate',
        value: { fpsA, fpsB },
        confidence: 0.95,
        metadata: { isDemo }
      });
      observations.push(fpsObs);

      const fpsEv = store.createEvidence({
        observationIds: [fpsObs.id],
        independenceGroupId: `IG-FPS-${artifactA.id}-${artifactB.id}`,
        evidenceType: 'FRAME_RATE_CHANGE_EVIDENCE',
        description: `Frame rate variance observed: ${fpsA} fps vs ${fpsB} fps.`,
        confidence: 0.87,
        polarity: EvidencePolarity.SUPPORTING,
        metadata: { isDemo }
      });
      evidenceList.push(fpsEv);

      const fpsTrf = store.createTransformation({
        investigationId,
        sourceArtifactId: artifactA.id,
        targetArtifactId: artifactB.id,
        type: TransformationTypes.FRAME_RATE_CONVERSION || TransformationTypes.FRAME_RATE_CHANGE,
        direction: TransformationDirection.UNDIRECTED,
        observations: [fpsObs.id],
        evidenceIds: [fpsEv.id],
        analysisRunId: run.id,
        analysisMethodId: 'METHOD-GENEALOGY-FPS-01',
        confidence: 0.87,
        epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
        limitations: [
          'Differences in frame rate observed; does not automatically conclude frame interpolation or retimed playback.'
        ],
        measurements: { sourceFps: fpsA, targetFps: fpsB, fpsA, fpsB },
        isDemo
      });
      createdTransformations.push(fpsTrf);
    }

    // Check Codec Transcode
    if (codecA && codecB && codecA !== codecB) {
      const codecObs = store.createObservation({
        runId: run.id,
        artifactId: artifactB.id,
        observationType: 'CODEC_OBSERVATION',
        target: 'videoCodec',
        value: { codecA, codecB },
        confidence: 0.95,
        metadata: { isDemo }
      });
      observations.push(codecObs);

      const codecEv = store.createEvidence({
        observationIds: [codecObs.id],
        independenceGroupId: `IG-CODEC-${artifactA.id}-${artifactB.id}`,
        evidenceType: 'CODEC_TRANSCODE_EVIDENCE',
        description: `Video codec transcoding observed: ${codecA} vs ${codecB}.`,
        confidence: 0.90,
        polarity: EvidencePolarity.SUPPORTING,
        metadata: { isDemo }
      });
      evidenceList.push(codecEv);

      const codecTrf = store.createTransformation({
        investigationId,
        sourceArtifactId: artifactA.id,
        targetArtifactId: artifactB.id,
        type: TransformationTypes.CODEC_TRANSCODE,
        direction: TransformationDirection.UNDIRECTED,
        observations: [codecObs.id],
        evidenceIds: [codecEv.id],
        analysisRunId: run.id,
        analysisMethodId: 'METHOD-GENEALOGY-CODEC-01',
        confidence: 0.90,
        epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
        limitations: ['Codec differences indicate container or compression transcode.'],
        measurements: { sourceCodec: codecA, targetCodec: codecB },
        isDemo
      });
      createdTransformations.push(codecTrf);
    }
  }

  // ── 9. AUDIO ANALYSIS (EXTRACTION, REPLACEMENT, RE-ENCODING, TIMING, RESAMPLE, SPECTRAL) ──
  const audioA = artifactA.audio || artifactA.metadata?.audio || null;
  const audioB = artifactB.audio || artifactB.metadata?.audio || null;
  const sampleRateA = artifactA.audioSampleRate || artifactA.metadata?.audioSampleRate || null;
  const sampleRateB = artifactB.audioSampleRate || artifactB.metadata?.audioSampleRate || null;
  const hasAudioTrackA = artifactA.metadata?.hasAudioTrack !== undefined ? artifactA.metadata.hasAudioTrack : (audioA !== null || isVideo);
  const hasAudioTrackB = artifactB.metadata?.hasAudioTrack !== undefined ? artifactB.metadata.hasAudioTrack : (audioB !== null || isVideo);

  // Audio Sample Rate modification
  if (sampleRateA && sampleRateB && sampleRateA !== sampleRateB) {
    const resampleObs = store.createObservation({
      runId: run.id,
      artifactId: artifactB.id,
      observationType: 'AUDIO_RESAMPLE_OBSERVATION',
      target: 'audioSampleRate',
      value: { sampleRateA, sampleRateB },
      confidence: 0.95,
      metadata: { isDemo }
    });
    observations.push(resampleObs);

    const resampleEv = store.createEvidence({
      observationIds: [resampleObs.id],
      independenceGroupId: `IG-AUDSR-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'AUDIO_RESAMPLE_EVIDENCE',
      description: `Audio sample rate converted from ${sampleRateA}Hz to ${sampleRateB}Hz.`,
      confidence: 0.90,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(resampleEv);

    const resampleTrf = store.createTransformation({
      investigationId,
      sourceArtifactId: artifactA.id,
      targetArtifactId: artifactB.id,
      type: TransformationTypes.AUDIO_RESAMPLE,
      direction: TransformationDirection.UNDIRECTED,
      observations: [resampleObs.id],
      evidenceIds: [resampleEv.id],
      analysisRunId: run.id,
      analysisMethodId: 'METHOD-GENEALOGY-AUDIO-SR-01',
      confidence: 0.90,
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: ['Sample rate conversion modifies frequency headroom.'],
      measurements: { sourceSampleRate: sampleRateA, targetSampleRate: sampleRateB },
      isDemo
    });
    createdTransformations.push(resampleTrf);
  }

  // Audio Track Presence / Absence / Modification
  if (hasAudioTrackA !== hasAudioTrackB) {
    const trkObs = store.createObservation({
      runId: run.id,
      artifactId: artifactB.id,
      observationType: 'AUDIO_TRACK_OBSERVATION',
      target: 'hasAudioTrack',
      value: { hasAudioTrackA, hasAudioTrackB },
      confidence: 0.95,
      metadata: { isDemo }
    });
    observations.push(trkObs);

    const trkEv = store.createEvidence({
      observationIds: [trkObs.id],
      independenceGroupId: `IG-AUDTRK-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'AUDIO_TRACK_EVIDENCE',
      description: `Audio track configuration change: source hasAudio=${hasAudioTrackA}, target hasAudio=${hasAudioTrackB}.`,
      confidence: 0.90,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(trkEv);

    const trkTrf = store.createTransformation({
      investigationId,
      sourceArtifactId: artifactA.id,
      targetArtifactId: artifactB.id,
      type: TransformationTypes.AUDIO_TRACK_MODIFICATION,
      direction: hasAudioTrackA && !hasAudioTrackB ? TransformationDirection.FORWARD : TransformationDirection.UNDIRECTED,
      observations: [trkObs.id],
      evidenceIds: [trkEv.id],
      analysisRunId: run.id,
      analysisMethodId: 'METHOD-GENEALOGY-AUDIO-TRK-01',
      confidence: 0.90,
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: ['Audio track presence changes do not prove intentional removal.'],
      measurements: { hasAudioTrackA, hasAudioTrackB },
      isDemo
    });
    createdTransformations.push(trkTrf);
  }

  // Audio Spectral Modification
  if (artifactA.metadata?.spectralLowPassDetected || artifactA.metadata?.audioSpectrogramMatch || artifactB.metadata?.audioSpectrogramMatch) {
    const specObs = store.createObservation({
      runId: run.id,
      artifactId: artifactB.id,
      observationType: 'AUDIO_SPECTRAL_OBSERVATION',
      target: 'audioSpectrum',
      value: { match: artifactA.metadata?.audioSpectrogramMatch || 0.72 },
      confidence: 0.88,
      metadata: { isDemo }
    });
    observations.push(specObs);

    const specEv = store.createEvidence({
      observationIds: [specObs.id],
      independenceGroupId: `IG-AUDSPEC-${artifactA.id}-${artifactB.id}`,
      evidenceType: 'AUDIO_SPECTRAL_EVIDENCE',
      description: 'Audio spectral analysis indicates frequency band truncation or divergence.',
      confidence: 0.85,
      polarity: EvidencePolarity.SUPPORTING,
      metadata: { isDemo }
    });
    evidenceList.push(specEv);

    const specTrf = store.createTransformation({
      investigationId,
      sourceArtifactId: artifactA.id,
      targetArtifactId: artifactB.id,
      type: TransformationTypes.AUDIO_SPECTRAL_MODIFICATION,
      direction: TransformationDirection.UNDIRECTED,
      observations: [specObs.id],
      evidenceIds: [specEv.id],
      analysisRunId: run.id,
      analysisMethodId: 'METHOD-GENEALOGY-AUDIO-SPEC-01',
      confidence: 0.85,
      epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
      limitations: ['Audio spectral divergences may result from lossy acoustic compression codecs.'],
      measurements: { match: artifactA.metadata?.audioSpectrogramMatch || 0.72 },
      isDemo
    });
    createdTransformations.push(specTrf);
  }

  if ((audioA || audioB) && isVisuallyRelated) {
    if (audioA && !audioB) {
      // Audio stripped / extracted
      const audObs = store.createObservation({
        runId: run.id,
        artifactId: artifactB.id,
        observationType: 'AUDIO_STREAM_ABSENCE',
        target: 'audio',
        value: { audioA_present: true, audioB_present: false },
        confidence: 1.0,
        metadata: { isDemo }
      });
      observations.push(audObs);

      const audEv = store.createEvidence({
        observationIds: [audObs.id],
        independenceGroupId: `IG-AUDIO-${artifactA.id}-${artifactB.id}`,
        evidenceType: 'AUDIO_EXTRACTION_EVIDENCE',
        description: `Target artifact ${artifactB.id} contains no audio stream while ${artifactA.id} includes audio track.`,
        confidence: 0.90,
        polarity: EvidencePolarity.SUPPORTING,
        metadata: { isDemo }
      });
      evidenceList.push(audEv);

      const audTrf = store.createTransformation({
        investigationId,
        sourceArtifactId: artifactA.id,
        targetArtifactId: artifactB.id,
        type: TransformationTypes.AUDIO_EXTRACTION,
        direction: TransformationDirection.FORWARD,
        observations: [audObs.id],
        evidenceIds: [audEv.id],
        analysisRunId: run.id,
        analysisMethodId: 'METHOD-GENEALOGY-AUDIO-01',
        confidence: 0.90,
        epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
        limitations: [
          'Target lacks audio track present in source; does not prove intentional audio suppression.'
        ],
        measurements: { audioStreamRemoved: true },
        isDemo
      });
      createdTransformations.push(audTrf);
    } else if (audioA && audioB) {
      // Both have audio — compare
      const isAudioHashDiff = audioA.sha256 && audioB.sha256 && audioA.sha256 !== audioB.sha256;
      const isAudioCodecDiff = audioA.codec && audioB.codec && audioA.codec !== audioB.codec;
      const isTimingDiff = audioA.offsetMs !== undefined && audioB.offsetMs !== undefined && audioA.offsetMs !== audioB.offsetMs;

      if (isAudioHashDiff && !isAudioCodecDiff) {
        // Different audio content entirely
        const audDiffObs = store.createObservation({
          runId: run.id,
          artifactId: artifactB.id,
          observationType: 'AUDIO_WAVEFORM_DISCREPANCY',
          target: 'audio.sha256',
          value: { audioA, audioB },
          confidence: 0.92,
          metadata: { isDemo }
        });
        observations.push(audDiffObs);

        const audDiffEv = store.createEvidence({
          observationIds: [audDiffObs.id],
          independenceGroupId: `IG-AUDREPLACE-${artifactA.id}-${artifactB.id}`,
          evidenceType: 'AUDIO_DIFFERENCE_EVIDENCE',
          description: 'Audio differs between versions while video frames remain perceptually consistent.',
          confidence: 0.88,
          polarity: EvidencePolarity.SUPPORTING,
          metadata: { isDemo }
        });
        evidenceList.push(audDiffEv);

        const audDiffTrf = store.createTransformation({
          investigationId,
          sourceArtifactId: artifactA.id,
          targetArtifactId: artifactB.id,
          type: TransformationTypes.AUDIO_REPLACEMENT,
          direction: TransformationDirection.FORWARD,
          observations: [audDiffObs.id],
          evidenceIds: [audDiffEv.id],
          analysisRunId: run.id,
          analysisMethodId: 'METHOD-GENEALOGY-AUDIO-02',
          confidence: 0.88,
          epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
          limitations: [
            'Audio characteristics differ between versions. Does not automatically prove malicious replacement or track substitution without independent source audio.'
          ],
          measurements: { audioDiscrepancy: true },
          isDemo
        });
        createdTransformations.push(audDiffTrf);
      } else if (isAudioCodecDiff) {
        const audCodecObs = store.createObservation({
          runId: run.id,
          artifactId: artifactB.id,
          observationType: 'AUDIO_CODEC_DISCREPANCY',
          target: 'audio.codec',
          value: { codecA: audioA.codec, codecB: audioB.codec },
          confidence: 0.95,
          metadata: { isDemo }
        });
        observations.push(audCodecObs);

        const audCodecEv = store.createEvidence({
          observationIds: [audCodecObs.id],
          independenceGroupId: `IG-AUDCODEC-${artifactA.id}-${artifactB.id}`,
          evidenceType: 'AUDIO_REENCODING_EVIDENCE',
          description: `Audio track re-encoding observed: ${audioA.codec} -> ${audioB.codec}.`,
          confidence: 0.90,
          polarity: EvidencePolarity.SUPPORTING,
          metadata: { isDemo }
        });
        evidenceList.push(audCodecEv);

        const audCodecTrf = store.createTransformation({
          investigationId,
          sourceArtifactId: artifactA.id,
          targetArtifactId: artifactB.id,
          type: TransformationTypes.AUDIO_REENCODING,
          direction: TransformationDirection.UNDIRECTED,
          observations: [audCodecObs.id],
          evidenceIds: [audCodecEv.id],
          analysisRunId: run.id,
          analysisMethodId: 'METHOD-GENEALOGY-AUDIO-03',
          confidence: 0.90,
          epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
          limitations: ['Audio re-encoding occurs during standard transcode.'],
          measurements: { codecA: audioA.codec, codecB: audioB.codec },
          isDemo
        });
        createdTransformations.push(audCodecTrf);
      }

      if (isTimingDiff) {
        const timingObs = store.createObservation({
          runId: run.id,
          artifactId: artifactB.id,
          observationType: 'AUDIO_VIDEO_SYNC_TIMING',
          target: 'audio.offsetMs',
          value: { offsetA: audioA.offsetMs, offsetB: audioB.offsetMs },
          confidence: 0.90,
          metadata: { isDemo }
        });
        observations.push(timingObs);

        const timingEv = store.createEvidence({
          observationIds: [timingObs.id],
          independenceGroupId: `IG-AUDTIME-${artifactA.id}-${artifactB.id}`,
          evidenceType: 'AUDIO_VIDEO_TIMING_EVIDENCE',
          description: `A/V synchronization timing shift observed (${audioA.offsetMs}ms vs ${audioB.offsetMs}ms).`,
          confidence: 0.86,
          polarity: EvidencePolarity.SUPPORTING,
          metadata: { isDemo }
        });
        evidenceList.push(timingEv);

        const timingTrf = store.createTransformation({
          investigationId,
          sourceArtifactId: artifactA.id,
          targetArtifactId: artifactB.id,
          type: TransformationTypes.AUDIO_VIDEO_TIMING_CHANGE,
          direction: TransformationDirection.UNDIRECTED,
          observations: [timingObs.id],
          evidenceIds: [timingEv.id],
          analysisRunId: run.id,
          analysisMethodId: 'METHOD-GENEALOGY-AUDIO-04',
          confidence: 0.86,
          epistemicStatus: TransformationEpistemicStatus.SUPPORTED,
          limitations: ['Audio/video synchronization offsets can result from muxer drift or player alignment differences.'],
          measurements: { offsetA: audioA.offsetMs, offsetB: audioB.offsetMs },
          isDemo
        });
        createdTransformations.push(timingTrf);
      }
    }
  }

  // ── 10. UNKNOWN / INCONCLUSIVE TRANSFORMATION HANDLING ──────────────────────
  let overallStatus = TransformationEpistemicStatus.UNKNOWN;
  let relType = RelationshipTypes.UNKNOWN_RELATIONSHIP;
  let relConfidence = 0.3;
  let relStatus = 'INCONCLUSIVE';

  if (!isVisuallyRelated) {
    overallStatus = TransformationEpistemicStatus.UNKNOWN;
    relType = RelationshipTypes.UNKNOWN_RELATIONSHIP;
    competingHypotheses.push({
      type: 'UNRELATED_MEDIA',
      status: 'SUPPORTED',
      explanation: 'Perceptual fingerprint distance exceeds correlation threshold; no direct transformation established.'
    });
  } else if (createdTransformations.length > 0) {
    overallStatus = TransformationEpistemicStatus.SUPPORTED;
    relType = RelationshipTypes.TRANSFORMED_VERSION;
    relConfidence = 0.85;
    relStatus = 'INFERRED';
  } else {
    overallStatus = TransformationEpistemicStatus.POSSIBLE;
    relType = RelationshipTypes.POSSIBLY_DERIVED;
    relConfidence = 0.60;
    relStatus = 'INFERRED';
    competingHypotheses.push({
      type: 'COMMON_SOURCE_OR_DERIVATIVE',
      status: 'POSSIBLE',
      explanation: 'Content is visually consistent without measurable geometric or container variance.'
    });
  }

  // Check conflicting transformation evidence
  const hasConflictingEvidence = options.hasConflictingEvidence || 
    (artifactA.metadata?.conflictingSignal && artifactB.metadata?.conflictingSignal);

  if (hasConflictingEvidence) {
    overallStatus = TransformationEpistemicStatus.CONFLICTING;
    relStatus = 'CONFLICTING';
    competingHypotheses.push({
      type: 'CONFLICTING_INTERPRETATIONS',
      status: 'CONFLICTING',
      explanation: 'Conflicting physical signals prevent definitive transformation classification.'
    });
  }

  const relationshipEvidenceIds = evidenceList.map(e => e.id);

  const relationship = store.createRelationship({
    investigationId,
    fromArtifactId: artifactA.id,
    toArtifactId: artifactB.id,
    relationshipType: relType,
    evidenceIds: relationshipEvidenceIds,
    confidence: relConfidence,
    status: relStatus,
    metadata: {
      visualSimilarity: visualSim,
      transformations: createdTransformations.map(t => t.type),
      transformationIds: createdTransformations.map(t => t.id),
      epistemicStatus: overallStatus,
      isDemo
    }
  });

  // Create explicit Finding
  const findingTitle = isVisuallyRelated
    ? (createdTransformations.length > 0
        ? `Transformation Analysis: ${createdTransformations.map(t => t.type).join(', ')}`
        : 'Visual Consistency Observed')
    : 'Inconclusive Media Relationship';

  const findingSummary = isVisuallyRelated
    ? `Artifact ${artifactB.id} exhibits ${(visualSim * 100).toFixed(0)}% visual similarity with Artifact ${artifactA.id}. ${createdTransformations.length > 0 ? `Identified transformations: ${createdTransformations.map(t => t.type).join(', ')}.` : 'No geometric or container transformation measured.'}`
    : `Artifacts ${artifactA.id} and ${artifactB.id} do not share sufficient perceptual similarity to infer transformation.`;

  const finding = store.createFinding({
    investigationId,
    title: findingTitle,
    summary: findingSummary,
    status: isVisuallyRelated ? FindingStatus.INFERRED : FindingStatus.INCONCLUSIVE,
    confidence: relConfidence,
    evidenceIds: relationshipEvidenceIds,
    limitations: limitationList
  });
  findings.push(finding);

  // Backward compatibility string array of transformations
  const transformationNames = createdTransformations.map(t => {
    switch (t.type) {
      case TransformationTypes.RESIZE: return `Resolution scaling (${dimA.width}x${dimA.height} -> ${dimB.width}x${dimB.height})`;
      case TransformationTypes.CROP: return `Geometric crop (${aspectA}:1 -> ${aspectB}:1)`;
      case TransformationTypes.LETTERBOX: return `Border letterboxing (${aspectA}:1 -> ${aspectB}:1)`;
      case TransformationTypes.RECOMPRESSION: return `Payload recompression (${Math.round((1 - sizeRatio) * 100)}% reduction)`;
      case TransformationTypes.FORMAT_CONVERSION: return `Format conversion (${artifactA.mimeType} -> ${artifactB.mimeType})`;
      case TransformationTypes.METADATA_STRIPPING: return `Metadata stripping (${t.measurements?.strippedKeys?.join(', ') || 'tags'})`;
      case TransformationTypes.METADATA_ADDITION: return `Metadata addition (${t.measurements?.addedKeys?.join(', ') || 'tags'})`;
      case TransformationTypes.FRAME_TRIMMING: return `Video duration trimming (${durationA}s -> ${durationB}s)`;
      case TransformationTypes.FRAME_RATE_CHANGE: return `Frame rate change (${fpsA}fps -> ${fpsB}fps)`;
      case TransformationTypes.AUDIO_EXTRACTION: return 'Audio stream extracted/removed';
      case TransformationTypes.AUDIO_REPLACEMENT: return 'Audio track differs between versions';
      case TransformationTypes.AUDIO_REENCODING: return 'Audio codec re-encoded';
      case TransformationTypes.AUDIO_VIDEO_TIMING_CHANGE: return 'A/V synchronization timing shift';
      default: return t.type;
    }
  });

  return {
    run,
    observations,
    evidence: evidenceList,
    findings,
    relationship,
    isExactMatch: false,
    perceptualSimilarity: visualSim,
    transformations: transformationNames,
    detailedTransformations: createdTransformations,
    hypotheses: competingHypotheses,
    identity: {
      isExactMatch: false,
      sha256A: artifactA.sha256,
      sha256B: artifactB.sha256
    },
    visualComparison: {
      perceptualSimilarity: visualSim,
      hammingDistance: pDistance,
      isVisuallyRelated
    },
    videoComparison: isVideo ? {
      durationA,
      durationB,
      durationDelta: Number(Math.abs(durationA - durationB).toFixed(2)),
      fpsA,
      fpsB,
      codecA,
      codecB
    } : null,
    audioComparison: (audioA || audioB) ? {
      audioPresentA: Boolean(audioA),
      audioPresentB: Boolean(audioB),
      codecA: audioA?.codec || null,
      codecB: audioB?.codec || null
    } : null,
    timestamps: compareTimestamps(artifactA, artifactB),
    epistemicStatus: overallStatus,
    limitations: limitationList,
    isDemo
  };
}

/**
 * Compares timestamps according to Phase F & I rules:
 * - recordingTimestamp
 * - fileMetadataTimestamp
 * - publicationTimestamp
 * - observedTimestamp
 * - retrievalTimestamp
 * Never infers historical order solely from quality or compression.
 */
export function compareTimestamps(storeOrArtA, artAOrArtB, maybeArtB) {
  let store = null;
  let artifactA = null;
  let artifactB = null;

  if (storeOrArtA && typeof storeOrArtA.getArtifact === 'function') {
    store = storeOrArtA;
    artifactA = typeof artAOrArtB === 'string' ? store.getArtifact(artAOrArtB) : artAOrArtB;
    artifactB = typeof maybeArtB === 'string' ? store.getArtifact(maybeArtB) : maybeArtB;
  } else {
    artifactA = storeOrArtA;
    artifactB = artAOrArtB;
  }

  const getTs = (art) => {
    let pubTs = art?.publicationTimestamp || art?.metadata?.publicationTimestamp || null;
    let obsTs = art?.observedTimestamp || art?.createdAt || null;

    if (store && art) {
      const apps = store.getAppearancesByArtifact(art.id);
      const pubs = apps.map(a => a.publishedAt).filter(Boolean);
      if (pubs.length > 0) {
        pubs.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        pubTs = pubs[0];
      }
      const obs = apps.map(a => a.observedAt).filter(Boolean);
      if (obs.length > 0) {
        obs.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        obsTs = obs[0];
      }
    }

    return {
      recordingTimestamp: art?.recordingTimestamp || art?.metadata?.recordingTimestamp || null,
      fileMetadataTimestamp: art?.fileMetadataTimestamp || art?.metadata?.fileMetadataTimestamp || null,
      publicationTimestamp: pubTs,
      observedTimestamp: obsTs,
      retrievalTimestamp: art?.retrievalTimestamp || art?.metadata?.retrievalTimestamp || null
    };
  };

  const tsA = getTs(artifactA);
  const tsB = getTs(artifactB);

  // Check conflicting timestamps across appearances
  if (store && artifactA) {
    const appsA = store.getAppearancesByArtifact(artifactA.id);
    const uniquePubsA = new Set(appsA.map(a => a.publishedAt).filter(Boolean));
    if (uniquePubsA.size > 1) {
      return {
        artifactA_timestamps: tsA,
        artifactB_timestamps: tsB,
        temporalStatus: 'CONFLICTING',
        direction: TransformationDirection.UNDIRECTED,
        status: TransformationEpistemicStatus.HYPOTHETICAL,
        explanation: 'Conflicting publication timestamps observed across multiple source appearances.',
        orderingExplanation: 'Conflicting publication timestamps observed across multiple source appearances.',
        ruleNotice: 'Historical order is determined strictly by authoritative timestamp evidence, never inferred from quality or compression alone.'
      };
    }
  }

  let temporalStatus = 'UNKNOWN';
  let direction = TransformationDirection.UNDIRECTED;
  let status = TransformationEpistemicStatus.HYPOTHETICAL;
  let explanation = 'Insufficient timestamp data to establish chronological precedence.';

  const pubA = tsA.publicationTimestamp ? new Date(tsA.publicationTimestamp).getTime() : null;
  const pubB = tsB.publicationTimestamp ? new Date(tsB.publicationTimestamp).getTime() : null;

  if (pubA && pubB) {
    if (pubA < pubB) {
      temporalStatus = 'CHRONOLOGICALLY_PRECEDES';
      direction = TransformationDirection.FORWARD;
      status = TransformationEpistemicStatus.SUPPORTED;
      explanation = `Artifact ${artifactA.id} was published earlier (${tsA.publicationTimestamp}) and precedes ${artifactB.id} (${tsB.publicationTimestamp}).`;
    } else if (pubB < pubA) {
      temporalStatus = 'CHRONOLOGICALLY_SUCCEEDS';
      direction = TransformationDirection.REVERSE;
      status = TransformationEpistemicStatus.SUPPORTED;
      explanation = `Artifact ${artifactB.id} was published earlier (${tsB.publicationTimestamp}) and precedes ${artifactA.id} (${tsA.publicationTimestamp}).`;
    } else {
      temporalStatus = 'SIMULTANEOUS';
      direction = TransformationDirection.UNDIRECTED;
      status = TransformationEpistemicStatus.SUPPORTED;
      explanation = 'Both artifacts carry identical publication timestamps.';
    }
  }

  return {
    artifactA_timestamps: tsA,
    artifactB_timestamps: tsB,
    temporalStatus,
    direction,
    status,
    explanation,
    orderingExplanation: explanation,
    ruleNotice: 'Historical order is determined strictly by authoritative timestamp evidence, never inferred from quality or compression alone.'
  };
}

/**
 * Builds the complete Media History Genealogy Graph for an investigation.
 * Supports multi-step graphs, competing parents, and multiple descendants.
 */
export function buildGenealogyGraph(store, investigationId) {
  const investigation = store.getInvestigation(investigationId);
  if (!investigation) {
    throw new Error(`Investigation not found: ${investigationId}`);
  }

  const isDemo = Boolean(investigation.isDemo);

  // Collect artifacts (strictly isolated by demo status)
  const allArtifacts = (investigation.artifactIds || [])
    .map(id => store.getArtifact(id))
    .filter(Boolean)
    .filter(a => Boolean(a.isDemo) === isDemo);

  // Graph Nodes
  const nodes = allArtifacts.map((art, idx) => ({
    id: art.id,
    label: art.filename || `Artifact ${art.id}`,
    versionLabel: `Version ${String.fromCharCode(65 + idx)}`,
    mimeType: art.mimeType,
    byteSize: art.byteSize,
    sha256: art.sha256,
    perceptualHash: art.perceptualHash,
    dimensions: art.dimensions || { width: 1920, height: 1080 },
    duration: art.duration || 0,
    isReference: Boolean(art.isReference),
    isDemo: Boolean(art.isDemo),
    createdAt: art.createdAt,
    metadata: art.metadata || {}
  }));

  // Graph Edges & Transformations
  const edges = [];
  const edgeSet = new Set();

  // 1. Gather all recorded relationships for this investigation
  const relationships = Array.from(store.relationships.values()).filter(
    r => r.investigationId === investigationId
  );

  relationships.forEach(rel => {
    const artFrom = store.getArtifact(rel.fromArtifactId);
    const artTo = store.getArtifact(rel.toArtifactId);
    if (!artFrom || !artTo) return;
    if (Boolean(artFrom.isDemo) !== isDemo || Boolean(artTo.isDemo) !== isDemo) return;

    const edgeKey = `${rel.fromArtifactId}->${rel.toArtifactId}`;
    if (edgeSet.has(edgeKey)) return;
    edgeSet.add(edgeKey);

    // Find linked transformations
    const linkedTrfs = Array.from(store.transformations.values()).filter(
      t => (t.sourceArtifactId === rel.fromArtifactId && t.targetArtifactId === rel.toArtifactId) ||
           (t.sourceArtifactId === rel.toArtifactId && t.targetArtifactId === rel.fromArtifactId)
    );

    const linkedEvidence = (rel.evidenceIds || []).map(eid => store.getEvidence(eid)).filter(Boolean);

    edges.push({
      id: rel.id,
      source: rel.fromArtifactId,
      target: rel.toArtifactId,
      relationshipType: rel.relationshipType,
      transformations: linkedTrfs.map(t => t.type),
      transformationDetails: linkedTrfs,
      confidence: rel.confidence,
      epistemicStatus: rel.status || 'INFERRED',
      evidenceIds: rel.evidenceIds || [],
      evidence: linkedEvidence,
      measurements: rel.metadata?.measurements || {},
      limitations: [
        'Genealogy edge represents technical consistency between artifacts.',
        'Historical sequence must be verified with external publication records.'
      ],
      competingHypotheses: rel.metadata?.competingHypotheses || [],
      direction: rel.metadata?.direction || 'FORWARD'
    });
  });

  // 2. Discover automatic pairwise transformations if none recorded yet
  if (edges.length === 0 && allArtifacts.length > 1) {
    for (let i = 0; i < allArtifacts.length - 1; i++) {
      const artA = allArtifacts[i];
      const artB = allArtifacts[i + 1];
      const comparison = analyzeArtifactTransformations(store, investigationId, artA.id, artB.id);
      
      edges.push({
        id: comparison.relationship.id,
        source: artA.id,
        target: artB.id,
        relationshipType: comparison.relationship.relationshipType,
        transformations: comparison.detailedTransformations.map(t => t.type),
        transformationDetails: comparison.detailedTransformations,
        confidence: comparison.relationship.confidence,
        epistemicStatus: comparison.epistemicStatus,
        evidenceIds: comparison.relationship.evidenceIds,
        evidence: comparison.evidence,
        measurements: comparison.detailedTransformations[0]?.measurements || {},
        limitations: comparison.limitations,
        competingHypotheses: comparison.hypotheses.map(h => h.explanation),
        direction: 'FORWARD'
      });
    }
  }

  // 3. Integrate earliest observed appearance from timeline or direct appearances
  const timeline = buildMediaTimeline(store, investigationId);
  let earliestObservedAppearance = timeline?.earliestObservedAppearance || null;
  if (!earliestObservedAppearance) {
    const apps = Array.from(store.appearances.values()).filter(a => a.investigationId === investigationId);
    if (apps.length > 0) {
      const sortedApps = [...apps].sort((a, b) => {
        const tA = new Date(a.publishedAt || a.observedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.publishedAt || b.observedAt || b.createdAt || 0).getTime();
        return tA - tB;
      });
      const earliestApp = sortedApps[0];
      earliestObservedAppearance = {
        appearanceId: earliestApp.id,
        artifactId: earliestApp.artifactId,
        sourceId: earliestApp.sourceId,
        publishedAt: earliestApp.publishedAt,
        observedAt: earliestApp.observedAt,
        summary: `Earliest observed appearance in evidence on ${earliestApp.publishedAt || earliestApp.observedAt}`
      };
    }
  }

  return {
    investigationId,
    title: investigation.title,
    nodes,
    edges,
    competingHypotheses: [
      'Evidence supports directional resolution scaling across indexed nodes.',
      'Alternative hypothesis: intermediate social media proxies transcoded content before observation.'
    ],
    earliestObservedAppearance,
    isDemo,
    createdAt: new Date().toISOString()
  };
}

/**
 * Traces a transformation entity to its supporting Evidence, Observations,
 * AnalysisRun, and MediaArtifacts.
 */
export function traceTransformation(store, transformationId) {
  const trf = store.getTransformation(transformationId);
  if (!trf) {
    throw new Error(`Transformation not found: ${transformationId}`);
  }

  const sourceArtifact = store.getArtifact(trf.sourceArtifactId);
  const targetArtifact = store.getArtifact(trf.targetArtifactId);
  const run = trf.analysisRunId ? store.getAnalysisRun(trf.analysisRunId) : null;

  const observations = (trf.observationIds || []).map(id => store.getObservation(id)).filter(Boolean);
  const evidence = (trf.evidenceIds || []).map(id => store.getEvidence(id)).filter(Boolean);

  const evidenceChain = evidence.map(ev => ({
    evidence: ev,
    observations: (ev.observationIds || []).map(id => {
      const obs = store.getObservation(id);
      if (!obs) return null;
      return {
        ...obs,
        analysisRun: obs.runId ? store.getAnalysisRun(obs.runId) : null
      };
    }).filter(Boolean)
  }));

  return {
    transformation: trf,
    sourceArtifact,
    targetArtifact,
    analysisRun: run,
    analysisMethod: run?.method || trf.analysisMethodId,
    observations,
    evidence,
    evidenceChain,
    traceabilityChain: {
      transformationId: trf.id,
      evidenceCount: evidence.length,
      observationCount: observations.length,
      method: run?.method || trf.analysisMethodId,
      verified: evidence.length > 0
    }
  };
}
