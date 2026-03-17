## 1. Lifecycle workflow fixes

- [ ] 1.1 Review the admin newsletter management page and helper utilities against the warning-prone lifecycle scenarios
- [ ] 1.2 Adjust newsletter management behavior so publish-to-archive transitions refresh visible state and actions consistently
- [ ] 1.3 Fix any public-link or route handling gaps for ID-based special-edition newsletters discovered during implementation

## 2. Scenario coverage

- [ ] 2.1 Add management-page integration coverage for publishing a draft newsletter and then archiving it from the same workflow
- [ ] 2.2 Add management-page integration coverage for loading and operating on a special-edition newsletter addressed by ID
- [ ] 2.3 Add route or helper coverage that proves published special editions use the newsletter-ID public path

## 3. Verification

- [ ] 3.1 Run the targeted newsletter admin tests affected by the warning fixes
- [ ] 3.2 Re-run `/opsx:verify newsletter-admin-workflow` expectations manually and confirm the warnings are resolved
