## 1. Newsletter workflow foundation

- [x] 1.1 Audit the current admin newsletter routes, screens, and service methods against the new workflow requirements
- [x] 1.2 Introduce a dedicated admin newsletter management route and shared route helpers for week-based and ID-based newsletters
- [x] 1.3 Extend the admin newsletter service layer for draft metadata updates and newsletter-level publish-readiness checks

## 2. Newsletter management UI

- [x] 2.1 Expand the newsletter create/edit form to support draft metadata management for weekly newsletters and special editions
- [x] 2.2 Update the admin dashboard newsletter list to route into the newsletter management workflow consistently
- [x] 2.3 Build the newsletter composition view that shows newsletter metadata, status, and ordered article list in one workflow

## 3. Article composition workflow

- [x] 3.1 Integrate article ordering controls into the newsletter composition view using the existing ordering capabilities
- [x] 3.2 Add newsletter-context actions to create, add, remove, and continue editing articles from within a newsletter
- [x] 3.3 Surface newsletter-level validation and status messaging for draft, published, and archived states

## 4. Template copy workflow

- [x] 4.1 Implement a service workflow to create a new draft newsletter from an existing issue template
- [x] 4.2 Ensure template copy creates editable draft article copies rather than mutating source newsletter content
- [x] 4.3 Add admin UI entry points for starting a new newsletter from a previous issue

## 5. Verification

- [x] 5.1 Add or update component and integration tests for newsletter metadata management, routing, and lifecycle actions
- [x] 5.2 Add or update tests for article ordering and newsletter composition behavior
- [x] 5.3 Add or update tests for the template-copy workflow, including source-content preservation
