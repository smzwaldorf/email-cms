# Implementation Tasks: CMS Database Structure

**Feature**: 002-database-structure
**Status**: Ready for Implementation
**Date**: 2025-11-17
**Branch**: `002-database-structure`

---

## Overview

This document defines all implementation tasks for the CMS Database Structure feature, organized by user story priority. Tasks are sequenced to enable parallel development while respecting dependencies.

**Total Tasks**: 24
**Estimated Duration**: 4-5 weeks
**MVP Scope**: User Stories 1 & 2 (public articles, 2-3 weeks)

---

## Implementation Strategy

### Phase Breakdown

1. **Phase 1 (Setup)**: Database initialization & core schema
2. **Phase 2 (Foundational)**: Data access layer, API contracts
3. **Phase 3 (US1)**: Editor publishes articles
4. **Phase 4 (US2)**: Visitor reads articles
5. **Phase 5 (US4)**: Editor updates articles
6. **Phase 6 (US3)**: Class-based visibility
7. **Phase 7 (Polish)**: Performance, testing, documentation

### Parallel Opportunities

- **T001-T006**: Setup can proceed independently
- **T007-T010**: Data access layer tasks (4 parallel)
- **T012-T014**: US1 implementation (3 parallel after T007-T010)
- **T015-T017**: US2 implementation (3 parallel after T007-T010)
- **T020-T022**: US3 implementation (3 parallel)

### Dependency Graph

```
Setup (T001-T006)
  ↓
Foundational (T007-T010)
  ├→ US1 (T012-T014)
  ├→ US2 (T015-T017)
  ├→ US4 (T018-T019)
  └→ US3 (T020-T022)
      ↓
Polish (T023-T024)
```

---

## Phase 1: Setup

*Estimated: 2-3 days*

Setup tasks initialize the database infrastructure and establish the foundation for all subsequent work.

### Database Initialization

- [x] T001 Initialize Supabase PostgreSQL database per `specs/002-database-structure/contracts/schema.sql`
  - [x] Create Supabase project (or use existing)
  - [x] Run schema.sql in SQL Editor
  - [x] Verify all 8 tables created (newsletter_weeks, articles, classes, user_roles, families, family_enrollment, child_class_enrollment, teacher_class_assignment, article_audit_log)
  - [x] Verify indexes created (10 total)
  - [x] Verify triggers created (3 total: updated_at triggers, audit logging)
  - [x] Verify RLS policies enabled

- [x] T002 Create local test database configuration in `.env.test`
  - [x] Add VITE_SUPABASE_TEST_URL
  - [x] Add VITE_SUPABASE_TEST_KEY
  - [x] Document in TESTING.md

- [x] T003 Create database seeding script `scripts/seed-database.ts`
  - [x] Create sample newsletter weeks (2025-W47, 2025-W48)
  - [x] Create sample classes (A1, A2, B1, B2 with grades 1-2)
  - [x] Document in README.md

- [x] T004 Set up Supabase project configuration
  - [x] Enable Row-Level Security
  - [x] Configure authentication providers (will be integrated later)
  - [x] Document connection details in SETUP.md

- [x] T005 Create TypeScript type definitions for all database entities in `src/types/database.ts`
  - [x] Type: NewsletterWeek
  - [x] Type: Article
  - [x] Type: Class
  - [x] Type: UserRole
  - [x] Type: Family
  - [x] Type: ArticleAuditLog
  - [x] Re-export from `src/types/index.ts`

- [x] T006 Create `.env.example` with all required environment variables
  - [x] VITE_SUPABASE_URL
  - [x] VITE_SUPABASE_ANON_KEY
  - [x] DATABASE documentation

---

## Phase 2: Foundational

*Estimated: 1-2 weeks*

Foundational tasks create the data access layer and API contracts shared by all user stories.

### Data Access Layer

- [x] T007 [P] Create Supabase client factory in `src/lib/supabase.ts`
  - [x] Initialize Supabase client with proper configuration
  - [x] Export singleton instance
  - [x] Add error handling & logging

