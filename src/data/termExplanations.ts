export const TERM_EXPLANATIONS: Record<string, string> = {
  sha256: "A unique digital fingerprint of the exact file — if even one pixel changes, this fingerprint changes completely.",
  phash: "A 'fuzzy fingerprint' that stays similar even if the image is resized, cropped, or recompressed — used to catch near-duplicates.",
  ela: "Highlights parts of an image that were edited or re-saved at a different compression level than the rest of the file.",
  prnu: "A unique noise pattern left behind by a specific camera sensor, like ballistic markings on a bullet.",
  c2pa: "A tamper-proof digital nutrition label attached by cameras or AI generators to prove where media came from.",
  hamming_distance: "Counts how many bits differ between two perceptual hashes — 0 means identical, lower numbers mean closer match.",
  clip_similarity: "A score measuring how close two images or an image and text are in semantic meaning according to an AI model.",
  exif: "Metadata saved directly inside a photo file, including camera model, lens settings, date, and GPS location.",
  ner: "AI that automatically identifies and extracts named people, organizations, locations, and key entities from text.",
  entailment: "Measures whether two claims agree with each other, contradict each other, or are neutral/unrelated.",
  provenance: "The documented record of an asset's origin, ownership history, and modifications over time.",
  ssim: "Compares structural patterns, brightness, and contrast between two images to measure visual quality loss.",
  psnr: "Measures image distortion caused by compression — higher numbers mean cleaner, higher quality.",
  ocr: "Converts visible text inside images or video frames into machine-readable, searchable text.",
  bitrate: "The amount of data processed per second — sudden drops can indicate heavy re-compression or truncation.",
  chroma_subsampling: "How color information is compressed relative to brightness — inconsistencies reveal local edits."
}
