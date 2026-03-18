## 1. Template creation foundation

- [x] 1.1 Audit current admin newsletter and article services to identify reusable create, fetch, and composition-copy logic
- [x] 1.2 Implement a service workflow that creates a template newsletter from a selected existing newsletter
- [x] 1.3 Implement template-article copy logic that preserves full body content and ordering in canonical template records
- [x] 1.4 Ensure template creation does not mutate source newsletter metadata or source article records

## 2. Template management behavior

- [x] 2.1 Add admin UI entry point to create a template from an existing newsletter
- [x] 2.2 Add template editing support for article count and article ordering changes
- [x] 2.3 Ensure template content edits update canonical template records without creating version branches

## 3. Newsletter instantiation from template

- [x] 3.1 Implement service workflow to create a new draft newsletter from a selected template
- [x] 3.2 Deep-copy full template article bodies and ordering into independent draft article records
- [x] 3.3 Reset publication metadata so instantiated newsletters/articles always start in draft state
- [x] 3.4 Keep blank newsletter creation path available as fallback

## 4. Post-instantiation editing and safety boundaries

- [x] 4.1 Ensure newsletters created from templates behave as normal newsletters (hybrid editing allowed)
- [x] 4.2 Ensure edits to instantiated newsletters never mutate template records
- [x] 4.3 Ensure template edits affect only future instantiations and never retroactively mutate existing newsletters

## 5. Verification

- [x] 5.1 Add or update service tests for template creation, template structure updates, and template-to-newsletter deep-copy behavior
- [x] 5.2 Add or update UI tests for template creation from existing newsletter, template selection, and blank-create fallback
- [x] 5.3 Add or update integration tests proving source newsletters and templates remain unchanged after creating and editing instantiated newsletters