- [x] T008 [P] Create ArticleService in `src/services/ArticleService.ts`
  - [x] Method: `getArticlesByWeek(weekNumber: string, filters?: ArticleFilter)` → Article[]
  - [x] Method: `getArticleById(id: string)` → Article
  - [x] Method: `createArticle(data: CreateArticleDTO)` → Article
  - [x] Method: `updateArticle(id: string, data: UpdateArticleDTO)` → Article
  - [x] Method: `deleteArticle(id: string)` → void (soft-delete)
  - [x] Method: `publishArticle(id: string)` → Article
  - [x] Method: `unpublishArticle(id: string)` → Article
  - [x] Add proper error handling & logging

- [x] T009 [P] Create WeekService in `src/services/WeekService.ts`
  - [x] Method: `getWeek(weekNumber: string)` → NewsletterWeek
  - [x] Method: `createWeek(weekNumber: string, releaseDate: Date)` → NewsletterWeek
  - [x] Method: `publishWeek(weekNumber: string)` → NewsletterWeek
  - [x] Method: `unpublishWeek(weekNumber: string)` → NewsletterWeek
  - [x] Method: `getAllWeeks(options?: PaginationOptions)` → NewsletterWeek[]

- [x] T010 [P] Create ArticleQueryBuilder in `src/services/queries/articleQueries.ts`
  - [x] Query: getPublishedArticlesByWeek (for visitors)
  - [x] Query: getArticlesByWeekUnfiltered (for editors)
  - [x] Query: getArticlesByClass (for class-based filtering)
  - [x] Query: getArticleWithAuditLog (for editing history)
  - [x] Implement with proper indexes for SC-001 (<500ms)
  - [x] Add query profiling/logging

### API Contracts

- [x] T011 Create REST API contracts in `specs/002-database-structure/contracts/api.md`
  - [x] GET /api/articles?week={weekNumber} (public visitor endpoint)
  - [x] GET /api/articles/{id} (get single article)
  - [x] POST /api/articles (create article - editor only)
  - [x] PUT /api/articles/{id} (update article - editor only)
  - [x] DELETE /api/articles/{id} (soft-delete - editor only)
  - [x] POST /api/articles/{id}/publish (publish - editor only)
  - [x] POST /api/articles/{id}/unpublish (unpublish - editor only)
  - [x] POST /api/articles/reorder (batch reorder within week - editor only)
  - [x] GET /api/weeks/{weekNumber} (get week with articles)
  - [x] POST /api/weeks (create week - admin only)
  - [x] Document request/response schemas, error codes, rate limits

---

## Phase 3: User Story 1 - Editor Publishes Weekly Articles

*Estimated: 1-2 weeks*

Implement core CMS functionality for editors to create and publish articles.

### US1 Data Model

- [x] T012 [P] [US1] Implement ArticleRepository in `src/repositories/ArticleRepository.ts`
  - [x] Extend ArticleService with transaction support
  - [x] Method: `createArticleInWeek(weekNumber, articleData)` → Article
  - [x] Method: `reorderArticles(weekNumber, orderMap)` → void (atomic)
  - [x] Method: `validateArticleOrder(weekNumber)` → ValidationResult
  - [x] Add constraint validation (unique order per week)

- [x] T013 [P] [US1] Create article editor React hook in `src/hooks/useArticleEditor.ts`
  - [x] State management for article form
  - [x] Handle title, content, author, visibility_type, restricted_to_classes
  - [x] Draft/publish status toggle
  - [x] Error handling & validation
  - [x] Integration with ArticleService

- [x] T014 [P] [US1] Implement ArticleEditor component in `src/components/ArticleEditor.tsx`
  - [x] Form for creating new articles
  - [x] Week selector
  - [x] Article order display & drag-to-reorder
  - [x] Markdown content editor (basic textarea for MVP)
  - [x] Publication status toggle
  - [x] Save/Publish buttons
  - [x] Error messaging
  - [x] Loading states

### US1 Tests

- [x] T015 [US1] Create ArticleService tests in `tests/services/ArticleService.test.ts`
  - [x] Test: Create article in week
  - [x] Test: Retrieve article by ID
  - [x] Test: Update article content
  - [x] Test: Publish article (is_published = true)
  - [x] Test: Verify created_at and updated_at timestamps
  - [x] Test: Verify article_order constraint (unique per week)
  - [x] Test: Soft-delete preserves data
  - [x] Use test database fixtures

