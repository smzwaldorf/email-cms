## 1. Template copy service foundation

- [ ] 1.1 Audit the current admin newsletter and article services to identify reusable create, fetch, and composition-copy logic
- [ ] 1.2 Implement a service workflow that creates a new draft newsletter from a source newsletter
- [ ] 1.3 Implement article-copy logic that preserves composition fields and ordering while resetting publication metadata to draft

## 2. Admin UI entry points

- [ ] 2.1 Extend the newsletter creation flow to support choosing between blank creation and template-based creation
- [ ] 2.2 Add a template-selection UI that clearly identifies source newsletters
- [ ] 2.3 Route successful template creation into the normal draft newsletter editing flow

## 3. Copy safety and behavior

- [ ] 3.1 Ensure source newsletter metadata and composition remain unchanged after template use
- [ ] 3.2 Ensure edits to copied articles affect only the new draft newsletter and its copied records
- [ ] 3.3 Handle empty, archived, or published source newsletters according to the spec-defined draft-copy behavior

## 4. Verification

- [ ] 4.1 Add or update service tests for newsletter duplication, copied article ordering, and draft-state resets
- [ ] 4.2 Add or update UI tests for template selection and blank-create fallback
- [ ] 4.3 Add or update integration tests proving source newsletters remain unchanged after creating and editing a copied draft
