# Quickstart: CMS Database Setup & Integration

**Feature**: 002-database-structure
**Target**: Developers implementing database schema and API contracts

---

## Overview

This guide covers:
1. Database schema initialization (PostgreSQL via Supabase)
2. Data access patterns and query examples
3. Integration with React frontend using Supabase client
4. Testing setup

---

## 1. Database Setup

### Local Development Setup (Recommended)

1.  **Install Supabase CLI**: If you haven't already, install the CLI:
    ```bash
    npm install -g supabase
    ```
2.  **Start Supabase**: From the root of the project, run:
    ```bash
    supabase start
    ```
3.  **Apply Migrations**: The database schema in `supabase/migrations` is applied automatically when you start the services. To reset the database and re-apply migrations, run `supabase db reset`.
4.  **Get Credentials**: The `supabase start` command will output the local URL and anon key. Use these to fill in your `.env.local` file.

---

## 2. Key Data Access Patterns

### Pattern A: Fetch Public Articles for a Week

**Use Case**: Visitor views newsletter for week 2025-W47

```typescript
import { createClient } from '@supabase/supabase-js'

// The client should be initialized once and imported from a shared module (e.g., src/lib/supabase.ts)
// It automatically uses the environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// Query: All public articles for a specific week
async function getPublicArticles(weekNumber: string) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('week_number', weekNumber)
    .eq('is_published', true)
    .eq('visibility_type', 'public')
    .is('deleted_at', null)
    .order('article_order', { ascending: true })

  if (error) throw error
  return data  // Array of Article objects
}
```

**Expected Response** (SC-001: <500ms):
```json
[
  {
    "id": "uuid-1",
    "week_number": "2025-W47",
    "title": "Weekly Announcement",
    "content": "# Welcome to Week 47...",
    "author": "Admin",
    "article_order": 1,
    "is_published": true,
    "visibility_type": "public",
    "restricted_to_classes": null,
    "created_at": "2025-11-16T10:00:00Z",
    "updated_at": "2025-11-16T10:00:00Z",
    "deleted_at": null
  },
  {
    "id": "uuid-2",
    "week_number": "2025-W47",
    "title": "Class Updates",
    "content": "...",
    "article_order": 2,
    ...
  }
]
```

---

### Pattern B: Fetch Articles for Parent with Multiple Children

**Use Case**: Parent with 2 children in Grade 1A and Grade 2A views their personalized newsletter

```typescript
// Step 1: Get parent's family and children's classes
async function getParentArticles(parentUserId: string, weekNumber: string) {
  // Get family enrollment
  const { data: familyData } = await supabase
    .from('family_enrollment')
    .select('family_id')
    .eq('parent_id', parentUserId)
    .single()

  const familyId = familyData?.family_id

  // Get all classes where family's children are enrolled
  const { data: enrollments } = await supabase
    .from('child_class_enrollment')
    .select('class_id, classes(class_grade_year)')
    .eq('family_id', familyId)
    .is('graduated_at', null)

  const classIds = enrollments?.map(e => e.class_id) || []
  const classGradeYears = enrollments?.map(e => e.classes?.class_grade_year) || []

  // Fetch articles: public + class-restricted for this family
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .eq('week_number', weekNumber)
    .eq('is_published', true)
    .is('deleted_at', null)
    .or(`visibility_type.eq.public,restricted_to_classes.cs.["${classIds.join('","')}"]`)

  // Sort by grade year (descending: older kids first), then article order
  const sorted = articles?.sort((a, b) => {
    // Find grade year for each article
    const aGradeYear = Math.max(...(a.restricted_to_classes || [])
      .map(cid => classGradeYears[classIds.indexOf(cid)] || 0))
    const bGradeYear = Math.max(...(b.restricted_to_classes || [])
      .map(cid => classGradeYears[classIds.indexOf(cid)] || 0))

    if (bGradeYear !== aGradeYear) return bGradeYear - aGradeYear
    return a.article_order - b.article_order
  })

  return sorted
}
```

**Expected Response**:
- All public articles (from all grades)
- Plus class-specific articles from each child's classes
- Sorted by grade year (highest first) + article order
- Example with 2 children (Grades 1 & 2):
  1. Grade 2A class article
  2. Grade 2A class article
  3. Grade 1A class article
  4. Public article
  5. Public article

---

### Pattern C: Fetch Article for Editing (Admin/Teacher)

**Use Case**: Teacher edits an article they created for their class

```typescript
async function getArticleForEditing(articleId: string, userId: string) {
  // Step 1: Fetch article
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .single()

  // Step 2: Verify permissions
  // User is admin OR creator OR assigned to the article's class
  const { data: teacher } = await supabase
    .from('teacher_class_assignment')
    .select('class_id')
    .eq('teacher_id', userId)

  // Check if user can edit (simplistic; real auth should be more robust)
  const isAdmin = /* check user role from auth context */
  const isCreator = article?.created_by === userId
  const isAssignedTeacher = teacher?.some(t =>
    article?.restricted_to_classes?.includes(t.class_id)
  ) || article?.visibility_type === 'public'

  if (!isAdmin && !isCreator && !isAssignedTeacher) {
    throw new Error('Permission denied')
  }

  return article
}
```

---

### Pattern D: Update Article (Publish/Unpublish)

**Use Case**: Editor publishes or unpublishes an article

