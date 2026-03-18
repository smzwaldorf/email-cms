## Why

The product now supports core RBAC and class-based filtering, but operators still lack a first-class admin workflow for fine-grained permission management. As the admin dashboard expands, we need deterministic multi-role access rules and auditable permission controls before implementation continues to avoid ambiguous authorization behavior.

## What Changes

- Define an admin access-control workflow for role assignment, class restriction management, bulk permission updates, and access-log inspection.
- Define deterministic multi-role resolution rules (including role precedence and class-scope conflict handling) for users with overlapping identities such as teacher + parent.
- Define effective-permission preview and validation behavior so admins can verify impact before applying changes.
- Define auditability requirements for permission changes and authorization decision tracing.
- Keep scope focused on planning and behavioral contracts; do not implement runtime authorization changes in this change.

## Capabilities

### New Capabilities
- `admin-access-control-workflow`: Admin-facing workflows to manage roles, class restrictions, bulk updates, and permission audit visibility.
- `multi-role-permission-resolution`: Deterministic rules for resolving effective permissions when users have multiple roles and overlapping class scopes.

### Modified Capabilities
- None.

## Impact

- Affected surfaces: admin dashboard permission UI, role-management APIs, authorization guard evaluation paths, and audit log query interfaces.
- Affected data behavior: role assignments, class-level permission constraints, bulk change operations, and permission change audit history.
- Affected teams: admins/operators managing users and classes; engineering teams maintaining authz and admin workflows.
- Relationship to existing capabilities: extends foundational auth from `003-passwordless-auth` and complements `newsletter-admin-workflow` without changing newsletter composition semantics.
