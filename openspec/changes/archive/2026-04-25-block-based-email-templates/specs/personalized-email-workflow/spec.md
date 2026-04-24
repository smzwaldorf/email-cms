## ADDED Requirements

### Requirement: System renders per-recipient HTML by walking the pinned template's block list

The system SHALL produce each recipient's `renderedBody` HTML by walking the pinned template revision's block list in `order`, skipping blocks where `visible` is `false`, dispatching by block `type`, and concatenating the resulting HTML fragments. Static blocks (`header`, `section-divider`, `about`, `footer`, `custom-html`) SHALL be rendered once per recipient with the global token scope resolved from the recipient's context. Repeater blocks SHALL iterate over recipient-scoped data slices as follows: `shared-article-feature` SHALL iterate over the recipient's resolved shared articles capped by `config.maxItems`; `class-article-feature` SHALL iterate over the recipient's eligible classes in canonical class order, then iterate over each class's articles capped by `config.maxItemsPerClass`; `weekly-summary-list` SHALL iterate over the recipient's weekly items filtered by `config.sourceTag`. The walker SHALL resolve `article.*` tokens per article iteration and `class.*` tokens per class iteration in addition to the global token scope. When a pinned revision's block list is empty, the system SHALL fall back to the legacy single-body render path so that revisions created before block-based authoring continue to produce identical output.

#### Scenario: Walker renders static blocks once per recipient

- **WHEN** the renderer walks a recipient's blocks and encounters a `header` block
- **THEN** the system SHALL emit one rendered HTML fragment for that block with global tokens resolved from the recipient's context

#### Scenario: Walker expands shared article repeater per article

- **WHEN** the renderer walks a `shared-article-feature` block whose `config.maxItems` is `3` for a recipient with five shared articles
- **THEN** the system SHALL emit three rendered HTML fragments in canonical article order, each with `article.*` tokens resolved for that article

#### Scenario: Walker expands class repeater per eligible class then per article

- **WHEN** the renderer walks a `class-article-feature` block whose `config.maxItemsPerClass` is `1` for a recipient eligible for classes `A` and `B` with two articles each
- **THEN** the system SHALL emit one rendered HTML fragment for class `A` followed by one rendered HTML fragment for class `B` in canonical class order, each with `class.*` and `article.*` tokens resolved for that iteration

#### Scenario: Walker skips invisible blocks

- **WHEN** the renderer walks a block list that contains a block with `visible` set to `false`
- **THEN** the system SHALL omit that block from the recipient's `renderedBody`

#### Scenario: Walker falls back for legacy revisions with empty block list

- **WHEN** the renderer composes output for a recipient using a pinned revision whose block list is empty
- **THEN** the system SHALL produce `renderedBody` using the legacy single-body render path so that the resulting HTML matches what the prior renderer would have produced for the same inputs

### Requirement: Block-based renders preserve composition determinism and fingerprinting

The system SHALL ensure that walking a fixed block list with the same recipient context, newsletter revision, template revision, and rules version produces byte-identical `renderedBody` HTML and an identical `renderedHtmlFingerprint` across repeated renders. The pinned template revision identifier on a delivery batch SHALL pin the complete block list snapshot used for that batch.

#### Scenario: Repeated walker renders are byte-identical

- **WHEN** the system walks the same pinned block list for the same recipient context twice
- **THEN** both renders SHALL produce the same `renderedBody` HTML and the same `renderedHtmlFingerprint`

#### Scenario: Edits to a template after batch creation do not change pinned output

- **WHEN** a delivery batch was created with pinned template revision `R1` and an admin later saves a new revision `R2` with a different block list
- **THEN** the batch SHALL continue to render every recipient's `renderedBody` from `R1`'s block list and produce the same `renderedHtmlFingerprint` as the initial render

#### Scenario: Fingerprint changes only when pinned inputs change

- **WHEN** the recipient context, newsletter revision, template revision, or rules version changes between two renders for the same guardian
- **THEN** the `renderedHtmlFingerprint` MAY differ; otherwise it SHALL be identical
