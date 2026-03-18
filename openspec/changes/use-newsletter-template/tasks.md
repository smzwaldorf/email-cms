## 1. Template creation foundation

- [ ] 1.1 Audit current admin newsletter and article services to identify reusable create, fetch, and composition-copy logic
- [ ] 1.2 Implement a service workflow that creates a template newsletter from a selected existing newsletter
- [ ] 1.3 Implement template-article copy logic that preserves full body content and ordering in canonical template records
- [ ] 1.4 Ensure template creation does not mutate source newsletter metadata or source article records

## 2. Template management behavior

- [ ] 2.1 Add admin UI entry point to create a template from an existing newsletter
- [ ] 2.2 Add template editing support for article count and article ordering changes
- [ ] 2.3 Ensure template content edits update canonical template records without creating version branches

## 3. Newsletter instantiation from template

- [ ] 3.1 Implement service workflow to create a new draft newsletter from a selected template
- [ ] 3.2 Deep-copy full template article bodies and ordering into independent draft article records
- [ ] 3.3 Reset publication metadata so instantiated newsletters/articles always start in draft state
- [ ] 3.4 Keep blank newsletter creation path available as fallback

## 4. Post-instantiation editing and safety boundaries

- [ ] 4.1 Ensure newsletters created from templates behave as normal newsletters (hybrid editing allowed)
- [ ] 4.2 Ensure edits to instantiated newsletters never mutate template records
- [ ] 4.3 Ensure template edits affect only future instantiations and never retroactively mutate existing newsletters

## 5. Verification

- [ ] 5.1 Add or update service tests for template creation, template structure updates, and template-to-newsletter deep-copy behavior
- [ ] 5.2 Add or update UI tests for template creation from existing newsletter, template selection, and blank-create fallback
- [ ] 5.3 Add or update integration tests proving source newsletters and templates remain unchanged after creating and editing instantiated newsletters
