import sharp from 'sharp';

/**
 * Perform Error-Level Analysis (ELA) on an image buffer.
 * Recompresses to JPEG at 90% quality and computes pixel-level absolute difference.
 */
export async function performErrorLevelAnalysis(imageBuffer, mimeType = 'image/jpeg') {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return {
      status: 'SKIPPED',
      reason: 'No image buffer provided',
      observations: []
    };
  }

  const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg';
  if (!isJpeg) {
    return {
      status: 'NOT_APPLICABLE',
      reason: 'Error-Level Analysis requires JPEG compression artifacts (DCT quantization blocks). Non-JPEG formats are not applicable.',
      isJpeg: false,
      limitations: [
        'ELA is strictly formulated for discrete cosine transform (DCT) compression grids.',
        'Formats such as PNG, WebP, SVG, and GIF do not share JPEG error decay characteristics.'
      ],
      observations: []
    };
  }

  try {
    const original = sharp(imageBuffer);
    const meta = await original.metadata();
    if (!meta.width || !meta.height) {
      return { status: 'ERROR', reason: 'Unable to decode image dimensions for ELA' };
    }

    // Limit maximum dimension to 1200px to bound processing time while preserving block grids
    const maxDim = Math.max(meta.width, meta.height);
    const scale = maxDim > 1200 ? 1200 / maxDim : 1.0;
    const targetW = Math.round(meta.width * scale);
    const targetH = Math.round(meta.height * scale);

    // Get raw RGB of original
    const origRaw = await original
      .resize(targetW, targetH, { fit: 'fill' })
      .toFormat('raw')
      .toBuffer();

    // Recompress at 90% JPEG quality
    const recompressedJpeg = await sharp(imageBuffer)
      .resize(targetW, targetH, { fit: 'fill' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Get raw RGB of recompressed
    const recompRaw = await sharp(recompressedJpeg)
      .toFormat('raw')
      .toBuffer();

    const minLen = Math.min(origRaw.length, recompRaw.length);
    let totalError = 0;
    let maxError = 0;
    const sampleSize = Math.floor(minLen / 3); // 3 channels RGB
    let highErrorPixelCount = 0;

    for (let i = 0; i < minLen; i += 3) {
      const diffR = Math.abs(origRaw[i] - recompRaw[i]);
      const diffG = Math.abs(origRaw[i + 1] - recompRaw[i + 1]);
      const diffB = Math.abs(origRaw[i + 2] - recompRaw[i + 2]);
      const pixelErr = (diffR + diffG + diffB) / 3;

      totalError += pixelErr;
      if (pixelErr > maxError) maxError = pixelErr;
      if (pixelErr > 25.0) {
        highErrorPixelCount++;
      }
    }

    const meanError = sampleSize > 0 ? totalError / sampleSize : 0;
    const highErrorRatio = sampleSize > 0 ? highErrorPixelCount / sampleSize : 0;

    // Determine ELA indication based on error variance
    const hasCompressionAnomaly = highErrorRatio > 0.08 && maxError > 45;
    const confidence = Math.min(0.92, Math.max(0.40, Number((0.50 + Math.abs(meanError - 10) / 40).toFixed(2))));

    return {
      status: 'COMPLETED',
      isJpeg: true,
      meanError: Number(meanError.toFixed(2)),
      maxError: Number(maxError.toFixed(2)),
      highErrorRatio: Number((highErrorRatio * 100).toFixed(2)),
      hasCompressionAnomaly,
      confidence,
      assessment: hasCompressionAnomaly
        ? 'High localized error discrepancy observed; indicates potential multi-generation compression or spliced elements.'
        : 'Uniform error-level dissipation across image surface; consistent with single-generation compression.',
      limitations: [
        'ELA identifies compression inconsistencies across surfaces, not intentional maliciousness.',
        'Does not detect neural generative synthesis (AI deepfakes, diffusion generation) that lacks splicing seams.',
        'High-contrast edges and solid geometric borders naturally produce elevated error levels.'
      ]
    };
  } catch (err) {
    return {
      status: 'ERROR',
      reason: `ELA computation error: ${err.message}`,
      observations: []
    };
  }
}

/**
 * Analyzes EXIF metadata for tampering, editing software, and timestamp contradictions.
 */
export function analyzeExifMetadata(exif) {
  if (!exif || Object.keys(exif).length === 0) {
    return {
      status: 'NO_EXIF_PRESENT',
      softwareDetected: null,
      timestampAnomaly: false,
      missingDeviceData: true,
      flags: ['EXIF_STRIPPED_OR_ABSENT'],
      observations: [
        {
          type: 'EXIF_METADATA_STATUS',
          value: 'Metadata absent or stripped by social compression',
          confidence: 0.95
        }
      ],
      limitations: [
        'Most modern social platforms (X, Facebook, Instagram, Reddit) automatically strip EXIF metadata on upload.',
        'Absence of EXIF is standard on web-distributed media and does not prove fabrication.'
      ]
    };
  }

  const flags = [];
  const observations = [];

  // 1. Software signature check
  const software = exif.Software || exif.ProcessingSoftware || exif.SoftwareAgent || '';
  const knownEditors = [
    'photoshop', 'gimp', 'canva', 'lightroom', 'after effects',
    'premiere', 'snapseed', 'paint.net', 'affinity', 'picsart', 'pixlr'
  ];

  let softwareDetected = null;
  if (typeof software === 'string' && software.trim().length > 0) {
    const lower = software.toLowerCase();
    const matched = knownEditors.find(ed => lower.includes(ed));
    if (matched) {
      softwareDetected = software;
      flags.push(`EDITING_SOFTWARE_DETECTED: ${software}`);
      observations.push({
        type: 'SOFTWARE_METADATA_SIGNATURE',
        value: `Image metadata records editing application: ${software}`,
        confidence: 0.92
      });
    } else {
      observations.push({
        type: 'SOFTWARE_METADATA_SIGNATURE',
        value: `Software tag present: ${software}`,
        confidence: 0.85
      });
    }
  }

  // 2. Timestamp consistency check
  const createDate = exif.DateTimeOriginal || exif.CreateDate;
  const modifyDate = exif.ModifyDate || exif.DateTime;
  let timestampAnomaly = false;

  if (createDate && modifyDate) {
    const cTime = new Date(createDate).getTime();
    const mTime = new Date(modifyDate).getTime();

    if (!isNaN(cTime) && !isNaN(mTime)) {
      const diffMinutes = (mTime - cTime) / (1000 * 60);
      if (diffMinutes > 5) {
        timestampAnomaly = true;
        flags.push(`MODIFY_DATE_AFTER_ORIGINAL: ${Math.round(diffMinutes)} minutes discrepancy`);
        observations.push({
          type: 'TIMESTAMP_DISCREPANCY',
          value: `Modification timestamp is ${Math.round(diffMinutes)} minutes later than original capture timestamp`,
          confidence: 0.90
        });
      }
    }
  }

  // 3. Device provenance check
  const make = exif.Make;
  const model = exif.Model;
  const hasDevice = Boolean(make || model);

  if (hasDevice) {
    observations.push({
      type: 'CAMERA_DEVICE_METADATA',
      value: `Recorded capture hardware: ${make || 'Unknown'} ${model || ''}`.trim(),
      confidence: 0.88
    });
  } else {
    flags.push('MISSING_HARDWARE_METADATA');
  }

  return {
    status: 'ANALYZED',
    softwareDetected,
    timestampAnomaly,
    missingDeviceData: !hasDevice,
    flags,
    observations,
    limitations: [
      'EXIF headers can be altered or injected using common tools (exiftool).',
      'Presence of editing software can indicate simple cropping or format export, not necessarily deceptive forgery.'
    ]
  };
}
