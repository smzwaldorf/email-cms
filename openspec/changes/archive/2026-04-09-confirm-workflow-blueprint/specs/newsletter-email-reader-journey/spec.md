## ADDED Requirements

### Requirement: System SHALL execute the confirmed seven-step newsletter email reader journey
The system SHALL support the end-to-end journey in this order: write newsletter, publish newsletter, send email, collect email analytics, process article click attempt, authenticate user when required, and redirect to display the intended article.

#### Scenario: Happy-path journey completes without authentication interruption
- **WHEN** a published newsletter email is sent to an already authenticated recipient and the recipient clicks an article link
- **THEN** the system SHALL record journey events and display the intended article without intermediate login.

#### Scenario: Journey resumes after authentication
- **WHEN** an unauthenticated recipient clicks an article link from a sent newsletter email
- **THEN** the system SHALL preserve the intended destination through authentication and redirect to the same intended article after successful login.

### Requirement: System SHALL enforce deterministic preparation and ready-only delivery handoff
The system SHALL prepare recipient payloads using pinned newsletter revision, template revision, recipient snapshot, and rules version, and SHALL hand off only ready recipients for delivery while retaining failed recipients for correction.

#### Scenario: Mixed preparation outcomes do not block valid recipients
- **WHEN** preparation produces both ready and failed recipients for the same batch
- **THEN** the system SHALL include only ready recipients in delivery handoff and SHALL persist failed recipients with actionable findings.

#### Scenario: Retry uses corrected inputs for failed subset
- **WHEN** operators retry after fixing input issues from a previous batch
- **THEN** the system SHALL target previously failed recipients and run them against newly pinned inputs.

### Requirement: System SHALL capture distinct email-event and on-site analytics across the journey
The system SHALL track email open/click events separately from on-site page-view/session events and SHALL preserve correlation identifiers needed to analyze conversion from delivery to article view.

#### Scenario: Email click is correlated to article view
- **WHEN** a recipient clicks a tracked email article link and reaches the reader
- **THEN** the system SHALL store analytics records that allow operators to link click activity to the resulting article view session.

#### Scenario: Authentication boundary does not break analytics continuity
- **WHEN** a click leads to authentication before article display
- **THEN** the system SHALL continue analytics correlation across the auth callback and final redirect.
