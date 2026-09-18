import { createAnalysisMethod } from './models.js';

/**
 * Standard registry of internal analysis methods
 */
export const STANDARD_METHODS = [
  createAnalysisMethod({
    id: 'method_media_identity_v1',
    name: 'Media Identity Check',
    version: 'v1.0.0',
    description: 'Computes FIPS 180-4 SHA-256 byte digest and byte length verification.',
    limitations: 'Bit-for-bit SHA-256 hash changes upon any byte modification, even benign re-encoding.',
    epistemicCategory: 'CRYPTOGRAPHIC_MEASUREMENT',
    metadata: { domain: 'cryptographic_integrity' }
  }),
  createAnalysisMethod({
    id: 'method_metadata_extract_v1',
    name: 'Metadata Extraction',
    version: 'v1.0.0',
    description: 'Extracts container magic bytes, spatial dimensions, durations, and container header chunks.',
    limitations: 'Container headers can be stripped, rewritten, or spoofed by third-party encoding tools.',
    epistemicCategory: 'CONTAINER_STRUCTURAL_EXTRACTION',
    metadata: { domain: 'container_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_perceptual_fingerprint_v1',
    name: 'Perceptual Fingerprint',
    version: 'v1.0.0',
    description: 'Generates 64-bit spatial perceptual hash invariant to modest compression.',
    limitations: 'Perceptual hashing measures visual proximity, not absolute provenance or causal derivation.',
    epistemicCategory: 'PERCEPTUAL_INVARIANT_HASHING',
    metadata: { domain: 'perceptual_similarity' }
  }),
  createAnalysisMethod({
    id: 'method_jpeg_artifact_v1',
    name: 'JPEG Artifact Analysis',
    version: 'v1.0.0',
    description: 'Measures 8x8 discrete cosine transform grid consistency and localized quantization variance.',
    limitations: 'Ordinary platform recompression or multiple upload cycles may produce similar block inconsistencies.',
    epistemicCategory: 'COMPRESSION_STATISTICAL_HEURISTIC',
    metadata: { domain: 'compression_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_frame_consistency_v1',
    name: 'Frame Consistency Analysis',
    version: 'v1.0.0',
    description: 'Evaluates inter-frame motion vectors, frame cadence, and temporal continuity.',
    limitations: 'Variable framerate encoding or packet dropouts can simulate temporal inconsistency.',
    epistemicCategory: 'TEMPORAL_OPTICAL_FLOW_HEURISTIC',
    metadata: { domain: 'temporal_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_spatial_integrity_v1',
    name: 'Spatial Integrity Analysis',
    version: 'v1.0.0',
    description: 'Analyzes high-frequency residual noise patterns and edge gradient sharpness.',
    limitations: 'Lossy filtering or artificial sharpening applied by mobile cameras may introduce edge anomalies.',
    epistemicCategory: 'SPATIAL_FREQUENCY_HEURISTIC',
    metadata: { domain: 'spatial_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_face_landmarks_v1',
    name: 'Facial Landmark Consistency',
    version: 'v1.0.0',
    description: 'Inspects facial boundary contours and landmark alignment against head pose.',
    limitations: 'Extreme lighting angles or low resolution can degrade landmark tracking accuracy.',
    epistemicCategory: 'BIOMETRIC_ANATOMICAL_INSPECTION',
    metadata: { domain: 'biometric_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_provenance_correlation_v1',
    name: 'Provenance Correlation',
    version: 'v1.0.0',
    description: 'Correlates observed media against known discovery timestamps and publisher histories.',
    limitations: 'External discovery is limited to indexed platforms; earlier unindexed appearances may exist.',
    epistemicCategory: 'EXTERNAL_PROVENANCE_CORRELATION',
    metadata: { domain: 'provenance_tracking' }
  }),
  createAnalysisMethod({
    id: 'method_rule_engine_v1',
    name: 'Forensic Rule Engine Interpretation',
    version: 'v1.0.0',
    description: 'Multi-signal fusion combining spatial, container, and perceptual evidence into epistemic findings.',
    limitations: 'Combines independent evidence items; does not produce unassailable ontological truth proofs.',
    epistemicCategory: 'EPISTEMIC_FUSION_REASONING',
    metadata: { domain: 'epistemic_reasoning' }
  }),
  createAnalysisMethod({
    id: 'method_metadata_extraction_v1',
    name: 'Metadata Extraction & EXIF Inspection',
    version: 'v1.0.0',
    description: 'Parses container headers, EXIF APP1 segments, TIFF tags, and device software metadata tags.',
    limitations: 'Metadata can be stripped or modified during platform transcoding or web re-encoding.',
    epistemicCategory: 'CONTAINER_STRUCTURAL_EXTRACTION',
    metadata: { domain: 'metadata_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_pixel_anomaly_v1',
    name: 'Pixel Anomaly & Noise Variance Analysis',
    version: 'v1.0.0',
    description: 'Measures spatial high-frequency noise variance and local edge gradient coherence across pixel blocks.',
    limitations: 'Camera sensor noise reduction filters and artistic sharpening can elevate local noise variance.',
    epistemicCategory: 'SPATIAL_FREQUENCY_HEURISTIC',
    metadata: { domain: 'spatial_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_copy_region_v1',
    name: 'Copy-Region & Clone Detection',
    version: 'v1.0.0',
    description: 'Searches for identical or near-identical non-overlapping perceptual patch blocks within the image.',
    limitations: 'Repetitive textures such as sky, grass, or wall patterns may produce non-malicious block matches.',
    epistemicCategory: 'SPATIAL_PATCH_MATCHING',
    metadata: { domain: 'spatial_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_resizing_cropping_v1',
    name: 'Resizing, Cropping & Transformation Analysis',
    version: 'v1.0.0',
    description: 'Analyzes spatial frame dimensions, aspect ratios, and dimension scaling relative to reference artifacts.',
    limitations: 'Without a verified source reference artifact, absolute cropping or scaling remains unprovable.',
    epistemicCategory: 'TRANSFORMATION_GEOMETRIC_INSPECTION',
    metadata: { domain: 'transformation_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_video_stream_v1',
    name: 'Video Container & Stream Analysis',
    version: 'v1.0.0',
    description: 'Parses ISO video container boxes, codec configurations, keyframe GOP structures, and sample timing.',
    limitations: 'Transcoding across different video editors naturally alters container box structures.',
    epistemicCategory: 'CONTAINER_STRUCTURAL_EXTRACTION',
    metadata: { domain: 'video_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_audio_stream_v1',
    name: 'Audio Stream & Waveform Analysis',
    version: 'v1.0.0',
    description: 'Analyzes audio track codecs, sample rates, channel configurations, silence ratios, and peak clipping.',
    limitations: 'Audio compression artifacts and variable sample rates occur naturally in low-bitrate recordings.',
    epistemicCategory: 'ACOUSTIC_SIGNAL_INSPECTION',
    metadata: { domain: 'audio_forensics' }
  }),
  createAnalysisMethod({
    id: 'method_audiovisual_sync_v1',
    name: 'Audio-Video Stream Timing Alignment',
    version: 'v1.0.0',
    description: 'Cross-correlates video frame track timestamps with audio stream duration and presentation offsets.',
    limitations: 'Container muxing delays, editing track clips, and Bluetooth latency can create stream duration mismatches.',
    epistemicCategory: 'AUDIOVISUAL_TEMPORAL_ALIGNMENT',
    metadata: { domain: 'audiovisual_forensics' }
  })
];

const methodsMap = new Map();
STANDARD_METHODS.forEach(m => methodsMap.set(m.id, m));

export function getMethod(id) {
  return methodsMap.get(id) || null;
}

export function getAllMethods() {
  return Array.from(methodsMap.values());
}

export function registerMethod(method) {
  methodsMap.set(method.id, method);
  return method;
}
