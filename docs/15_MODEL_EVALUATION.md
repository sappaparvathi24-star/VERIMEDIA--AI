# VeriMedia AI — Model & Performance Evaluation

## 1. Performance Gate Criteria

| Metric | Target SLA | Release Gate Threshold |
|---|---|---|
| Bitstream SHA-256 Hashing | < 10ms | < 25ms |
| Perceptual Hash Calculation (pHash / dHash) | < 30ms | < 75ms |
| Error Level Analysis (ELA) Processing | < 100ms | < 250ms |
| Evidentiary Fusion (1,000 entities) | < 50ms | < 120ms |
| Multi-Claim Decomposition (Gemini) | < 1,500ms | < 3,500ms |
| Dossier PDF/HTML Export | < 80ms | < 200ms |

## 2. Epistemic Quality Gates
- **Prohibited Certainty Terms**: Zero instances of "proof", "proves origin", "100% authentic", "unquestionably genuine" in automated findings or LLM outputs.
- **Independence Collapsing**: 100% compliance on Sybil/repost collapsing where duplicate source feeds never inflate confidence scores above single-group thresholds.
