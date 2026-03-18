## 1. Student model and lifecycle foundation

- [ ] 1.1 Add student lifecycle fields and identity uniqueness constraints with backward-compatible defaults.
- [ ] 1.2 Implement student service APIs for create, update, activate, deactivate, and status-filtered listing.
- [ ] 1.3 Centralize student validation for required fields and identity conflict checks across all write paths.

## 2. Cross-entity association management

- [ ] 2.1 Implement student-class enrollment APIs with referential integrity validation for both student and class records.
- [ ] 2.2 Implement student-family association APIs with referential integrity validation for both student and family records.
- [ ] 2.3 Build admin UI flows for student detail management of class enrollments and family links.

## 3. Integration safety and verification

- [ ] 3.1 Update recipient-resolution and eligibility inputs to consume active students with valid class/family associations.
- [ ] 3.2 Add audit metadata capture for lifecycle transitions and association add/remove operations.
- [ ] 3.3 Add service/integration tests for student CRUD, uniqueness conflicts, enrollment linking/unlinking, family linking/unlinking, lifecycle transitions, and active-default listing behavior.