- [x] T016 [US1] Create ArticleEditor component tests in `tests/components/ArticleEditor.test.tsx`
  - [x] Test: Form submission creates article
  - [x] Test: Order display shows current sequence
  - [x] Test: Publish button sets is_published = true
  - [x] Test: Validation prevents empty title/content
  - [x] Test: Error messages displayed on save failure

- [x] T017 [US1] Create E2E test for article creation workflow in `tests/integration/article-workflow.test.ts`
  - [x] Test: Editor creates article → article appears in database
  - [x] Test: Editor publishes article → is_published = true
  - [x] Test: Audit log records creation & publication
  - [x] Coverage: All US1 acceptance scenarios

---

## Phase 4: User Story 2 - Visitor Views Published Articles

*Estimated: 1-2 weeks*

Implement public-facing article viewing with performance optimization.

### US2 Data Access & UI

- [x] T018 [P] [US2] Implement ArticleListView component in `src/components/ArticleListView.tsx`
  - [x] Fetch published articles for week (via ArticleService)
  - [x] Display articles in article_order sequence
  - [x] Article cards with title, author, preview
  - [x] Link to ArticleContent view
  - [x] Loading state (SC-001: <500ms target)
  - [x] Error fallback
  - [x] Mobile responsive design

- [x] T019 [P] [US2] Implement ArticleContent component in `src/components/ArticleContent.tsx`
  - [x] Render markdown content (use markdown library like react-markdown)
  - [x] Display article metadata (author, created_at, updated_at)
  - [x] Handle markdown sanitization for XSS prevention
  - [x] Loading state for single article
  - [x] Previous/Next navigation
  - [x] Mobile responsive design

### US2 Tests

- [x] T020 [US2] Create ArticleListView integration test in `tests/integration/visitor-views-articles.test.ts`
  - [x] Test: Visitor fetches published articles for week → returns only published
  - [x] Test: Returns articles in article_order sequence
  - [x] Test: Unpublished articles excluded (0% false positives, SC-003)
  - [x] Test: Performance <500ms for 100 articles (SC-001)
  - [x] Test: Deleted articles excluded (deleted_at IS NULL)
  - [x] Test: Handles empty week gracefully
  - [x] Test: All US2 acceptance scenarios

- [x] T021 [US2] Create ArticleContent render test in `tests/components/ArticleContent.test.tsx`
  - [x] Test: Markdown renders correctly
  - [x] Test: XSS prevention (sanitized)
  - [x] Test: Metadata displays (author, dates)
  - [x] Test: Navigation buttons work

- [x] T022 [US2] Performance benchmark for US2 in `tests/performance/article-retrieval.perf.test.ts`
  - [x] Benchmark: 10 articles - target <100ms
  - [x] Benchmark: 50 articles - target <300ms
  - [x] Benchmark: 100 articles - target <500ms
  - [x] Verify indexes being used (EXPLAIN ANALYZE)
  - [x] Document results in PERFORMANCE.md

---

## Phase 5: User Story 4 - Editor Updates Existing Articles

*Estimated: 1 week*

Enable editors to modify existing articles and track changes.

### US4 Implementation

- [x] T023 [P] [US4] Create ArticleUpdateService in `src/services/ArticleUpdateService.ts`
  - [x] Method: `updateArticleContent(id: string, title: string, content: string)` → Article
  - [x] Preserve created_at, update updated_at (via trigger)
  - [x] Validate article exists and not deleted
  - [x] Trigger audit_article_changes automatically
  - [x] Handle concurrent edit conflicts (last-write-wins per assumption)

- [x] T024 [P] [US4] Create ArticleEditForm component in `src/components/ArticleEditForm.tsx`
  - [x] Load article for editing
  - [x] Form to update title & content
  - [x] Save button (calls ArticleUpdateService)
  - [x] Show last updated timestamp
  - [x] Revert to previous version option (via audit log)
  - [x] Conflict notification if updated since load

### US4 Tests

- [x] T025 [US4] Create ArticleUpdateService tests in `tests/services/ArticleUpdateService.test.ts`
  - [x] Test: Update title and content
  - [x] Test: Preserve created_at, update updated_at
  - [x] Test: Audit log records update action
  - [x] Test: Error on non-existent article
  - [x] Test: Soft-deleted articles cannot be updated
  - [x] Test: All US4 acceptance scenarios

