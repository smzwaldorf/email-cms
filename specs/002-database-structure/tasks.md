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

- [ ] T001 Initialize Supabase PostgreSQL database per `specs/002-database-structure/contracts/schema.sql`
  - [ ] Create Supabase project (or use existing)
  - [ ] Run schema.sql in SQL Editor
  - [ ] Verify all 8 tables created (newsletter_weeks, articles, classes, user_roles, families, family_enrollment, child_class_enrollment, teacher_class_assignment, article_audit_log)
  - [ ] Verify indexes created (10 total)
  - [ ] Verify triggers created (3 total: updated_at triggers, audit logging)
  - [ ] Verify RLS policies enabled

- [ ] T002 Create local test database configuration in `.env.test`
  - [ ] Add VITE_SUPABASE_TEST_URL
  - [ ] Add VITE_SUPABASE_TEST_KEY
  - [ ] Document in TESTING.md

- [ ] T003 Create database seeding script `scripts/seed-database.ts`
  - [ ] Create sample newsletter weeks (2025-W47, 2025-W48)
  - [ ] Create sample classes (A1, A2, B1, B2 with grades 1-2)
  - [ ] Document in README.md

- [ ] T004 Set up Supabase project configuration
  - [ ] Enable Row-Level Security
  - [ ] Configure authentication providers (will be integrated later)
  - [ ] Document connection details in SETUP.md

- [ ] T005 Create TypeScript type definitions for all database entities in `src/types/database.ts`
  - [ ] Type: NewsletterWeek
  - [ ] Type: Article
  - [ ] Type: Class
  - [ ] Type: UserRole
  - [ ] Type: Family
  - [ ] Type: ArticleAuditLog
  - [ ] Re-export from `src/types/index.ts`

- [ ] T006 Create `.env.example` with all required environment variables
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] DATABASE documentation

---

## Phase 2: Foundational

*Estimated: 1-2 weeks*

Foundational tasks create the data access layer and API contracts shared by all user stories.

### Data Access Layer

- [ ] T007 [P] Create Supabase client factory in `src/lib/supabase.ts`
  - [ ] Initialize Supabase client with proper configuration
  - [ ] Export singleton instance
  - [ ] Add error handling & logging

- [ ] T008 [P] Create ArticleService in `src/services/ArticleService.ts`
  - [ ] Method: `getArticlesByWeek(weekNumber: string, filters?: ArticleFilter)` → Article[]
  - [ ] Method: `getArticleById(id: string)` → Article
  - [ ] Method: `createArticle(data: CreateArticleDTO)` → Article
  - [ ] Method: `updateArticle(id: string, data: UpdateArticleDTO)` → Article
  - [ ] Method: `deleteArticle(id: string)` → void (soft-delete)
  - [ ] Method: `publishArticle(id: string)` → Article
  - [ ] Method: `unpublishArticle(id: string)` → Article
  - [ ] Add proper error handling & logging

- [ ] T009 [P] Create WeekService in `src/services/WeekService.ts`
  - [ ] Method: `getWeek(weekNumber: string)` → NewsletterWeek
  - [ ] Method: `createWeek(weekNumber: string, releaseDate: Date)` → NewsletterWeek
  - [ ] Method: `publishWeek(weekNumber: string)` → NewsletterWeek
  - [ ] Method: `unpublishWeek(weekNumber: string)` → NewsletterWeek
  - [ ] Method: `getAllWeeks(options?: PaginationOptions)` → NewsletterWeek[]

- [ ] T010 [P] Create ArticleQueryBuilder in `src/services/queries/articleQueries.ts`
  - [ ] Query: getPublishedArticlesByWeek (for visitors)
  - [ ] Query: getArticlesByWeekUnfiltered (for editors)
  - [ ] Query: getArticlesByClass (for class-based filtering)
  - [ ] Query: getArticleWithAuditLog (for editing history)
  - [ ] Implement with proper indexes for SC-001 (<500ms)
  - [ ] Add query profiling/logging

### API Contracts

