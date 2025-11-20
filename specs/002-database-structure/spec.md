# Feature Specification: CMS Database Structure

**Feature Branch**: `002-database-structure`
**Created**: 2025-11-16
**Status**: Draft
**Input**: User description: Setup database structure for CMS with article storage, editing, and role-based visibility

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editor Publishes Weekly Articles (Priority: P1)

An editor creates and publishes a weekly newsletter with multiple articles organized in a specific order. Each week contains articles that are displayed to visitors in the editor-specified sequence. The editor can rearrange articles and adjust their publication status.

**Why this priority**: This is the core CMS functionality - without the ability to store and organize articles by week, the system cannot function as a newsletter viewer.

**Independent Test**: Verify that articles can be created for a specific week, stored with order information, and retrieved in the correct sequence.

**Acceptance Scenarios**:

1. **Given** a new week (e.g., "2025-W47") with no articles, **When** an editor creates two articles with order 1 and 2, **Then** both articles are stored and can be retrieved in sequence (1st, then 2nd).
2. **Given** a week with existing articles in order (1, 2, 3), **When** the editor changes article order to (2, 3, 1), **Then** the articles are reordered and retrieved in the new sequence.
3. **Given** a week with published articles, **When** the editor marks one article as draft/unpublished, **Then** that article is not visible to visitors but remains in the database for editing.

---

### User Story 2 - Visitor Views Published Articles (Priority: P1)

A visitor accesses the newsletter and views articles from a specific week. All published articles are displayed in the correct order without requiring authentication. The system retrieves only articles marked as published.

**Why this priority**: This is the primary user-facing functionality - visitors must be able to access and read the newsletter content.

**Independent Test**: Verify that unauthenticated visitors can retrieve and view all published articles for a given week in the correct order.

**Acceptance Scenarios**:

1. **Given** a week with 3 published articles, **When** a visitor requests the week's content, **Then** all 3 articles are returned in the specified order.
2. **Given** a week with 2 published articles and 1 unpublished article, **When** a visitor requests the week's content, **Then** only the 2 published articles are returned.
3. **Given** an article from a past week, **When** a visitor requests that week's content, **Then** the article is returned with all its content intact.

---

### User Story 3 - Role-Based Article Visibility by Class (Priority: P2)

Certain articles (班級大小事 - class updates) are visible only to users enrolled in specific classes. Teachers can see articles for all their assigned classes. Parents can see articles for classes where their children are enrolled. The system dynamically filters articles based on the authenticated user's class enrollment.

**Why this priority**: While role-based filtering is important for sensitive class-specific content, it depends on authentication and class enrollment implementation (planned later), so it's secondary to core CMS functionality.

**Independent Test**: Verify that articles marked with class-specific visibility are correctly filtered when class enrollment information is provided, and visible to all when no class context is provided.

**Acceptance Scenarios**:

1. **Given** an article marked for "Class A" only, **When** the system queries with no class context, **Then** the article is not returned (public query only shows articles without class restrictions).
2. **Given** a mixed set of public articles and class-restricted articles in a week, **When** queried by a user enrolled in the restricted class, **Then** all public articles plus the class-specific articles are returned.
3. **Given** an article restricted to "Class B", **When** queried by a user enrolled only in "Class A", **Then** the article is not returned.

---

### User Story 4 - Editor Updates Existing Articles (Priority: P1)

An editor can modify article content (title, body) after publication. Changes are persisted and reflected for future viewers. The system tracks which editor made changes and when.

**Why this priority**: Editorial updates are essential for maintaining content quality and correcting errors in published material.

**Independent Test**: Verify that article content can be modified, persisted, and the updated version is retrieved for subsequent requests.

**Acceptance Scenarios**:

1. **Given** a published article, **When** an editor updates the title and content, **Then** the new version is stored and future retrievals show the updated content.
2. **Given** an article with creation metadata, **When** the article is updated, **Then** the update timestamp is recorded while creation metadata is preserved.

---

### Edge Cases

