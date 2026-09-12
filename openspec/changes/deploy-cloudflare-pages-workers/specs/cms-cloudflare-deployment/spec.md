## Purpose

Deploy CMS on Pages and Workers while preserving authorization, database isolation and explicit delivery activation.

## ADDED Requirements

### Requirement: Invocation context
CMS Workers SHALL isolate environment and database pool per invocation and close the pool after application completion. Node operation SHALL retain its existing lifecycle.
#### Scenario: Concurrent invocations
- **WHEN** two invocations use different test pools and origins
- **THEN** each uses only its own context and closes only its own pool

### Requirement: HTTP and templates
The Workers HTTP adapter SHALL preserve CMS routing and SHALL use bundled templates without runtime disk access.
#### Scenario: Workerd execution
- **WHEN** health, CORS, protected routes and template rendering run in workerd
- **THEN** they return expected results without filesystem or shared-connection errors

### Requirement: Delivery trigger
Scheduled delivery SHALL require explicit activation and SHALL preserve existing queued-job claim and retry rules.
#### Scenario: Deployment default
- **WHEN** scheduled is invoked with DELIVERY_ENABLED=false
- **THEN** no job is claimed and no provider request occurs

### Requirement: Pages and deployment
Deployment SHALL validate exact HTTPS origins, uncached Hyperdrive and the target account, preserve SPA callback routing, and apply only non-destructive schema initialization to the verified empty CMS database. Verification SHALL distinguish publication from end-to-end readiness.
#### Scenario: Existing database protection
- **WHEN** schema bootstrap finds application tables or an unexpected database name
- **THEN** it refuses initialization without changing the database
#### Scenario: Deployed frontend
- **WHEN** callback and local logout paths are requested on Pages
- **THEN** the SPA is served and local logout permits only the configured Auth frame origin