- [ ] T011 Create REST API contracts in `specs/002-database-structure/contracts/api.md`
  - [ ] GET /api/articles?week={weekNumber} (public visitor endpoint)
  - [ ] GET /api/articles/{id} (get single article)
  - [ ] POST /api/articles (create article - editor only)
  - [ ] PUT /api/articles/{id} (update article - editor only)
  - [ ] DELETE /api/articles/{id} (soft-delete - editor only)
  - [ ] POST /api/articles/{id}/publish (publish - editor only)
  - [ ] POST /api/articles/{id}/unpublish (unpublish - editor only)
  - [ ] POST /api/articles/reorder (batch reorder within week - editor only)
  - [ ] GET /api/weeks/{weekNumber} (get week with articles)
  - [ ] POST /api/weeks (create week - admin only)
  - [ ] Document request/response schemas, error codes, rate limits

---

## Phase 3: User Story 1 - Editor Publishes Weekly Articles

*Estimated: 1-2 weeks*

Implement core CMS functionality for editors to create and publish articles.

### US1 Data Model

- [ ] T012 [P] [US1] Implement ArticleRepository in `src/repositories/ArticleRepository.ts`
  - [ ] Extend ArticleService with transaction support
  - [ ] Method: `createArticleInWeek(weekNumber, articleData)` → Article
  - [ ] Method: `reorderArticles(weekNumber, orderMap)` → void (atomic)
  - [ ] Method: `validateArticleOrder(weekNumber)` → ValidationResult
  - [ ] Add constraint validation (unique order per week)

- [ ] T013 [P] [US1] Create article editor React hook in `src/hooks/useArticleEditor.ts`
  - [ ] State management for article form
  - [ ] Handle title, content, author, visibility_type, restricted_to_classes
  - [ ] Draft/publish status toggle
  - [ ] Error handling & validation
  - [ ] Integration with ArticleService

- [ ] T014 [P] [US1] Implement ArticleEditor component in `src/components/ArticleEditor.tsx`
  - [ ] Form for creating new articles
  - [ ] Week selector
  - [ ] Article order display & drag-to-reorder
  - [ ] Markdown content editor (basic textarea for MVP)
  - [ ] Publication status toggle
  - [ ] Save/Publish buttons
  - [ ] Error messaging
  - [ ] Loading states

### US1 Tests

- [ ] T015 [US1] Create ArticleService tests in `tests/services/ArticleService.test.ts`
  - [ ] Test: Create article in week
  - [ ] Test: Retrieve article by ID
  - [ ] Test: Update article content
  - [ ] Test: Publish article (is_published = true)
  - [ ] Test: Verify created_at and updated_at timestamps
  - [ ] Test: Verify article_order constraint (unique per week)
  - [ ] Test: Soft-delete preserves data
  - [ ] Use test database fixtures

- [ ] T016 [US1] Create ArticleEditor component tests in `tests/components/ArticleEditor.test.tsx`
  - [ ] Test: Form submission creates article
  - [ ] Test: Order display shows current sequence
  - [ ] Test: Publish button sets is_published = true
  - [ ] Test: Validation prevents empty title/content
  - [ ] Test: Error messages displayed on save failure

- [ ] T017 [US1] Create E2E test for article creation workflow in `tests/integration/article-workflow.test.ts`
  - [ ] Test: Editor creates article → article appears in database
  - [ ] Test: Editor publishes article → is_published = true
  - [ ] Test: Audit log records creation & publication
  - [ ] Coverage: All US1 acceptance scenarios

---

## Phase 4: User Story 2 - Visitor Views Published Articles

*Estimated: 1-2 weeks*

Implement public-facing article viewing with performance optimization.

### US2 Data Access & UI

- [ ] T018 [P] [US2] Implement ArticleListView component in `src/components/ArticleListView.tsx`
  - [ ] Fetch published articles for week (via ArticleService)
  - [ ] Display articles in article_order sequence
  - [ ] Article cards with title, author, preview
  - [ ] Link to ArticleContent view
  - [ ] Loading state (SC-001: <500ms target)
  - [ ] Error fallback
  - [ ] Mobile responsive design