- [x] T026 [US4] Create ArticleEditForm integration test in `tests/integration/article-update-workflow.test.ts`
  - [x] Test: Load article for editing
  - [x] Test: Update title → persists
  - [x] Test: Update content → persists
  - [x] Test: Timestamps updated correctly
  - [x] Test: Audit trail captures change

---

## Phase 6: User Story 3 - Role-Based Article Visibility by Class

*Estimated: 2-3 weeks*

Implement class-based article filtering for 班級大小事 (class updates).

### US3 Data Access & Filtering

- [x] T027 [P] [US3] Create ClassService in `src/services/ClassService.ts`
  - [x] Method: `getClass(classId: string)` → Class
  - [x] Method: `getAllClasses()` → Class[]
  - [x] Method: `getClassesByGradeYear(gradeYear: number)` → Class[]

- [x] T028 [P] [US3] Create FamilyService in `src/services/FamilyService.ts`
  - [x] Method: `getFamily(familyId: string)` → Family + enrollments
  - [x] Method: `getChildrenClasses(familyId: string)` → Class[] (sorted by grade_year DESC)
  - [x] Method: `enrollChild(familyId, childId, classId)` → void
  - [x] Method: `enrollParent(familyId, parentId)` → void
  - [x] Method: `getParentFamilies(parentId)` → Family[]

- [x] T029 [P] [US3] Create class-aware article query in `src/services/queries/classArticleQueries.ts`
  - [x] Query: `getArticlesForFamily(familyId, weekNumber)` → Article[]
  - [x] Returns: All public articles + class-restricted articles for children's classes
  - [x] Sorting: By class_grade_year DESC, then article_order ASC
  - [x] Performance: <100ms for family with up to 5 children
  - [x] Verify RLS policies work (application-level filtering)

- [x] T030 [P] [US3] Extend ArticleService with class-based filtering
  - [x] Method: `getArticlesForClass(classId: string, weekNumber: string)` → Article[]
  - [x] Method: `setArticleClassRestriction(articleId: string, classIds: string[])` → Article
  - [x] Method: `removeArticleClassRestriction(articleId: string)` → Article
  - [x] Validation: restricted_to_classes cannot be empty if visibility_type = 'class_restricted'

### US3 Components

- [ ] T031 [US3] Create ClassArticleFilter component in `src/components/ClassArticleFilter.tsx`
  - [ ] Select/multi-select for class(es) or family
  - [ ] Show available classes for logged-in user (teachers/parents)
  - [ ] Fetch and display articles for selected classes
  - [ ] Sorting by grade year with visual indicators

- [ ] T032 [US3] Create ArticleClassRestrictionEditor in `src/components/ArticleClassRestrictionEditor.tsx`
  - [ ] Multi-select for restricted_to_classes
  - [ ] Toggle between public and class-restricted
  - [ ] Show list of available classes (A1, B1, etc.) with grade years
  - [ ] Save restrictions (calls setArticleClassRestriction)

### US3 Tests

- [x] T033 [US3] Create FamilyService tests in `tests/services/FamilyService.test.ts`
  - [x] Test: Get children's classes for family
  - [x] Test: Sorting by grade_year DESC
  - [x] Test: Enroll child in class
  - [x] Test: Enroll parent in family

- [x] T034 [US3] Create class-aware article query tests in `tests/services/queries/classArticleQueries.test.ts`
  - [x] Test: Get articles for family (public + class-specific)
  - [x] Test: Exclude non-enrolled classes
  - [x] Test: Sorting by grade year DESC
  - [x] Test: Performance <100ms (SC-005)
  - [x] Test: All US3 acceptance scenarios

- [x] T035 [US3] Create ClassArticleFilter integration test in `tests/integration/class-based-filtering.test.ts`
  - [x] Test: Setup family with 2 children in different classes
  - [x] Test: Parent views week → sees all public + their children's class articles
  - [x] Test: Sorting by grade year (older kids first)
  - [x] Test: No duplicate content for same article in multiple classes
  - [x] Test: Verification of SC-005 (100% accuracy)

---

