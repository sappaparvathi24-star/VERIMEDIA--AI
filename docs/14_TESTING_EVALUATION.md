# VeriMedia AI — Testing & Evaluation Framework

## 1. Test Architecture
VeriMedia AI utilizes an automated multi-stage regression and verification suite:

- **Phase C–M Regression Suite**: Core store, artifact forensics, timeline synthesis, claims decomposition, multi-source discovery, genealogy derivation, reasoning fusion, reporting, and security hardening.
- **Phase 15 Discovery Suite**: Real-world OSINT discovery provider transparency, rate limiting, query generation, and caching.
- **Phase 16 Security & Adversarial Threat Suite**:
  - SSRF protection against IPv4/IPv6 private ranges, cloud metadata endpoints (`169.254.169.254`), and loopback interfaces.
  - Path traversal defense on file operations and export endpoints.
  - Authentication token verification, malformed JWT handling, and privilege separation.
  - Malformed and oversized upload rejection (zip bombs, invalid MIME signatures).
- **Phase 17 Discovery Independence & Sybil Collapsing Suite**:
  - Validates that 100 syndicated reposts collapse into 1 independent confirmation group.
  - Validates mocked connector pagination, rate-limit backoff, and network timeout recovery.
- **Phase 18 Performance & Latency Benchmark Suite**:
  - Cryptographic and perceptual hashing speed (< 50ms for standard media).
  - Multi-source evidence fusion under load (< 100ms for 1,000+ linked observations).
  - Memory leak absence across sustained analysis cycles.

## 2. Running the Test Suites
```bash
npm test
```
