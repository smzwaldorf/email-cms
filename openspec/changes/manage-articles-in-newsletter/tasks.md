## 1. Service and data workflow updates

- [ ] 1.1 Extend admin article-composition service methods to support add existing article, create-and-attach article, and unlink article from newsletter without deleting the article record.
- [ ] 1.2 Ensure newsletter article ordering updates are persisted and returned in newsletter context payloads used by admin and reader flows.
- [ ] 1.3 Add or refine route/navigation helpers so article create/edit actions preserve and restore newsletter management context.

## 2. Admin UI composition flow enhancements

- [ ] 2.1 Update newsletter composition UI to expose explicit actions for add existing article, create new article, edit linked article, remove article, and reorder articles.
- [ ] 2.2 Implement safe remove behavior in UI copy and action wiring so removal unlinks from composition by default.
- [ ] 2.3 Ensure article editing launched from composition returns users to the same newsletter context after save/exit.

## 3. Verification and regression coverage

- [ ] 3.1 Add service tests covering add/create/edit-context/remove-unlink/reorder composition behaviors.
- [ ] 3.2 Add integration tests for newsletter-context continuity across composition and editor transitions.
- [ ] 3.3 Run targeted test suites for admin workflow and update any fixtures/mocks needed for the expanded composition scenarios.