```typescript
async function updateArticlePublicationStatus(
  articleId: string,
  isPublished: boolean,
  userId: string
) {
  const { data, error } = await supabase
    .from('articles')
    .update({
      is_published: isPublished,
      // updated_at auto-updated by trigger
    })
    .eq('id', articleId)
    .select()
    .single()

  if (error) throw error

  // Audit log is auto-created by trigger
  return data
}

// Archive/soft-delete
async function deleteArticle(articleId: string, userId: string) {
  const { data, error } = await supabase
    .from('articles')
    .update({
      deleted_at: new Date().toISOString(),
      is_published: false  // Also unpublish
    })
    .eq('id', articleId)
    .select()
    .single()

  return data
}
```

---

### Pattern E: Create New Article

**Use Case**: Teacher creates a new article for their class

```typescript
async function createArticle(
  weekNumber: string,
  title: string,
  content: string,
  articleOrder: number,
  visibilityType: 'public' | 'class_restricted',
  restrictedToClasses: string[] | null,
  userId: string  // current user
) {
  const { data, error } = await supabase
    .from('articles')
    .insert({
      week_number: weekNumber,
      title,
      content,
      article_order: articleOrder,
      visibility_type: visibilityType,
      restricted_to_classes: restrictedToClasses,
      is_published: false,  // Default to draft
      created_by: userId,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  // Audit log auto-created by trigger
  return data
}
```

---

### Pattern F: Reorder Articles Within a Week

**Use Case**: Editor drags articles to reorder them

```typescript
async function reorderArticles(
  weekNumber: string,
  reorderedArticles: { id: string; article_order: number }[]
) {
  // Batch update using transaction-like behavior
  const updates = reorderedArticles.map(({ id, article_order }) =>
    supabase
      .from('articles')
      .update({ article_order })
      .eq('id', id)
  )

  const results = await Promise.all(updates)

  // Check for errors
  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    throw new Error(`Reordering failed: ${errors.map(e => e.error.message).join(', ')}`)
  }

  return true
}
```

---

## 3. React Component Integration Example

```typescript
// components/WeeklyNewsletter.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase' // Assuming you have a shared client instance

interface Article {
  id: string
  title: string
  content: string
  article_order: number
}

export const WeeklyNewsletter: React.FC<{ weekNumber: string }> = ({
  weekNumber
}) => {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('week_number', weekNumber)
          .eq('is_published', true)
          .eq('visibility_type', 'public')
          .is('deleted_at', null)
          .order('article_order', { ascending: true })

        if (error) throw error
        setArticles(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch articles')
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [weekNumber])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="newsletter">
      <h1>Week {weekNumber}</h1>
      {articles.map(article => (
        <article key={article.id} className="article">
          <h2>{article.title}</h2>
          <div className="content">{/* Render markdown here */}</div>
        </article>
      ))}
    </div>
  )
}
```

---

## 4. Testing Setup

### Unit Test Example

Tests should run against the local Supabase instance.

```typescript
// tests/unit/articles.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('Articles API', () => {
  let supabase

  beforeEach(() => {
    // Connect to the local test database
    supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    )
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('articles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  it('should fetch public articles for a week', async () => {
    // Setup: Insert test article
    await supabase
      .from('articles')
      .insert({
        week_number: '2025-W47',
        title: 'Test Article',
        content: '# Test',
        article_order: 1,
        visibility_type: 'public',
        is_published: true
      })

    // Test
    const { data: articles } = await supabase
      .from('articles')
      .select('*')
      .eq('week_number', '2025-W47')
      .eq('is_published', true)

    // Assert
    expect(articles).toHaveLength(1)
    expect(articles[0].title).toBe('Test Article')
  })
})
```

---

## 5. Performance Validation (SC-001)

### Query Performance Checklist

- [ ] Fetch 100 articles for a week: <100ms
- [ ] Filter by publication status + visibility: <100ms
- [ ] Sort by order: <50ms
- [ ] Total cold start: <500ms
- [ ] Warm cache (subsequent query): <50ms

### Test with Sample Data

```sql
-- Insert 100 articles for a week
INSERT INTO articles (week_number, title, content, article_order, visibility_type, is_published)
SELECT
  '2025-W47',
  'Article ' || seq,
  'Content for article ' || seq,
  seq,
  CASE WHEN seq % 3 = 0 THEN 'class_restricted' ELSE 'public' END,
  CASE WHEN seq % 2 = 0 THEN true ELSE false END
FROM generate_series(1, 100) seq;

-- Benchmark query
EXPLAIN ANALYZE
SELECT * FROM articles
WHERE week_number = '2025-W47'
  AND is_published = true
  AND deleted_at IS NULL
  AND visibility_type = 'public'
ORDER BY article_order ASC;
```

---

## 6. Next Steps

1. **Create migrations**: Use Supabase's migration system or Liquibase
2. **Implement API endpoints**: POST/PUT/GET /api/articles, /api/newsletters
3. **Add authentication**: Integrate with Supabase Auth
4. **Build React components**: Weekly view, article editor, admin panel
5. **Run integration tests**: Verify full workflow end-to-end
6. **Deploy to staging**: Test with real data at scale

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [React Query for API integration](https://tanstack.com/query/latest)
- Feature Spec: [spec.md](./spec.md)
- Data Model: [data-model.md](./data-model.md)
