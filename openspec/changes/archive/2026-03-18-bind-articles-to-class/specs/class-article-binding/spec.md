## ADDED Requirements

### Requirement: Admin can assign class targeting to each newsletter article
The system SHALL allow each newsletter article association to declare class targeting as either shared to all classes or targeted to one or more specific classes.

#### Scenario: Save shared targeting for an article
- **WHEN** an admin sets an article targeting mode to shared in newsletter composition
- **THEN** the system SHALL persist the article association as eligible for all classes in that newsletter

#### Scenario: Save targeted classes for an article
- **WHEN** an admin sets an article targeting mode to targeted and selects classes `A` and `B`
- **THEN** the system SHALL persist the article association with class bindings `A` and `B` for that newsletter

### Requirement: System validates class bindings at authoring time
The system SHALL validate class bindings against the active class catalog before persisting targeted article associations.

#### Scenario: Reject unknown class binding
- **WHEN** an admin attempts to save a targeted article with an unknown class identifier
- **THEN** the system SHALL reject the update and return a validation error without mutating existing bindings

#### Scenario: Reject targeted mode without class selections
- **WHEN** an admin attempts to save targeted mode without selecting any class
- **THEN** the system SHALL reject the save and prompt the admin to select at least one class or switch to shared mode

### Requirement: Personalized selection includes only class-eligible targeted articles
The system SHALL include an article in a guardian's personalized newsletter only if the article is shared or at least one of the guardian's eligible classes matches the article's targeted class bindings.

#### Scenario: Shared article is always included
- **WHEN** an article is marked shared and a guardian is eligible for the newsletter
- **THEN** the system SHALL include the article in that guardian's personalized result

#### Scenario: Targeted article is included only on class match
- **WHEN** an article is targeted to class `A` and the guardian has no child in class `A`
- **THEN** the system SHALL exclude that article from the guardian's personalized result

#### Scenario: Order is preserved after eligibility filtering
- **WHEN** multiple newsletter articles are filtered for guardian class eligibility
- **THEN** the system SHALL preserve the original newsletter-relative order among remaining eligible articles
