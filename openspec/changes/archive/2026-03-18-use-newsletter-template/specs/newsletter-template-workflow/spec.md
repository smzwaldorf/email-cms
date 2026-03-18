## ADDED Requirements

### Requirement: Admin can create a template from an existing newsletter
The system SHALL allow an admin to create a newsletter template by selecting an existing newsletter as the source.

#### Scenario: Create template from existing newsletter
- **WHEN** an admin selects an existing newsletter and chooses to create a template
- **THEN** the system SHALL create a new template newsletter derived from that source newsletter

### Requirement: Template stores canonical full article content and structure
The system SHALL store template newsletters with canonical template article content, including full article bodies and ordering.

#### Scenario: Template preserves full article body
- **WHEN** the system creates a template from an existing newsletter
- **THEN** it SHALL copy full article body content into template article records

#### Scenario: Template preserves composition order
- **WHEN** the system creates a template from an existing newsletter
- **THEN** it SHALL preserve article composition and ordering in the template

### Requirement: Admin can modify template structure before use
The system SHALL allow admins to modify template article structure, including article count and ordering, before creating newsletters from that template.

#### Scenario: Admin changes template article count
- **WHEN** an admin adds or removes articles in a template newsletter
- **THEN** the system SHALL persist the updated template structure for future template use

#### Scenario: Admin reorders template articles
- **WHEN** an admin reorders template articles
- **THEN** the system SHALL use the updated order when future newsletters are created from that template

### Requirement: Creating newsletter from template produces independent draft content
The system SHALL create a new draft newsletter from a selected template by deep-copying full template article content into independent draft records.

#### Scenario: Newsletter from template copies full body and ordering
- **WHEN** an admin creates a newsletter from a template
- **THEN** the system SHALL deep-copy full template article bodies and preserve template article ordering in the new draft newsletter

#### Scenario: Created newsletter starts in draft state
- **WHEN** the template or source content has published or archived state history
- **THEN** the new newsletter and copied articles SHALL be created in draft state without inheriting publish timestamps

### Requirement: Created newsletter behaves as a normal hybrid-editable newsletter
The system SHALL treat newsletters created from templates as normal newsletters that can be edited freely after creation.

#### Scenario: Template-created newsletter allows hybrid edits
- **WHEN** an admin opens a newsletter created from a template
- **THEN** the system SHALL allow adding, removing, reordering, and editing articles as in any normal newsletter workflow

### Requirement: Source newsletter and template remain unchanged by downstream edits
The system SHALL preserve source newsletters and template newsletters when admins edit newsletters created from templates.

#### Scenario: Source newsletter is not mutated by template creation
- **WHEN** an admin creates a template from an existing newsletter
- **THEN** the system SHALL leave the source newsletter metadata and article records unchanged

#### Scenario: Template is not mutated by created-newsletter edits
- **WHEN** an admin edits a newsletter created from a template
- **THEN** the system SHALL leave the template newsletter and template article records unchanged

### Requirement: Admin UI exposes template creation and template selection entry points
The system SHALL provide admin UI paths both for creating templates from existing newsletters and for creating newsletters from templates.

#### Scenario: Admin can identify source newsletters for template creation
- **WHEN** the admin chooses a source newsletter to create a template
- **THEN** the system SHALL present enough source newsletter information to distinguish the intended source from other newsletters

#### Scenario: Admin can identify templates for newsletter creation
- **WHEN** the admin chooses a template to create a newsletter
- **THEN** the system SHALL present enough template metadata to distinguish the intended template from other templates