## Phase 7: Polish & Cross-Cutting Concerns

*Estimated: 1-2 weeks*

Final phase for performance validation, comprehensive testing, and deployment preparation.

### Performance & Optimization

- [x] T036 Create performance validation in `tests/performance/cms-performance.test.ts`
  - [x] Verify SC-001: <500ms for 100-article weeks (10, 50, 100 article benchmarks)
  - [x] Verify SC-002: 100% consistency on order updates (concurrent reorder tests)
  - [x] Verify SC-005: <100ms for class filtering (1-5 children filtering)
  - [x] Verify SC-006: 104+ weeks without degradation (week pagination tests)
  - [x] Load test: concurrent reads (10, 50 concurrent operations)
  - [x] 25 performance tests validating all criteria

- [x] T037 Create database health check script in `scripts/health-check.ts`
  - [x] Verify all tables exist (9/9 required tables)
  - [x] Verify all indexes present (warning on direct PostgreSQL requirement)
  - [x] Check database triggers functioning
  - [x] Verify RLS policies enabled
  - [x] Query performance monitoring (<300ms target)
  - [x] Constraint verification
  - [x] Health report JSON output
  - [x] Color-coded CLI output with summary

### Documentation & Deployment

- [x] T038 Create SETUP.md for developers
  - [x] Prerequisites and system requirements
  - [x] Environment variable configuration (.env.local)
  - [x] Database initialization steps (9 tables, triggers, indexes)
  - [x] Running seed data script
  - [x] Test database setup
  - [x] Development commands reference
  - [x] Project structure overview
  - [x] Verification checklist
  - [x] Comprehensive troubleshooting guide

- [x] T039 Create TESTING.md guide
  - [x] Quick start for running tests
  - [x] Test organization and structure
  - [x] How to run unit/component/service/integration tests
  - [x] How to run performance tests
  - [x] Test coverage reporting and requirements
  - [x] Writing test patterns and examples
  - [x] Mocking strategies (Supabase, React Router)
  - [x] Performance testing examples
  - [x] Debugging failed tests
  - [x] CI/CD integration examples
  - [x] Best practices and troubleshooting

- [x] T040 Create DEPLOYMENT.md guide
  - [x] Pre-deployment checklist (code, docs, database, team)
  - [x] Database migration steps (schema, indexes, triggers, RLS)
  - [x] Production configuration (env vars, build, deployment targets)
  - [x] Security verification (RLS policies, API keys, logging)
  - [x] Performance validation (tests, indexes, load testing)
  - [x] Deployment steps (backup, schema, feature flags, application)
  - [x] Post-deployment verification (health check, monitoring, data integrity)
  - [x] Monitoring and maintenance (alerts, log rotation, DB maintenance)
  - [x] Rollback procedures (full, partial, database)
  - [x] Troubleshooting guide (build, runtime, memory)
  - [x] Multi-platform deployment (Vercel, Docker, nginx)

- [ ] T041 Create API.md documentation
  - [ ] All endpoints with request/response examples
  - [ ] Error codes and handling
  - [ ] Rate limiting
  - [ ] Authentication requirements (for future phases)
  - [ ] Sample curl commands

### Final Testing & Validation

- [ ] T042 Create end-to-end test suite in `tests/e2e/cms-complete-flow.test.ts`
  - [ ] Complete workflow: Create week → Add articles → Publish → View as visitor
  - [ ] Multi-editor concurrency: Two editors creating articles simultaneously
  - [ ] Family multi-class scenario: Parent with 2 children viewing relevant articles
  - [ ] All edge cases from specification
  - [ ] Audit log verification

- [ ] T043 Create data integrity verification in `tests/data-integrity/schema-validation.test.ts`
  - [ ] Verify all constraints enforced
  - [ ] Verify referential integrity
  - [ ] Verify triggers work (audit logging, updated_at)
  - [ ] Verify soft-delete strategy
  - [ ] Test recovery scenarios

- [ ] T044 Create documentation in README.md
  - [ ] Feature overview
  - [ ] Quick start guide
  - [ ] Architecture diagram
  - [ ] Key design decisions
  - [ ] Links to detailed docs (SETUP.md, API.md, etc.)

---

## Task Dependencies

### Critical Path (Blocking All Stories)

