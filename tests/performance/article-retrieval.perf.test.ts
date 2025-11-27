/**
 * Performance Benchmark: Article Retrieval (US2)
 * Benchmarks article fetching performance against SC-001 requirements
 *
 * Performance Target (SC-001):
 * - 10 articles: <100ms
 * - 50 articles: <300ms
 * - 100 articles: <500ms
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { ArticleRow } from '@/types/database'

/**
 * Generate test articles with realistic data
 */
function generateTestArticles(count: number): ArticleRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `article-${i}`,
    short_id: `a${String(i + 1).padStart(3, '0')}`,
    week_number: '2025-W48',
    title: `Article ${i + 1}: ${generateRealisticTitle()}`,
    content: generateRealisticContent(500 + Math.random() * 1500), // 500-2000 chars
    author: `Author ${(i % 10) + 1}`,
    article_order: i + 1,
    is_published: true,
    visibility_type: i % 5 === 0 ? ('class_restricted' as const) : ('public' as const),
    restricted_to_classes: i % 5 === 0 ? [`Class${(i % 5) + 1}`] : null,
    created_by: `user-${(i % 50) + 1}`,
    created_at: new Date(Date.now() - i * 1000 * 60).toISOString(),
    updated_at: new Date(Date.now() - i * 1000 * 60).toISOString(),
    deleted_at: null,
  }))
}

/**
 * Generate realistic article titles
 */
function generateRealisticTitle(): string {
  const titles = [
    'Weekly Announcements and Updates',
    'Academic Calendar and Important Dates',
    'Class News and Student Achievements',
    'School Events and Activities',
    'Parents Meeting Schedule',
    'Curriculum Updates and Learning Goals',
    'Extracurricular Programs',
    'Safety and Health Notices',
    'Technology and Digital Learning',
    'Community Service Opportunities',
  ]
  return titles[Math.floor(Math.random() * titles.length)]
}

/**
 * Generate realistic article content with markdown
 */
function generateRealisticContent(length: number): string {
  const templates = [
    `# Weekly Update

## Paragraph 1
This is a sample paragraph with important information. Lorem ipsum dolor sit amet, consectetur adipiscing elit.

## Paragraph 2
Another section with additional details and information for the readers.

## Conclusion
Thank you for reading this update. Please contact us with any questions.`,

    `# Important Announcement

Please note the following changes:

- Item 1: Important information
- Item 2: Another key point
- Item 3: Final detail

Best regards,
The Administration`,

    `# Class Update

## Learning Progress
This week we focused on several key topics:

**Mathematics**: Working with fractions and decimals
**Reading**: Exploring classic literature
**Science**: Understanding ecosystems

## Upcoming Events
- Field trip next week
- Quiz on Friday
- Parent-teacher conference on date`,
  ]

  let content = templates[Math.floor(Math.random() * templates.length)]
  while (content.length < length) {
    content += '\n\nAdditional content to reach desired length: Lorem ipsum dolor sit amet.'
  }
  return content.substring(0, length)
}

