## 1. Contract and artifacts
- [x] 1.1 Inspect saved baseline and coordinate OIDC client/resource with auth peer.
- [x] 1.2 Define boundary, permission and delivery specs before application edits.
- [x] 1.3 Validate the change artifacts.

## 2. Authorization boundary
- [x] 2.1 Implement Authentication and admission belong to SMZ Auth: live context validation and stable local identity association.
- [x] 2.2 Implement CMS actions use explicit server permissions: shared policy and central class-scope mapping.
- [x] 2.3 Restrict data/RPC paths and add scoped article edit endpoint.
- [x] 2.4 Align frontend session, permissions, OIDC resource and edit calls.

## 3. CMS and email journey
- [x] 3.1 Implement Publish and reader return preserve the supported journey: dashboard readiness/delivery confirmation and safe return.
- [x] 3.2 Verify preparation, durable jobs, ready-only Kit handoff, callbacks and safe deep-link return with mocks.

## 4. Validation and handoff
- [x] 4.1 Run focused regressions, lint and builds; record baseline limitations.
- [x] 4.2 Document registration, identity/class mapping and supported versus unspecified follow-on work.

- [x] 4.3 Implement Publication and delivery consent fail closed: atomic publication, subscribed-only audience and repeated-publication rejection.

- [ ] 4.4 Production build readiness remains incomplete because of inherited TypeScript errors. Live isolated PostgreSQL and the Google/Dia journey were verified. On 2026-09-06 the user explicitly authorized committing the reviewed change despite these build failures, superseding the previous commit hold; this does not mark production readiness complete. See specs/docs/OWNERSHIP_REVIEW.md.

- [x] 4.5 Exercise real Google/Dia and isolated PostgreSQL publication with local capture; fix browser landing/deep-link and database relation/revision blockers, retaining no-real-send boundary and recording observed limits; final fresh-Google exact deep-link return confirmed in Dia on 2026-09-06.