- [ ] T019 [P] [US2] Implement ArticleContent component in `src/components/ArticleContent.tsx`
  - [ ] Render markdown content (use markdown library like react-markdown)
  - [ ] Display article metadata (author, created_at, updated_at)
  - [ ] Handle markdown sanitization for XSS prevention
  - [ ] Loading state for single article
  - [ ] Previous/Next navigation
  - [ ] Mobile responsive design

### US2 Tests

- [ ] T020 [US2] Create ArticleListView integration test in `tests/integration/visitor-views-articles.test.ts`
  - [ ] Test: Visitor fetches published articles for week → returns only published
  - [ ] Test: Returns articles in article_order sequence
  - [ ] Test: Unpublished articles excluded (0% false positives, SC-003)
  - [ ] Test: Performance <500ms for 100 articles (SC-001)
  - [ ] Test: Deleted articles excluded (deleted_at IS NULL)
  - [ ] Test: Handles empty week gracefully
  - [ ] Test: All US2 acceptance scenarios

- [ ] T021 [US2] Create ArticleContent render test in `tests/components/ArticleContent.test.tsx`
  - [ ] Test: Markdown renders correctly
  - [ ] Test: XSS prevention (sanitized)
  - [ ] Test: Metadata displays (author, dates)
  - [ ] Test: Navigation buttons work

- [ ] T022 [US2] Performance benchmark for US2 in `tests/performance/article-retrieval.perf.test.ts`
  - [ ] Benchmark: 10 articles - target <100ms
  - [ ] Benchmark: 50 articles - target <300ms
  - [ ] Benchmark: 100 articles - target <500ms
  - [ ] Verify indexes being used (EXPLAIN ANALYZE)
  - [ ] Document results in PERFORMANCE.md

---

## Phase 5: User Story 4 - Editor Updates Existing Articles

*Estimated: 1 week*

Enable editors to modify existing articles and track changes.

### US4 Implementation

- [ ] T023 [P] [US4] Create ArticleUpdateService in `src/services/ArticleUpdateService.ts`
  - [ ] Method: `updateArticleContent(id: string, title: string, content: string)` → Article
  - [ ] Preserve created_at, update updated_at (via trigger)
  - [ ] Validate article exists and not deleted
  - [ ] Trigger audit_article_changes automatically
  - [ ] Handle concurrent edit conflicts (last-write-wins per assumption)

- [ ] T024 [P] [US4] Create ArticleEditForm component in `src/components/ArticleEditForm.tsx`
  - [ ] Load article for editing
  - [ ] Form to update title & content
  - [ ] Save button (calls ArticleUpdateService)
  - [ ] Show last updated timestamp
  - [ ] Revert to previous version option (via audit log)
  - [ ] Conflict notification if updated since load

### US4 Tests

- [ ] T025 [US4] Create ArticleUpdateService tests in `tests/services/ArticleUpdateService.test.ts`
  - [ ] Test: Update title and content
  - [ ] Test: Preserve created_at, update updated_at
  - [ ] Test: Audit log records update action
  - [ ] Test: Error on non-existent article
  - [ ] Test: Soft-deleted articles cannot be updated
  - [ ] Test: All US4 acceptance scenarios

- [ ] T026 [US4] Create ArticleEditForm integration test in `tests/integration/article-update-workflow.test.ts`
  - [ ] Test: Load article for editing
  - [ ] Test: Update title → persists
  - [ ] Test: Update content → persists
  - [ ] Test: Timestamps updated correctly
  - [ ] Test: Audit trail captures change

---

## Phase 6: User Story 3 - Role-Based Article Visibility by Class

*Estimated: 2-3 weeks*

Implement class-based article filtering for 班級大小事 (class updates).

### US3 Data Access & Filtering

- [ ] T027 [P] [US3] Create ClassService in `src/services/ClassService.ts`
  - [ ] Method: `getClass(classId: string)` → Class
  - [ ] Method: `getAllClasses()` → Class[]
  - [ ] Method: `getClassesByGradeYear(gradeYear: number)` → Class[]

