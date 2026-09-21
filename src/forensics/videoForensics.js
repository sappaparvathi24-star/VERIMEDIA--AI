/**
 * VeriMedia AI — Video Forensics Module
 * Uses fluent-ffmpeg + @ffmpeg-installer/ffmpeg to extract metadata from video files.
 * Always returns a result object — never throws to caller.
 */
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

// Point fluent-ffmpeg at the bundled binary
try {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
} catch (_) {}

/**
 * Extract technical metadata from a video file path.
 * @param {string} filePath - Absolute path to the video file on disk
 * @returns {Promise<object>}
 */
export async function analyzeVideoMetadata(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      supported: false,
      status: 'FILE_NOT_FOUND',
      reason: `Video file not found at path: ${filePath}`
    };
  }

  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        resolve({
          supported: false,
          status: 'PROBE_FAILED',
          reason: err.message || 'ffprobe failed'
        });
        return;
      }

      try {
        const fmt = metadata.format || {};
        const streams = metadata.streams || [];
        const videoStream = streams.find(s => s.codec_type === 'video');
        const audioStream = streams.find(s => s.codec_type === 'audio');

        const duration = parseFloat(fmt.duration) || 0;
        const bitrate = parseInt(fmt.bit_rate) || 0;
        const size = parseInt(fmt.size) || 0;

        const fps = videoStream?.r_frame_rate
          ? evalFraction(videoStream.r_frame_rate)
          : null;

        const frameCount = videoStream?.nb_frames
          ? parseInt(videoStream.nb_frames)
          : (fps && duration ? Math.round(fps * duration) : null);

        resolve({
          supported: true,
          status: 'ANALYZED',
          isRealAnalysis: true,
          codec: videoStream?.codec_name || null,
          codecLongName: videoStream?.codec_long_name || null,
          duration: Number(duration.toFixed(3)),
          fps: fps ? Number(fps.toFixed(3)) : null,
          frameCount,
          resolution: videoStream
            ? { width: videoStream.width || null, height: videoStream.height || null }
            : null,
          bitrate,
          byteSize: size,
          audioCodec: audioStream?.codec_name || null,
          audioChannels: audioStream?.channels || null,
          audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : null,
          container: fmt.format_name || null,
          creationTime: fmt.tags?.creation_time || null,
          streamCount: streams.length
        });
      } catch (parseErr) {
        resolve({
          supported: false,
          status: 'PARSE_FAILED',
          reason: parseErr.message
        });
      }
    });
  });
}

/**
 * Extract a single keyframe from a video as a JPEG buffer.
 * @param {string} filePath
 * @param {number} [timestampSeconds=1] - Position to extract frame from
 * @returns {Promise<{supported: boolean, buffer?: Buffer, error?: string}>}
 */
export async function extractKeyframe(filePath, timestampSeconds = 1) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { supported: false, error: 'File not found' };
  }

  const tmpFile = path.join(os.tmpdir(), `vm_kf_${crypto.randomBytes(6).toString('hex')}.jpg`);

  return new Promise((resolve) => {
    ffmpeg(filePath)
      .seekInput(timestampSeconds)
      .frames(1)
      .output(tmpFile)
      .on('end', () => {
        try {
          const buffer = fs.readFileSync(tmpFile);
          fs.unlinkSync(tmpFile);
          resolve({ supported: true, buffer, mimeType: 'image/jpeg' });
        } catch (e) {
          resolve({ supported: false, error: e.message });
        }
      })
      .on('error', (err) => {
        try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
        resolve({ supported: false, error: err.message });
      })
      .run();
  });
}

import { createEngineResult, EngineStatus } from './analysisContract.js';
import { computePerceptualFingerprints, hashSimilarity } from './perceptualHash.js';

/** Parse "num/den" fraction string to float */
function evalFraction(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return den !== 0 ? num / den : null;
  }
  return parseFloat(str) || null;
}

/**
 * Executes comprehensive Video Forensic Analysis on a video buffer or file path.
 * @param {Buffer|string} input - Video buffer or file path
 * @param {object} [opts]
 * @returns {Promise<object>} Canonical analysis contract result
 */
