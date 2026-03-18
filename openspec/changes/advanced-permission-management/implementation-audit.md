# Existing Authorization Path Audit

This note captures the current authorization paths in `email-cms` and the canonical inputs required for a deterministic effective-permission resolver.

## Current Paths

- `src/services/PermissionService.ts`
  - Central check points for `canViewArticle`, `canEditArticle`, and `canDeleteArticle`.
  - Existing behavior is role-first, with teacher class checks for class-restricted edit.
- `src/services/ArticleService.ts`
  - Enforces edit/delete authorization through `PermissionService.assertCanEditArticle` and `assertCanDeleteArticle`.
- `src/components/ArticleEditor.tsx`
  - Reads role and permission booleans to gate edit UI affordances.
- `src/services/adminService.ts`
  - Contains user-role and teacher-class assignment workflows but no unified multi-role resolver contract.

## Canonical Resolver Inputs

- Actor identity:
  - `userId`
  - Assigned roles (single-role today via `user_roles`, expandable to multi-role source)
- Action context:
  - `article:view`, `article:edit`, `article:delete`, and admin permission-management actions
- Resource context:
  - `article.status`
  - `article.visibility_type`
  - `article.restricted_to_classes`
- Scope context:
  - Teacher class scope (`teacher_class_assignment.class_id`)
  - Parent-derived class scope (`family_enrollment.family_id` -> `child_class_enrollment.class_id`)
  - Student class scope (`child_class_enrollment.class_id`)
- Policy metadata:
  - Stable policy version string for traceability
  - Deterministic role precedence (`Admin > Teacher > Parent > Student`)

## Identified Gaps (Pre-Change)

- No explicit resolver contract returning winning role, scope, and rationale.
- Multi-role precedence and stable class-scope union are not codified.
- Decision-trace logging for authorization outcomes is not consistently persisted.

## Verification Record (2026-03-18)

- `npm run lint` -> failed due broad pre-existing repository lint baseline (not specific to this change).
- `npm test -- --run` -> passed (`120` files, `1871` tests).
- `npm run build` -> failed due broad pre-existing TypeScript/test typing baseline (not specific to this change).
