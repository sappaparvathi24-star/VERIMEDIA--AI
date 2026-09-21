// VeriMedia AI — Audio Forensics Engine
// Analyzes audio streams, codec containers, waveform statistics, clipping/distortion, and silence profiles.

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createEngineResult, EngineStatus } from './analysisContract.js';

const execFileAsync = promisify(execFile);

/**
 * Runs ffprobe on an audio file or buffer to extract stream and container metadata.
 */
async function probeAudioFile(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);
    return JSON.parse(stdout);
  } catch (err) {
    return null;
  }
}

/**
 * Analyzes audio volume and silence profiles using ffmpeg volumedetect and silencedetect filters.
 */
async function analyzeAudioVolumeAndSilence(filePath) {
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-i', filePath,
      '-af', 'volumedetect,silencedetect=noise=-35dB:d=0.3',
      '-f', 'null',
      '-'
    ]);

    const meanVolumeMatch = stderr.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
    const maxVolumeMatch = stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/);

    const meanVolume = meanVolumeMatch ? parseFloat(meanVolumeMatch[1]) : null;
    const maxVolume = maxVolumeMatch ? parseFloat(maxVolumeMatch[1]) : null;

    // Detect clipping: max volume approaching or at 0.0 dB
    const hasClipping = maxVolume !== null && maxVolume >= -0.05;

    // Count silence segments
    const silenceStarts = (stderr.match(/silence_start/g) || []).length;
    const silenceEnds = (stderr.match(/silence_end/g) || []).length;

    return {
      meanVolumeDb: meanVolume,
      maxVolumeDb: maxVolume,
      hasClipping,
      silenceEvents: silenceStarts,
      dynamicRangeDb: (meanVolume !== null && maxVolume !== null)
        ? Math.abs(maxVolume - meanVolume)
        : null
    };
  } catch (err) {
    return {
      meanVolumeDb: null,
      maxVolumeDb: null,
      hasClipping: false,
      silenceEvents: 0,
      dynamicRangeDb: null,
      error: err.message
    };
  }
}

/**
 * Executes comprehensive Audio Forensic Analysis on an audio file buffer or path.
 * @param {Buffer|string} input - Audio Buffer or file path
 * @param {object} [opts]
 * @returns {Promise<object>} Canonical analysis contract result
 */
export async function analyzeAudio(input, opts = {}) {
  const startedAt = new Date().toISOString();
  let tmpPath = null;
  let isTemp = false;

  try {
    let filePath = '';
    let buffer = null;

    if (Buffer.isBuffer(input)) {
      buffer = input;
      tmpPath = path.join(os.tmpdir(), `vm_audio_${crypto.randomBytes(8).toString('hex')}.tmp`);
      fs.writeFileSync(tmpPath, buffer);
      filePath = tmpPath;
      isTemp = true;
    } else if (typeof input === 'string' && fs.existsSync(input)) {
      filePath = input;
      buffer = fs.readFileSync(filePath);
    } else {
      return createEngineResult({
        engine: 'AUDIO_FORENSICS',
        status: EngineStatus.FAILED,
        applicable: true,
        startedAt,
        completedAt: new Date().toISOString(),
        errors: ['Invalid audio input: buffer or existing file path required'],
        realAnalysis: false
      });
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1. Probe audio container and streams
    const probeData = await probeAudioFile(filePath);
    if (!probeData || !probeData.streams || probeData.streams.length === 0) {
      return createEngineResult({
        engine: 'AUDIO_FORENSICS',
        status: EngineStatus.FAILED,
        applicable: true,
        startedAt,
        completedAt: new Date().toISOString(),
        errors: ['Failed to read audio streams via ffprobe'],
        realAnalysis: true
      });
    }

    const audioStream = probeData.streams.find(s => s.codec_type === 'audio') || probeData.streams[0];
    const format = probeData.format || {};

    const durationSeconds = parseFloat(audioStream.duration || format.duration || 0);
    const sampleRate = parseInt(audioStream.sample_rate || 0, 10);
    const channels = parseInt(audioStream.channels || 1, 10);
    const codec = audioStream.codec_name || 'unknown';
    const bitrate = parseInt(audioStream.bit_rate || format.bit_rate || 0, 10);

    // 2. Volume, clipping, dynamic range, and silence analysis
    const volumeStats = await analyzeAudioVolumeAndSilence(filePath);

    // 3. Observations and measurements
    const observations = [];
    const measurements = [
      { name: 'sha256', value: sha256, type: 'CRYPTOGRAPHIC_HASH' },
      { name: 'durationSeconds', value: durationSeconds, unit: 's' },
      { name: 'sampleRate', value: sampleRate, unit: 'Hz' },
      { name: 'channels', value: channels, unit: 'count' },
      { name: 'codec', value: codec, type: 'CONTAINER_METADATA' },
      { name: 'bitrate', value: bitrate, unit: 'bps' }
    ];

    if (volumeStats.meanVolumeDb !== null) {
      measurements.push({ name: 'meanVolumeDb', value: volumeStats.meanVolumeDb, unit: 'dB' });
    }
    if (volumeStats.maxVolumeDb !== null) {
      measurements.push({ name: 'maxVolumeDb', value: volumeStats.maxVolumeDb, unit: 'dB' });
    }
    if (volumeStats.dynamicRangeDb !== null) {
      measurements.push({ name: 'dynamicRangeDb', value: volumeStats.dynamicRangeDb, unit: 'dB' });
    }

    observations.push({
      category: 'CONTAINER',
      title: 'Audio Stream Specifications',
      detail: `Codec: ${codec.toUpperCase()}, Sample Rate: ${sampleRate}Hz, Channels: ${channels}, Duration: ${durationSeconds.toFixed(2)}s`
    });

    if (volumeStats.hasClipping) {
      observations.push({
        category: 'INTEGRITY_ANOMALY',
        title: 'Potential Audio Clipping / Dynamic Range Distortion',
        detail: `Max recorded volume peaked at ${volumeStats.maxVolumeDb} dB, indicating digital saturation or aggressive dynamic compression.`
      });
    }

    if (volumeStats.silenceEvents > 5) {
      observations.push({
        category: 'TEMPORAL_STRUCTURE',
        title: 'Frequent Silence / Gaps Detected',
        detail: `Encountered ${volumeStats.silenceEvents} discrete silence dropouts exceeding -35dB for >300ms.`
      });
    }

    const limitations = [
      'Audio spectral analysis is based on volume and container stream metadata without full acoustic biometric profiling.',
      'Synthetic voice generation (cloning/deepfake) requires external acoustic discriminator models.'
    ];

    return createEngineResult({
      engine: 'AUDIO_FORENSICS',
      status: EngineStatus.COMPLETED,
      applicable: true,
      startedAt,
      completedAt: new Date().toISOString(),
      observations,
      measurements,
      evidenceIds: [`ev_audio_${sha256.substring(0, 12)}`],
      limitations,
      source: 'LOCAL_FFPROBE_AUDIO_ENGINE',
      realAnalysis: true,
      extra: {
        audioMetadata: {
          codec,
          sampleRate,
          channels,
          durationSeconds,
          bitrate,
          volumeStats
        }
      }
    });
  } catch (err) {
    return createEngineResult({
      engine: 'AUDIO_FORENSICS',
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
