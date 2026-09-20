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
