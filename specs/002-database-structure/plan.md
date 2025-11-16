# Implementation Plan: CMS Database Structure

**Branch**: `002-database-structure` | **Date**: 2025-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-database-structure/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Design a PostgreSQL-based relational database schema to store and manage newsletter articles organized by week, with support for:
- Public articles readable by all visitors without authentication
- Class-specific articles (班級大小事) readable by authorized parents and teachers
- Multi-class family viewing where parents see all articles from their children's classes, sorted by grade year
- Article editing permissions restricted to admins and assigned class teachers
- Soft-delete capability for audit trails and data retention

## Technical Context

**Language/Version**: TypeScript 5, React 18, Node.js
**Primary Dependencies**: Supabase (PostgreSQL), React Router v6, @supabase/supabase-js
**Storage**: PostgreSQL via Supabase (defined in DATABASE_AND_DEPLOYMENT.md)
**Testing**: Vitest, React Testing Library
**Target Platform**: Web application (React frontend + Supabase backend)
**Project Type**: Web application with TypeScript frontend + PostgreSQL backend
**Performance Goals**: <500ms for article retrieval (from SC-001), <100ms for class filtering queries
**Constraints**: Support 100+ articles per week without degradation, maintain referential integrity across related entities
**Scale/Scope**: Initial scope: 2+ years of weekly newsletters (104+ weeks), support multi-class families with up to 5 kids per family

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I - Quality First**: ✅
- Database schema design will be thoroughly tested with unit and integration tests
- Schema validation rules will be enforced at database level (constraints, checks)
- Target test coverage >80% for all data access functions

**Principle II - Testability by Design**: ✅
- All functional requirements define acceptance criteria (Given-When-Then format)
- Database queries will be independently testable with fixtures
- External dependencies (Supabase) will be mockable for testing
- Test data fixtures will be reusable and isolated

**Principle III - MVP-First**: ✅
- Core MVP: Public articles + week organization (User Stories 1, 2)
- Secondary: Class-based visibility with parent access (User Story 3)
- Deferred: Advanced analytics and reporting features
- Clear boundaries: No over-design of access control until authentication is implemented

**Principle IV - Chinese First**: ✅
- Database documentation in Chinese
- Entity names (week, article, class) preserved; domain concepts in Chinese comments
- Commit messages and design decisions documented in Chinese

**Principle V - Simplicity & Pragmatism**: ✅
- Relational schema with standard PostgreSQL features (no exotic extensions)
- Single responsibility: store article data; access control delegated to application layer
- Technology choice (PostgreSQL) justified: standard, proven, recommended in existing docs

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