```
T001 (Database) → T005 (Types) → T007 (Supabase Client)
                ↓
          T008-T010 (Services & Queries)
                ↓
         All User Stories (T012+)
```

### Story Dependencies

- **US1 (T012-T017)**: Depends on T001-T010 (foundational)
- **US2 (T018-T022)**: Depends on T001-T010
- **US4 (T023-T026)**: Depends on T001-T010
- **US3 (T027-T035)**: Depends on T001-T010 + US1 recommended (but can run parallel)

### Parallel Execution Opportunities

- **Setup Phase**: T002-T006 can run in parallel after T001
- **Services**: T008-T010 can run in parallel after T007
- **Stories**: US1, US2, US4 can run in parallel after T001-T010
- **US3**: Can start after T001-T010, but benefits from US1 completion

---

## Success Criteria Mapping

| Success Criterion | Tasks | Verification |
|-------------------|-------|---------------|
| **SC-001** (<500ms retrieval) | T010, T022, T036 | Performance benchmark in T022 |
| **SC-002** (100% order consistency) | T012, T015 | Unit test in T015 |
| **SC-003** (0% false positives) | T008, T020, T021 | Integration test in T020 |
| **SC-004** (Single-session editing) | T012-T014, T016 | E2E test in T017 |
| **SC-005** (100% class filtering accuracy) | T029, T034, T035 | Integration test in T035 |
| **SC-006** (104+ weeks support) | T036 | Load test in T036 |
| **SC-007** (Referential integrity) | T001, T043 | Data integrity test in T043 |

---

## Estimation & Timeline

| Phase | Tasks | Estimated Duration | Team Size |
|-------|-------|-------------------|-----------|
| Phase 1 (Setup) | T001-T006 | 2-3 days | 1 |
| Phase 2 (Foundational) | T007-T011 | 5-7 days | 2 |
| Phase 3 (US1) | T012-T017 | 5-7 days | 2 |
| Phase 4 (US2) | T018-T022 | 5-7 days | 2 |
| Phase 5 (US4) | T023-T026 | 3-5 days | 1 |
| Phase 6 (US3) | T027-T035 | 10-14 days | 2-3 |
| Phase 7 (Polish) | T036-T044 | 5-7 days | 1-2 |
| **Total** | **24 tasks** | **4-5 weeks** | **2-3** |

---

## MVP Scope Recommendation

**For fastest value delivery, implement in this order:**

1. **Phase 1**: T001-T006 (Setup, 2-3 days)
2. **Phase 2**: T007-T011 (Foundational, 5-7 days)
3. **Phase 3**: T012-T017 (US1: Editor publishing, 5-7 days)
4. **Phase 4**: T018-T022 (US2: Visitor viewing, 5-7 days)

**MVP Completion**: 2-3 weeks
**MVP Value**: Full public-facing newsletter viewer + editor CMS

**Phase 2 Extensions** (add if time):
- Phase 5: T023-T026 (Editor updates)
- Phase 7: T036-T044 (Polish & documentation)

**Defer to Later Release**:
- Phase 6: US3 (Class-based visibility - requires auth implementation)

---

## Notes for Developers

1. **Database First**: T001-T006 must complete before any other work
2. **Test-Driven**: Each service (T008-T010) should have tests before implementation
3. **Performance**: SC-001 target is critical - profile queries early (T010, T022)
4. **Soft-Delete**: Always filter by `deleted_at IS NULL` in queries (see T010)
5. **Audit Trail**: Triggers handle audit logging automatically (T001)
6. **RLS**: Row-level security configured at database level; application enforces additional filtering for class-based visibility

---

## Next Steps

1. **Assign Tasks**: Distribute T001-T006 to team
2. **Setup Sprint**: Complete Phase 1 & 2 (1 week)
3. **Story Sprints**: US1 & US2 in parallel (2 weeks)
4. **Review**: Performance benchmarks & documentation
5. **Deploy**: To staging environment

---

**Generated**: 2025-11-17
**Feature Spec**: [spec.md](./spec.md)
**Design Plan**: [plan.md](./plan.md)
**Data Model**: [data-model.md](./data-model.md)
**Schema**: [contracts/schema.sql](./contracts/schema.sql)