- What happens when an article is requested from a week that doesn't exist in the database?
- How does the system handle duplicate article orders within the same week (e.g., two articles both marked as order 1)?
- What occurs if the total number of articles for a week exceeds a reasonable limit (e.g., 100+ articles)?
- How should the system respond if an article's content is empty or null?
- What happens when an editor updates article order while another editor is viewing the same week?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store articles with the following core attributes: title, content (markdown), author, week identifier, article order, and publication status.
- **FR-002**: System MUST support organizing articles by week using a standardized week identifier format (e.g., "2025-W47").
- **FR-003**: System MUST allow editors to set and modify the display order of articles within a week using numeric ordering (adjustable after creation).
- **FR-004**: System MUST retrieve all articles for a specific week with their content intact and in the correct order.
- **FR-005**: System MUST provide a query mechanism to retrieve only published articles for public visitor access.
- **FR-006**: System MUST support marking articles as published or draft, affecting visibility to visitors.
- **FR-007**: System MUST store class-based access control information for articles that have restricted visibility (for 班級大小事 category), maintaining a list of eligible classes for each restricted article and queryable by class identifier.
- **FR-008**: System MUST track article metadata including: creation date, modification date, and creator identifier.
- **FR-009**: System MUST allow editors to update existing articles (title, content, publication status, order, role restrictions).
- **FR-010**: System MUST provide soft-delete functionality (archive/unpublish) without removing data from database for audit purposes.
- **FR-011**: System MUST support efficient queries to retrieve articles by week and publication status.
- **FR-012**: System MUST support creating new weeks with automatic initialization of metadata (e.g., creation date).

### Key Entities *(include if feature involves data)*

- **Week/Newsletter**: Represents a weekly newsletter container with metadata (week number in ISO format "YYYY-Www", release date, publication status, creation metadata).
- **Article**: Individual article content with metadata (unique ID, title, markdown content, author, week reference, display order, publication status, class-based access flags, creation/modification timestamps).
- **Class-Based Access Control**: Metadata attached to articles for 班級大小事 type content (list of class identifiers with access, whether article is public or class-restricted).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All published articles for a given week can be retrieved in under 500ms, regardless of article count (up to 100 articles).
- **SC-002**: Article order updates are reflected immediately in subsequent queries with 100% consistency.
- **SC-003**: Unpublished/draft articles are completely excluded from public visitor queries (0% false positives).
- **SC-004**: Editors can create, update, and reorder articles for a week without errors in a single editing session.
- **SC-005**: Class-based visibility filters work correctly for 班級大小事 articles, showing appropriate content only to users enrolled in eligible classes (100% accuracy in inclusion/exclusion).
- **SC-006**: The database structure supports at least 2 years of weekly newsletters (104+ weeks) without performance degradation.
- **SC-007**: All article data persists across application restarts and maintains referential integrity.

## Assumptions

- **Authentication**: The system does not require authentication for visitors to access published articles. Class-based filtering for 班級大小事 articles will be implemented in a future phase when user authentication is added.
- **Class Enrollment Data**: Class membership data (which users belong to which classes) is managed externally; this database stores only the article-to-class associations.
- **Week Format**: Weeks follow ISO 8601 format ("2025-W47") for consistency and international standards compliance.
- **Article Content**: Articles are stored as Markdown format (supporting future rich content rendering without database changes).
- **Order Integrity**: Article order is numeric and contiguous within a week (1, 2, 3...) but gaps are allowed if articles are deleted.
- **Metadata Tracking**: Creation/modification dates are automatically managed by the system; editors do not manually set these values.
- **Data Retention**: Archived/unpublished articles are retained indefinitely for audit purposes (no automatic deletion).
- **Concurrent Editing**: The system supports basic concurrent editing without advanced locking; last-write-wins for conflicting edits.

## Dependencies

- Database system that supports relational data structure with proper indexing capabilities.
- Timestamp management for automatic creation/modification tracking.
- No external authentication system required for this phase (visitor access is public).