- [ ] T028 [P] [US3] Create FamilyService in `src/services/FamilyService.ts`
  - [ ] Method: `getFamily(familyId: string)` → Family + enrollments
  - [ ] Method: `getChildrenClasses(familyId: string)` → Class[] (sorted by grade_year DESC)
  - [ ] Method: `enrollChild(familyId, childId, classId)` → void
  - [ ] Method: `enrollParent(familyId, parentId)` → void
  - [ ] Method: `getParentFamilies(parentId)` → Family[]

- [ ] T029 [P] [US3] Create class-aware article query in `src/services/queries/classArticleQueries.ts`
  - [ ] Query: `getArticlesForFamily(familyId, weekNumber)` → Article[]
  - [ ] Returns: All public articles + class-restricted articles for children's classes
  - [ ] Sorting: By class_grade_year DESC, then article_order ASC
  - [ ] Performance: <100ms for family with up to 5 children
  - [ ] Verify RLS policies work (application-level filtering)

- [ ] T030 [P] [US3] Extend ArticleService with class-based filtering
  - [ ] Method: `getArticlesForClass(classId: string, weekNumber: string)` → Article[]
  - [ ] Method: `setArticleClassRestriction(articleId: string, classIds: string[])` → Article
  - [ ] Method: `removeArticleClassRestriction(articleId: string)` → Article
  - [ ] Validation: restricted_to_classes cannot be empty if visibility_type = 'class_restricted'

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

- [ ] T033 [US3] Create FamilyService tests in `tests/services/FamilyService.test.ts`
  - [ ] Test: Get children's classes for family
  - [ ] Test: Sorting by grade_year DESC
  - [ ] Test: Enroll child in class
  - [ ] Test: Enroll parent in family

- [ ] T034 [US3] Create class-aware article query tests in `tests/services/queries/classArticleQueries.test.ts`
  - [ ] Test: Get articles for family (public + class-specific)
  - [ ] Test: Exclude non-enrolled classes
  - [ ] Test: Sorting by grade year DESC
  - [ ] Test: Performance <100ms (SC-005)
  - [ ] Test: All US3 acceptance scenarios

- [ ] T035 [US3] Create ClassArticleFilter integration test in `tests/integration/class-based-filtering.test.ts`
  - [ ] Test: Setup family with 2 children in different classes
  - [ ] Test: Parent views week → sees all public + their children's class articles
  - [ ] Test: Sorting by grade year (older kids first)
  - [ ] Test: No duplicate content for same article in multiple classes
  - [ ] Test: Verification of SC-005 (100% accuracy)

---

## Phase 7: Polish & Cross-Cutting Concerns

*Estimated: 1-2 weeks*

Final phase for performance validation, comprehensive testing, and deployment preparation.

### Performance & Optimization

- [ ] T036 Create performance validation in `tests/performance/cms-performance.test.ts`
  - [ ] Verify SC-001: <500ms for 100-article weeks
  - [ ] Verify SC-002: 100% consistency on order updates
  - [ ] Verify SC-005: <100ms for class filtering
  - [ ] Verify SC-006: 104+ weeks without degradation
  - [ ] Load test: 1000+ concurrent reads
  - [ ] Document results in PERFORMANCE.md

- [ ] T037 Create database health check script in `scripts/health-check.ts`
  - [ ] Verify all tables exist
  - [ ] Verify all indexes present
  - [ ] Check index fragmentation
  - [ ] Verify RLS policies enabled
  - [ ] Query slow logs

### Documentation & Deployment

- [ ] T038 Create SETUP.md for developers
  - [ ] Environment variable configuration
  - [ ] Database initialization steps
  - [ ] Running seed data
  - [ ] Test database setup
  - [ ] Troubleshooting guide

- [ ] T039 Create TESTING.md guide
  - [ ] How to run unit tests
  - [ ] How to run integration tests
  - [ ] How to run performance tests
  - [ ] Test coverage reporting
  - [ ] Debugging failed tests

- [ ] T040 Create DEPLOYMENT.md guide
  - [ ] Database migration steps
  - [ ] Production RLS policy verification
  - [ ] Backup strategy
  - [ ] Rollback procedures
  - [ ] Monitoring checklist

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
