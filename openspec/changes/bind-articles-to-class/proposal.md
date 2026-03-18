## Why

Editors need to control which class cohorts receive each newsletter article, but the current workflow treats newsletter articles as globally visible within an issue. We need explicit class binding now so personalized-email delivery can use stable, editor-managed targeting rules.

## What Changes

- Introduce class-binding metadata on newsletter articles so each article can be marked as shared (all classes) or targeted to one or more classes.
- Define admin authoring behavior for assigning and updating class bindings during newsletter composition.
- Define validation and fallback behavior when targeted classes become inactive or have no recipients.
- Define deterministic rules for personalized rendering to include only class-eligible articles for each guardian.
- Preserve existing newsletter ordering while filtering article visibility by class eligibility at render time.

## Capabilities

### New Capabilities
- `class-article-binding`: Requirements for assigning class targeting to newsletter articles and consuming those bindings during personalized article selection.

### Modified Capabilities
- `newsletter-admin-workflow`: Extend composition requirements so admins can manage class targeting on articles in newsletter context.

## Impact

- Affected UI: newsletter composition and article editing flows in admin pages.
- Affected services/data: admin article-newsletter association APIs, article metadata models, and personalized composition filters.
- Affected tests: admin integration tests for class binding authoring and personalization tests for class-eligible article selection.
