# Road to Alpha

Beacon's path to a stable alpha release.

## Milestones

### ✅ M0: Foundation

- [x] Gleam API with WebSocket event ingestion
- [x] TypeScript SDK with Web Worker
- [x] PostgreSQL schema (events, sessions, flags, users)
- [x] Identity tracking (anon → identified)
- [x] Feature flags (read)
- [x] Vanilla JS example app
- [x] Documentation (SDK, API, protocol, identity)
- [x] SDK unit tests (95% coverage)

### 🚧 M1: Examples & Polish

- [ ] React example app
- [ ] Dashboard authentication
- [ ] Flag management UI
- [ ] Basic analytics visualizations

### 📋 M2: Benchmarking

- [ ] Load testing infrastructure
- [ ] Events/second throughput benchmarks
- [ ] WebSocket connection limits
- [ ] SDK bundle size verification (<1kb)

### 📋 M3: Dashboard MVP

- [ ] Event explorer with filters
- [ ] Session timeline view
- [ ] User lookup
- [ ] Project/API key management

### 📋 M4: Compliance

- [ ] Audit logging
- [ ] Encryption verification
- [ ] PII masking / IP anonymization
- [ ] Data retention policies
- [ ] HIPAA/FedRAMP documentation

## Non-Goals (for Alpha)

These features are intentionally out of scope for the alpha release:

- Auto-capture (clicks, forms)
- A/B testing / experiments
- Funnel analysis
- Session replay
- Mobile SDKs
