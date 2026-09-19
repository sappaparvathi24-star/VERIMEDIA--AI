# VeriMedia AI — Evidence Model & Sybil Defense

## 1. Overview
The VeriMedia AI Evidence Model represents forensic observations, cryptographic proofs, perceptual hashes, and metadata traces as first-class evidentiary entities (`OBS-*` and `EVD-*`).

---

## 2. Epistemic Hierarchy
1. **Raw Artifacts (`ART-*`)**: The immutable digital bitstreams under scrutiny (with SHA-256 integrity checksums).
2. **Analysis Runs (`RUN-*`)**: Deterministic or probabilistic forensic execution passes.
3. **Observations (`OBS-*`)**: Uninterpreted measurements directly extracted from media bitstreams.
4. **Evidence (`EVD-*`)**: Interpreted findings assigned polarity (`SUPPORTING`, `CONTRADICTING`, `NEUTRAL`), confidence rating, and an **Independence Group ID (`IG-*`)**.
5. **Findings (`FND-*`)**: Synthesized assertions backed by cited evidence IDs.
6. **Claims (`CLM-*`)**: External asserted statements regarding origin, date, identity, or ownership.

---

## 3. §6 Independence Group Deduplication Guard (Sybil / Repost Defense)

### The Problem: Sybil & Echo-Chamber Inflation
In open-web dissemination, a single altered video or misleading claim may be re-uploaded 10,000 times by bots, aggregator accounts, or syndicated RSS feeds. 
**100 syndicated reposts ≠ 100 independent confirmations.**

### Deduplication Rules & Fusion Mechanics
1. **Independence Group Tagging (`independenceGroupId`)**:
   - Multiple appearances sharing the same origin channel, author identity, hosting domain cluster, or duplicate content feed receive identical `independenceGroupId` tags (e.g. `IG-SYNDICATED-AGGREGATOR-NET` or `IG-SRC-TIKTOK-USER`).
2. **Channel Weight Collapsing**:
   - When calculating evidence corroboration, the engine aggregates by `independenceGroupId`.
   - 100 evidence items sharing the same `independenceGroupId` collapse to **1 independent corroboration channel**.
3. **Confidence Cap**:
   - Single-group corroboration is capped at `0.85` confidence.
   - Multi-group corroboration (2+ distinct independence groups) qualifies for `0.94+` multi-source confidence.
4. **Epistemic Limitation Disclosure**:
   - When evidence count exceeds independence group count (`evidenceCount > independenceGroups.size`), the system automatically attaches an audit limitation note:
     > *"Multiple supporting sources share the same independence group. Syndicated or copied sources do not multiply independent confirmation."*

---

## 4. Confidence Separation
Forensic confidence, provenance confidence, and external claim status are strictly kept distinct. Binary TRUE/FALSE certainties are rejected in favor of auditable probabilistic ledgers.