export async function analyzeVideo(input, opts = {}) {
  const startedAt = new Date().toISOString();
  let tmpPath = null;
  let isTemp = false;

  try {
    let filePath = '';
    let buffer = null;

    if (Buffer.isBuffer(input)) {
      buffer = input;
      tmpPath = path.join(os.tmpdir(), `vm_vid_${crypto.randomBytes(8).toString('hex')}.mp4`);
      fs.writeFileSync(tmpPath, buffer);
      filePath = tmpPath;
      isTemp = true;
    } else if (typeof input === 'string' && fs.existsSync(input)) {
      filePath = input;
      buffer = fs.readFileSync(filePath);
    } else {
      return createEngineResult({
        engine: 'VIDEO_FORENSICS',
        status: EngineStatus.FAILED,
        applicable: true,
        startedAt,
        completedAt: new Date().toISOString(),
        errors: ['Invalid video input: buffer or existing file path required'],
        realAnalysis: false
      });
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1. Probe technical video and audio stream metadata
    const meta = await analyzeVideoMetadata(filePath);
    if (!meta.supported) {
      return createEngineResult({
        engine: 'VIDEO_FORENSICS',
        status: EngineStatus.FAILED,
        applicable: true,
        startedAt,
        completedAt: new Date().toISOString(),
        errors: [meta.reason || 'Failed to inspect video streams via ffprobe'],
        realAnalysis: true
      });
    }

    const duration = meta.duration || 0;
    const keyframeTimestamp = duration > 1 ? 1 : (duration > 0.1 ? duration / 2 : 0);

    // 2. Extract primary keyframe
    const kfResult = await extractKeyframe(filePath, keyframeTimestamp);
    let keyframeFingerprints = null;
    if (kfResult.supported && kfResult.buffer) {
      keyframeFingerprints = await computePerceptualFingerprints(kfResult.buffer);
    }

    // 3. Multi-frame sampling across video duration (up to 4 sample points)
    const samplePoints = [];
    if (duration > 0.5) {
      samplePoints.push(duration * 0.2, duration * 0.5, duration * 0.8);
    } else {
      samplePoints.push(0);
    }

    const sampledFrames = [];
    for (let i = 0; i < samplePoints.length; i++) {
      const pt = samplePoints[i];
      const frameRes = await extractKeyframe(filePath, pt);
      if (frameRes.supported && frameRes.buffer) {
        const fps = await computePerceptualFingerprints(frameRes.buffer);
        sampledFrames.push({
          timestampSeconds: Number(pt.toFixed(2)),
          fingerprints: fps
        });
      }
    }

    // 4. Inter-frame similarity and jump detection
    let duplicateFramesDetected = false;
    let highTemporalChange = false;

    if (sampledFrames.length >= 2) {
      for (let i = 0; i < sampledFrames.length - 1; i++) {
        const hashA = sampledFrames[i].fingerprints?.aHash;
        const hashB = sampledFrames[i + 1].fingerprints?.aHash;
        if (hashA && hashB) {
          const sim = hashSimilarity(hashA, hashB);
          if (sim >= 0.99) {
            duplicateFramesDetected = true;
          } else if (sim < 0.40) {
            highTemporalChange = true;
          }
        }
      }
    }

    // 5. Structure measurements and observations
    const measurements = [
      { name: 'sha256', value: sha256, type: 'CRYPTOGRAPHIC_HASH' },
      { name: 'durationSeconds', value: duration, unit: 's' },
      { name: 'fps', value: meta.fps, unit: 'frames/sec' },
      { name: 'frameCount', value: meta.frameCount, unit: 'count' },
      { name: 'videoCodec', value: meta.codec, type: 'STREAM_METADATA' },
      { name: 'container', value: meta.container, type: 'CONTAINER_FORMAT' },
      { name: 'bitrate', value: meta.bitrate, unit: 'bps' },
      { name: 'streamCount', value: meta.streamCount, unit: 'count' }
    ];

    if (meta.resolution) {
      measurements.push(
        { name: 'width', value: meta.resolution.width, unit: 'px' },
        { name: 'height', value: meta.resolution.height, unit: 'px' }
      );
    }

    if (keyframeFingerprints?.aHash) {
      measurements.push(
        { name: 'keyframe_aHash', value: keyframeFingerprints.aHash, type: 'PERCEPTUAL_HASH' },
        { name: 'keyframe_dHash', value: keyframeFingerprints.dHash, type: 'PERCEPTUAL_HASH' },
        { name: 'keyframe_pHash', value: keyframeFingerprints.pHash, type: 'PERCEPTUAL_HASH' }
      );
    }

    const observations = [
      {
        category: 'STREAM_METADATA',
        title: 'Video Stream Parameters',
        detail: `Codec: ${meta.codec || 'unknown'}, Resolution: ${meta.resolution?.width}x${meta.resolution?.height}, FPS: ${meta.fps}, Duration: ${duration.toFixed(2)}s`
      }
    ];

    if (meta.audioCodec) {
      observations.push({
        category: 'AUDIO_TRACK',
        title: 'Embedded Audio Stream',
        detail: `Codec: ${meta.audioCodec}, Sample Rate: ${meta.audioSampleRate}Hz, Channels: ${meta.audioChannels}`
      });
    } else {
      observations.push({
        category: 'AUDIO_TRACK',
        title: 'No Audio Stream',
        detail: 'The video container contains no synchronized audio track.'
      });
    }

    if (duplicateFramesDetected) {
      observations.push({
        category: 'TEMPORAL_STRUCTURE',
        title: 'Identical Sampled Frame Signatures',
        detail: 'Sampled frame fingerprints exhibit >=99% perceptual match across distinct time points (possible static image loop or frame duplication).'
      });
    }

    if (highTemporalChange) {
      observations.push({
        category: 'TEMPORAL_STRUCTURE',
        title: 'Significant Inter-Frame Scene Discontinuity',
        detail: 'Sampled intervals indicate major perceptual divergence (<40% visual hash agreement), consistent with scene transitions or cut points.'
      });
    }

    const limitations = [
      'Temporal frame sampling evaluated across representative intervals rather than exhaustive decoded frame-by-frame deep scan.',
      'Container creation timestamp reflects container metadata which can be rewritten without re-encoding video content.'
    ];

    return createEngineResult({
      engine: 'VIDEO_FORENSICS',
      status: EngineStatus.COMPLETED,
      applicable: true,
      startedAt,
      completedAt: new Date().toISOString(),
      observations,
      measurements,
      evidenceIds: [`ev_vid_${sha256.substring(0, 12)}`],
      limitations,
      source: 'LOCAL_FFPROBE_FFMPEG_ENGINE',
      realAnalysis: true,
      extra: {
        videoMetadata: meta,
        keyframe: {
          timestampSeconds: keyframeTimestamp,
          hasBuffer: Boolean(kfResult.buffer),
          buffer: kfResult.buffer || null,
          fingerprints: keyframeFingerprints
        },
        sampledFrames
      }
    });
  } catch (err) {
    return createEngineResult({
      engine: 'VIDEO_FORENSICS',
      status: EngineStatus.FAILED,
      applicable: true,
      startedAt,
      completedAt: new Date().toISOString(),
      errors: [err.message],
      realAnalysis: true
    });
  } finally {
    if (isTemp && tmpPath && fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }
}
