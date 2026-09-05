## ADDED Requirements

### Requirement: Authentication and admission belong to SMZ Auth
CMS SHALL consume central OIDC identity and live per-app access context, retaining issuer and subject links without using local roles or memberships as login eligibility.

#### Scenario: Local role is stale
- **WHEN** SMZ returns parent while the local record says admin
- **THEN** CMS SHALL grant only parent permissions.

##### Example: Fixture contract
- **GIVEN** local role=admin and central roles=[parent]
- **WHEN** GET /api/auth/session with an admitted token
- **THEN** role=parent; publish returns 403

#### Scenario: Central authority cannot approve a request
- **WHEN** central verification returns invalid, revoked or unavailable
- **THEN** CMS SHALL return 401, 403 or 503 respectively without cached authorization.

##### Example: Fixture contract
- **GIVEN** central access-context returns 503
- **WHEN** CMS receives a protected request
- **THEN** CMS returns 503 without querying local role assignments

#### Scenario: Newly admitted user has no local row
- **WHEN** a valid centrally admitted identity has no existing data association
- **THEN** CMS SHALL create a local data anchor without adding a second admission policy.

##### Example: Fixture contract
- **GIVEN** issuer=http://localhost:3000/api/auth, sub=person-1 and no local link/email match
- **WHEN** the admitted person requests a session
- **THEN** a new local anchor and issuer/subject link are inserted without granting local-role authority

### Requirement: CMS actions use explicit server permissions
CMS SHALL deny unknown actions and enforce server permissions for every data and RPC path using live role and scope facts.

#### Scenario: Anonymous database mutation
- **WHEN** an anonymous caller uses the serialized database gateway
- **THEN** CMS SHALL reject the request before running the query.

##### Example: Fixture contract
- **GIVEN** no Authorization header
- **WHEN** POST /api/data/query targeting user_roles
- **THEN** 401 before query execution

#### Scenario: Teacher edits outside assignment
- **WHEN** a teacher attempts to edit an article outside their central teacher class scope or changes privileged metadata
- **THEN** CMS SHALL deny the operation without a write.

##### Example: Fixture contract
- **GIVEN** teacherClassIds=[C6] and article target classes=[C4]
- **WHEN** PATCH /api/cms/articles/a1 with title=Denied
- **THEN** 403 with no article write

#### Scenario: Dual-role reader
- **WHEN** a teacher and parent reads class content
- **THEN** CMS SHALL union live read scopes while limiting edits to teacher scope.

##### Example: Fixture contract
- **GIVEN** teacher scope=[C6] and parent scope=[C4]
- **WHEN** read C4 or edit C4 content
- **THEN** read succeeds but edit is denied

#### Scenario: Internal delivery method requested
- **WHEN** a caller invokes an internal worker or provider method via RPC
- **THEN** CMS SHALL deny it without provider handoff.

##### Example: Fixture contract
- **GIVEN** an admitted central admin
- **WHEN** RPC newsletterDelivery.processQueuedBatch
- **THEN** 403 with no provider call

### Requirement: Publish and reader return preserve the supported journey
CMS SHALL route dashboard publication through readiness, audience confirmation and durable delivery and preserve the protected article destination through authentication.

#### Scenario: Dashboard publication
- **WHEN** an admin selects publish on the dashboard
- **THEN** CMS SHALL use the existing confirmed delivery workflow instead of plain status mutation.

##### Example: Fixture contract
- **GIVEN** draft newsletter n1
- **WHEN** Publish selected on dashboard
- **THEN** navigate to /admin/newsletters/id/n1 for readiness and audience confirmation

#### Scenario: Mocked delivery journey
- **WHEN** tests execute publish, preparation, ready-recipient handoff and callbacks
- **THEN** CMS SHALL retain durable outcomes and intended article routing without sending real email.

##### Example: Fixture contract
- **GIVEN** subscribed f1 and pending pending-family
- **WHEN** publish n1 then run the fixture worker
- **THEN** only f1 reaches the mocked Kit seam; provider_message_id=kit-fixture is retained

### Requirement: Publication and delivery consent fail closed
CMS SHALL persist publication, recipient snapshot, batch and queued job in one database transaction and SHALL only select active enrolled families with subscribed delivery status.

#### Scenario: Batch enqueue fails
- **WHEN** delivery persistence fails during publication
- **THEN** CMS SHALL roll back publication and partial batch writes together.

##### Example: Fixture contract
- **GIVEN** publication and batch writes share a transaction connection
- **WHEN** enqueue throws an error
- **THEN** ROLLBACK executes and COMMIT does not

#### Scenario: Consent is absent
- **WHEN** family subscription is pending, absent, unsubscribed, bounced or complained
- **THEN** CMS SHALL exclude that family without inferring consent from enrollment.

##### Example: Fixture contract
- **GIVEN** active enrolled family has newsletter_subscription_status=pending
- **WHEN** resolve delivery audience
- **THEN** eligible=false and reason=not_subscribed

#### Scenario: Publication is repeated
- **WHEN** a concurrent or repeated request targets an already published newsletter
- **THEN** CMS SHALL reject it without creating another publish batch.

##### Example: Fixture contract
- **GIVEN** n1 status=published
- **WHEN** POST /api/admin/newsletters/n1/publish-and-deliver
- **THEN** 409 and no new publish batch
