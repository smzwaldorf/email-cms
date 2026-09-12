## ADDED Requirements

### Requirement: Application handler

CMS SHALL expose createCmsApplication with explicit route context and an asynchronous Node handle method. Import and construction SHALL NOT listen, load environment, start polling or send email.

#### Scenario: Import without runtime activation
- **WHEN** application, adapter and guarded CLI modules are imported
- **THEN** no listener, timer, environment loading or resource acquisition occurs

#### Scenario: Request parity
- **WHEN** root, CORS, unknown-route and unauthenticated protected requests use the Node adapter
- **THEN** responses match the existing route handler

### Requirement: Node HTTP lifecycle

The Node HTTP adapter SHALL own listener startup and idempotent stop. Stop SHALL block new work and drain active handlers before closing owned resources. Startup and shutdown errors SHALL be surfaced.

#### Scenario: Active handler during stop
- **WHEN** stop is called twice while a handler is pending
- **THEN** the handler finishes before resources close exactly once and both callers await completion

#### Scenario: Bind failure
- **WHEN** the requested port is unavailable
- **THEN** startup rejects and owned resources close exactly once

#### Scenario: Disconnected response
- **WHEN** the client disconnects while handler work remains pending
- **THEN** stop still waits for handler completion before closing resources

### Requirement: Worker polling lifecycle

Worker execution SHALL remain available through runOnce. Polling construction SHALL do no work. Polling SHALL never overlap runs, SHALL resume after reported errors, and SHALL drain an active run before closing resources on stop. Stop SHALL cancel future runs and prohibit restart.

#### Scenario: Slow run and shutdown
- **WHEN** a run lasts longer than the poll interval and stop is requested
- **THEN** no second run begins and resources close only after the active run settles

#### Scenario: Failed run
- **WHEN** runOnce rejects
- **THEN** the error is reported and the next run occurs after the configured delay unless stopped

#### Scenario: Stop before start
- **WHEN** a constructed worker is stopped before start
- **THEN** owned resources close once without executing jobs

### Requirement: Process composition

Existing Node commands SHALL retain their ports, environment configuration, authentication and delivery semantics. CLI entrypoints SHALL own environment setup, SIGINT/SIGTERM handling and pool closure. Generic adapters SHALL NOT install process signals. Documentation SHALL identify remaining Node dependencies and shared-resource ownership limits.

#### Scenario: Repeated process signals
- **WHEN** SIGINT and SIGTERM arrive during drain
- **THEN** stop runs once, listeners are removed after completion, and cleanup failures produce a nonzero exit code