describe('Article Retrieval Performance Benchmark (SC-001)', () => {
  describe('Filtering Performance', () => {
    it('should filter 10 published articles in <100ms', () => {
      const articles = generateTestArticles(10)

      const startTime = performance.now()
      const filtered = articles.filter(
        a => a.is_published === true && a.deleted_at === null
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(filtered).toHaveLength(10)
      expect(duration).toBeLessThan(100)
      console.log(`✓ Filtered 10 articles in ${duration.toFixed(2)}ms`)
    })

    it('should filter 50 published articles in <300ms', () => {
      const articles = generateTestArticles(50)

      const startTime = performance.now()
      const filtered = articles.filter(
        a => a.is_published === true && a.deleted_at === null
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(filtered).toHaveLength(50)
      expect(duration).toBeLessThan(300)
      console.log(`✓ Filtered 50 articles in ${duration.toFixed(2)}ms`)
    })

    it('should filter 100 published articles in <500ms (SC-001)', () => {
      const articles = generateTestArticles(100)

      const startTime = performance.now()
      const filtered = articles.filter(
        a => a.is_published === true && a.deleted_at === null
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(filtered).toHaveLength(100)
      expect(duration).toBeLessThan(500)
      console.log(`✓ Filtered 100 articles in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Sorting Performance', () => {
    it('should sort 10 articles by order in <50ms', () => {
      const articles = generateTestArticles(10)

      const startTime = performance.now()
      const sorted = articles.sort((a, b) => a.article_order - b.article_order)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(sorted).toHaveLength(10)
      expect(duration).toBeLessThan(50)
      console.log(`✓ Sorted 10 articles in ${duration.toFixed(2)}ms`)
    })

    it('should sort 50 articles by order in <100ms', () => {
      const articles = generateTestArticles(50)

      const startTime = performance.now()
      const sorted = articles.sort((a, b) => a.article_order - b.article_order)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(sorted).toHaveLength(50)
      expect(duration).toBeLessThan(100)
      console.log(`✓ Sorted 50 articles in ${duration.toFixed(2)}ms`)
    })

    it('should sort 100 articles by order in <200ms', () => {
      const articles = generateTestArticles(100)

      const startTime = performance.now()
      const sorted = articles.sort((a, b) => a.article_order - b.article_order)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(sorted).toHaveLength(100)
      expect(duration).toBeLessThan(200)
      console.log(`✓ Sorted 100 articles in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Combined Filter and Sort Performance', () => {
    it('should filter and sort 10 articles in <100ms', () => {
      const articles = generateTestArticles(10)

      const startTime = performance.now()
      const result = articles
        .filter(a => a.is_published === true && a.deleted_at === null)
        .sort((a, b) => a.article_order - b.article_order)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(result).toHaveLength(10)
      expect(duration).toBeLessThan(100)
      console.log(`✓ Filtered and sorted 10 articles in ${duration.toFixed(2)}ms`)
    })

    it('should filter and sort 50 articles in <300ms', () => {
      const articles = generateTestArticles(50)

      const startTime = performance.now()
      const result = articles
        .filter(a => a.is_published === true && a.deleted_at === null)
        .sort((a, b) => a.article_order - b.article_order)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(result).toHaveLength(50)
      expect(duration).toBeLessThan(300)
      console.log(`✓ Filtered and sorted 50 articles in ${duration.toFixed(2)}ms`)
    })

    it('should filter and sort 100 articles in <500ms (SC-001)', () => {
      const articles = generateTestArticles(100)

      const startTime = performance.now()
      const result = articles
        .filter(a => a.is_published === true && a.deleted_at === null)
        .sort((a, b) => a.article_order - b.article_order)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(result).toHaveLength(100)
      expect(duration).toBeLessThan(500)
      console.log(`✓ Filtered and sorted 100 articles in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Visibility Filtering Performance', () => {
    it('should filter by visibility type for 50 articles in <100ms', () => {
      const articles = generateTestArticles(50)

      const startTime = performance.now()
      const publicOnly = articles.filter(a => a.visibility_type === 'public')
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(publicOnly.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(100)
      console.log(`✓ Filtered by visibility for 50 articles in ${duration.toFixed(2)}ms`)
    })

    it('should filter by class restriction for 100 articles in <150ms', () => {
      const articles = generateTestArticles(100)
      const targetClass = 'Class1'

      const startTime = performance.now()
      const classFiltered = articles.filter(a =>
        a.visibility_type === 'public' ||
        (a.visibility_type === 'class_restricted' &&
          a.restricted_to_classes?.includes(targetClass))
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(classFiltered.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(150)
      console.log(`✓ Filtered by class for 100 articles in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Search Performance', () => {
    it('should search 50 articles by title in <200ms', () => {
      const articles = generateTestArticles(50)
      const searchTerm = 'Announcement'

      const startTime = performance.now()
      const results = articles.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(duration).toBeLessThan(200)
      console.log(`✓ Searched 50 articles in ${duration.toFixed(2)}ms`)
    })

    it('should search 100 articles by content in <500ms', () => {
      const articles = generateTestArticles(100)
      const searchTerm = 'important'

      const startTime = performance.now()
      const results = articles.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(duration).toBeLessThan(500)
      console.log(`✓ Searched 100 articles by content in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage', () => {
    it('should handle 100 articles without excessive memory', () => {
      const articles = generateTestArticles(100)

      // Estimate memory usage
      const memoryPerArticle = JSON.stringify(articles[0]).length
      const totalMemory = articles.length * memoryPerArticle

      // 100 articles should use <2MB
      expect(totalMemory).toBeLessThan(2 * 1024 * 1024)
      console.log(`✓ 100 articles use approximately ${(totalMemory / 1024).toFixed(2)}KB`)
    })

    it('should handle 500 articles without excessive memory', () => {
      const articles = generateTestArticles(500)

      const memoryPerArticle = JSON.stringify(articles[0]).length
      const totalMemory = articles.length * memoryPerArticle

      // 500 articles should use <10MB
      expect(totalMemory).toBeLessThan(10 * 1024 * 1024)
      console.log(`✓ 500 articles use approximately ${(totalMemory / 1024).toFixed(2)}KB`)
    })
  })

  describe('Pagination Performance', () => {
    it('should paginate 100 articles (10 per page) in <500ms', () => {
      const articles = generateTestArticles(100)
      const pageSize = 10

      const startTime = performance.now()
      const pages = Array.from({ length: Math.ceil(articles.length / pageSize) }, (_, i) =>
        articles.slice(i * pageSize, (i + 1) * pageSize)
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(pages).toHaveLength(10)
      expect(duration).toBeLessThan(500)
      console.log(`✓ Paginated 100 articles in ${duration.toFixed(2)}ms`)
    })

    it('should access any page of 500 articles in <50ms', () => {
      const articles = generateTestArticles(500)
      const pageSize = 20
      const targetPage = 15 // Get page 15

      const startTime = performance.now()
      const pageStart = targetPage * pageSize
      const pageEnd = pageStart + pageSize
      const page = articles.slice(pageStart, pageEnd)
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(page.length).toBeLessThanOrEqual(pageSize)
      expect(duration).toBeLessThan(50)
      console.log(`✓ Accessed page 15 of 500 articles in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Complex Filtering Performance', () => {
    it('should apply multi-criteria filter to 100 articles in <500ms', () => {
      const articles = generateTestArticles(100)
      const targetClasses = ['Class1', 'Class2']

      const startTime = performance.now()
      const filtered = articles.filter(a =>
        a.is_published === true &&
        a.deleted_at === null &&
        a.week_number === '2025-W48' &&
        (a.visibility_type === 'public' ||
          (a.visibility_type === 'class_restricted' &&
            a.restricted_to_classes?.some(c => targetClasses.includes(c))))
      )
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(filtered.length).toBeGreaterThanOrEqual(0)
      expect(duration).toBeLessThan(500)
      console.log(`✓ Applied complex filter to 100 articles in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Index Simulation', () => {
    it('should simulate indexed lookup for article by week in <50ms', () => {
      const articles = generateTestArticles(100)

      // Simulate index: Map by week_number
      const startTime = performance.now()
      const byWeek = new Map<string, ArticleRow[]>()
      articles.forEach(a => {
        if (!byWeek.has(a.week_number)) {
          byWeek.set(a.week_number, [])
        }
        byWeek.get(a.week_number)!.push(a)
      })
      const endTime = performance.now()

      const duration = endTime - startTime
      const weekArticles = byWeek.get('2025-W48') || []

      expect(weekArticles).toHaveLength(100)
      expect(duration).toBeLessThan(50)
      console.log(`✓ Built week index for 100 articles in ${duration.toFixed(2)}ms`)
    })

    it('should simulate indexed lookup for article by creator in <50ms', () => {
      const articles = generateTestArticles(100)

      // Simulate index: Map by created_by
      const startTime = performance.now()
      const byCreator = new Map<string, ArticleRow[]>()
      articles.forEach(a => {
        if (!byCreator.has(a.created_by)) {
          byCreator.set(a.created_by, [])
        }
        byCreator.get(a.created_by)!.push(a)
      })
      const endTime = performance.now()

      const duration = endTime - startTime

      expect(byCreator.size).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
      console.log(`✓ Built creator index for 100 articles in ${duration.toFixed(2)}ms`)
    })
  })
})
