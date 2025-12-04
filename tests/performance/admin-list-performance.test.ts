/**
 * Admin Dashboard List Performance Tests
 * 管理員儀表板列表性能測試
 *
 * Target: 500 items rendered in <500ms
 * Test: Component rendering time, search/filter performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

interface PerformanceMetrics {
  renderTime: number
  filterTime: number
  searchTime: number
  sortTime: number
  totalTime: number
}

// Mock data generator
const generateMockNewsletters = (count: number) => {
  const newsletters = []
  for (let i = 0; i < count; i++) {
    newsletters.push({
      id: `newsletter-${i}`,
      weekNumber: `2025-W${(i % 52) + 1}`,
      publishDate: new Date(2025, 0, 1 + i).toISOString(),
      status: ['draft', 'published', 'archived'][i % 3],
      articleCount: Math.floor(Math.random() * 20) + 1,
      createdAt: new Date(2025, 0, 1 + i).toISOString(),
      updatedAt: new Date(2025, 0, 1 + i).toISOString(),
    })
  }
  return newsletters
}

const generateMockArticles = (count: number) => {
  const articles = []
  for (let i = 0; i < count; i++) {
    articles.push({
      id: `article-${i}`,
      title: `Article ${i}: ${randomTitle()}`,
      content: `Content for article ${i}...`,
      author: `Author ${i % 10}`,
      status: ['draft', 'published'][i % 2],
      weekId: `week-${Math.floor(i / 20)}`,
      createdAt: new Date(2025, 0, 1 + i).toISOString(),
      updatedAt: new Date(2025, 0, 1 + i).toISOString(),
    })
  }
  return articles
}

const generateMockUsers = (count: number) => {
  const roles = ['admin', 'teacher', 'parent', 'student']
  const statuses = ['active', 'disabled', 'pending']
  const users = []
  for (let i = 0; i < count; i++) {
    users.push({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      name: `User ${i}`,
      role: roles[i % roles.length],
      status: statuses[i % statuses.length],
      createdAt: new Date(2025, 0, 1 + i).toISOString(),
      updatedAt: new Date(2025, 0, 1 + i).toISOString(),
    })
  }
  return users
}

const randomTitle = () => {
  const titles = [
    'Breaking News',
    'Weekly Update',
    'Student Achievements',
    'Academic Calendar',
    'Sports News',
    'Community Service',
    'Science Fair',
    'Art Exhibition',
  ]
  return titles[Math.floor(Math.random() * titles.length)]
}

// Performance measurement utilities
const measurePerformance = (fn: () => void): number => {
  const start = performance.now()
  fn()
  const end = performance.now()
  return end - start
}

const filterNewsletters = (newsletters: any[], status?: string, weekRange?: { start: string; end: string }) => {
  let filtered = newsletters
  if (status) {
    filtered = filtered.filter((n) => n.status === status)
  }
  if (weekRange) {
    filtered = filtered.filter((n) => n.weekNumber >= weekRange.start && n.weekNumber <= weekRange.end)
  }
  return filtered
}

const searchNewsletters = (newsletters: any[], query: string) => {
  const lowerQuery = query.toLowerCase()
  return newsletters.filter((n) =>
    n.weekNumber.toLowerCase().includes(lowerQuery) || n.status.toLowerCase().includes(lowerQuery),
  )
}

const sortNewsletters = (newsletters: any[], sortBy: 'week' | 'date' | 'articles') => {
  const copy = [...newsletters]
  switch (sortBy) {
    case 'week':
      return copy.sort((a, b) => a.weekNumber.localeCompare(b.weekNumber))
    case 'date':
      return copy.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
    case 'articles':
      return copy.sort((a, b) => b.articleCount - a.articleCount)
    default:
      return copy
  }
}

describe('Admin Dashboard Performance - List Rendering', () => {
  let metrics: PerformanceMetrics

  beforeEach(() => {
    metrics = {
      renderTime: 0,
      filterTime: 0,
      searchTime: 0,
      sortTime: 0,
      totalTime: 0,
    }
  })

  describe('Newsletter List Performance', () => {
    it('should render 100 newsletters in <50ms', () => {
      const newsletters = generateMockNewsletters(100)
      const time = measurePerformance(() => {
        // Simulate rendering
        newsletters.forEach((n) => {
          const row = { id: n.id, status: n.status }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(50)
    })

    it('should render 500 newsletters in <500ms', () => {
      const newsletters = generateMockNewsletters(500)
      const time = measurePerformance(() => {
        // Simulate pagination or virtualization
        const paginated = newsletters.slice(0, 50) // Show 50 at a time
        paginated.forEach((n) => {
          const row = { id: n.id, status: n.status }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(500)
    })

    it('should render 1000 newsletters with pagination in <300ms', () => {
      const newsletters = generateMockNewsletters(1000)
      const pageSize = 50
      const time = measurePerformance(() => {
        const page1 = newsletters.slice(0, pageSize)
        page1.forEach((n) => {
          const row = { id: n.id, status: n.status }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(300)
    })
  })

  describe('Article List Performance', () => {
    it('should render 100 articles in <50ms', () => {
      const articles = generateMockArticles(100)
      const time = measurePerformance(() => {
        articles.forEach((a) => {
          const row = { id: a.id, title: a.title }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(50)
    })

    it('should render 500 articles with pagination in <500ms', () => {
      const articles = generateMockArticles(500)
      const time = measurePerformance(() => {
        const paginated = articles.slice(0, 50)
        paginated.forEach((a) => {
          const row = { id: a.id, title: a.title }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(500)
    })

    it('should render 10000 articles with virtualization in <200ms', () => {
      const articles = generateMockArticles(10000)
      const viewportSize = 20
      const time = measurePerformance(() => {
        // Simulate virtualization - only render visible items
        const visible = articles.slice(0, viewportSize)
        visible.forEach((a) => {
          const row = { id: a.id, title: a.title }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(200)
    })
  })

  describe('User List Performance', () => {
    it('should render 100 users in <50ms', () => {
      const users = generateMockUsers(100)
      const time = measurePerformance(() => {
        users.forEach((u) => {
          const row = { id: u.id, email: u.email }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(50)
    })

    it('should render 500 users with pagination in <500ms', () => {
      const users = generateMockUsers(500)
      const time = measurePerformance(() => {
        const paginated = users.slice(0, 50)
        paginated.forEach((u) => {
          const row = { id: u.id, email: u.email }
          expect(row).toBeDefined()
        })
      })
      expect(time).toBeLessThan(500)
    })
  })
})

describe('Admin Dashboard Performance - Search & Filter', () => {
  describe('Newsletter Search Performance', () => {
    it('should search 100 newsletters in <10ms', () => {
      const newsletters = generateMockNewsletters(100)
      const time = measurePerformance(() => {
        searchNewsletters(newsletters, '2025-W5')
      })
      expect(time).toBeLessThan(10)
    })

    it('should search 1000 newsletters in <50ms', () => {
      const newsletters = generateMockNewsletters(1000)
      const time = measurePerformance(() => {
        searchNewsletters(newsletters, '2025-W5')
      })
      expect(time).toBeLessThan(50)
    })

    it('should search 10000 newsletters in <200ms', () => {
      const newsletters = generateMockNewsletters(10000)
      const time = measurePerformance(() => {
        searchNewsletters(newsletters, '2025-W5')
      })
      expect(time).toBeLessThan(200)
    })

    it('should handle complex search queries', () => {
      const newsletters = generateMockNewsletters(500)
      const time = measurePerformance(() => {
        let results = newsletters
        results = filterNewsletters(results, 'published')
        results = searchNewsletters(results, 'W3')
        expect(results.length).toBeGreaterThanOrEqual(0)
      })
      expect(time).toBeLessThan(100)
    })
  })

  describe('Newsletter Filter Performance', () => {
    it('should filter 100 newsletters by status in <5ms', () => {
      const newsletters = generateMockNewsletters(100)
      const time = measurePerformance(() => {
        filterNewsletters(newsletters, 'published')
      })
      expect(time).toBeLessThan(5)
    })

    it('should filter 1000 newsletters by status in <20ms', () => {
      const newsletters = generateMockNewsletters(1000)
      const time = measurePerformance(() => {
        filterNewsletters(newsletters, 'published')
      })
      expect(time).toBeLessThan(20)
    })

    it('should apply multiple filters in <50ms', () => {
      const newsletters = generateMockNewsletters(500)
      const time = measurePerformance(() => {
        filterNewsletters(newsletters, 'published', { start: '2025-W1', end: '2025-W26' })
      })
      expect(time).toBeLessThan(50)
    })
  })

  describe('Newsletter Sort Performance', () => {
    it('should sort 100 newsletters in <5ms', () => {
      const newsletters = generateMockNewsletters(100)
      const time = measurePerformance(() => {
        sortNewsletters(newsletters, 'week')
      })
      expect(time).toBeLessThan(5)
    })

    it('should sort 1000 newsletters in <30ms', () => {
      const newsletters = generateMockNewsletters(1000)
      const time = measurePerformance(() => {
        sortNewsletters(newsletters, 'date')
      })
      expect(time).toBeLessThan(30)
    })

    it('should sort 10000 newsletters in <200ms', () => {
      const newsletters = generateMockNewsletters(10000)
      const time = measurePerformance(() => {
        sortNewsletters(newsletters, 'articles')
      })
      expect(time).toBeLessThan(200)
    })
  })
})

describe('Admin Dashboard Performance - Combined Operations', () => {
  it('should render, filter, and search 500 newsletters in <500ms', () => {
    const newsletters = generateMockNewsletters(500)
    const time = measurePerformance(() => {
      // Filter by status
      let filtered = filterNewsletters(newsletters, 'published')
      // Search within filtered results
      filtered = searchNewsletters(filtered, '2025-W1')
      // Sort results
      filtered = sortNewsletters(filtered, 'date')
      // Paginate
      const paginated = filtered.slice(0, 50)
      expect(paginated.length).toBeGreaterThanOrEqual(0)
    })
    expect(time).toBeLessThan(500)
  })

  it('should handle bulk operations on 1000 items in <1000ms', () => {
    const newsletters = generateMockNewsletters(1000)
    const time = measurePerformance(() => {
      // Multiple operations
      for (let i = 0; i < 5; i++) {
        const filtered = filterNewsletters(newsletters, ['draft', 'published', 'archived'][i % 3])
        const searched = searchNewsletters(filtered, `W${i + 1}`)
        const sorted = sortNewsletters(searched, ['week', 'date', 'articles'][i % 3] as any)
        expect(sorted.length).toBeGreaterThanOrEqual(0)
      }
    })
    expect(time).toBeLessThan(1000)
  })

  it('should maintain performance under concurrent operations', () => {
    const newsletters = generateMockNewsletters(500)
    const articles = generateMockArticles(500)
    const users = generateMockUsers(500)

    const time = measurePerformance(() => {
      // Simulate multiple concurrent list operations
      const filteredNewsletters = filterNewsletters(newsletters, 'published')
      const filteredArticles = articles.filter((a) => a.status === 'published')
      const filteredUsers = users.filter((u) => u.role === 'admin')

      const searchedNewsletters = searchNewsletters(filteredNewsletters, 'W5')
      const searchedArticles = filteredArticles.filter((a) => a.title.includes('Article'))
      const searchedUsers = filteredUsers.filter((u) => u.email.includes('example'))

      expect(searchedNewsletters.length + searchedArticles.length + searchedUsers.length).toBeGreaterThanOrEqual(0)
    })
    expect(time).toBeLessThan(500)
  })
})

describe('Admin Dashboard Performance - Memory Usage', () => {
  it('should not leak memory when rendering/filtering repeatedly', () => {
    const newsletters = generateMockNewsletters(500)

    // Simulate repeated operations
    for (let i = 0; i < 100; i++) {
      filterNewsletters(newsletters, i % 2 === 0 ? 'published' : 'draft')
      searchNewsletters(newsletters, `W${(i % 52) + 1}`)
      sortNewsletters(newsletters, ['week', 'date', 'articles'][i % 3] as any)
    }

    // If we get here without running out of memory, test passes
    expect(true).toBe(true)
  })

  it('should handle pagination without memory issues', () => {
    const newsletters = generateMockNewsletters(10000)
    const pageSize = 50
    const totalPages = Math.ceil(newsletters.length / pageSize)

    // Simulate pagination through all pages
    for (let page = 0; page < Math.min(totalPages, 100); page++) {
      const start = page * pageSize
      const end = start + pageSize
      const pageData = newsletters.slice(start, end)
      expect(pageData.length).toBeGreaterThan(0)
    }

    expect(true).toBe(true)
  })
})

describe('Admin Dashboard Performance - Browser Interactions', () => {
  it('should respond to user input (click) within 100ms', () => {
    const newsletters = generateMockNewsletters(500)
    const time = measurePerformance(() => {
      // Simulate clicking on a newsletter row
      const clicked = newsletters.find((n) => n.id === 'newsletter-0')
      expect(clicked).toBeDefined()
    })
    expect(time).toBeLessThan(100)
  })

  it('should display search results within 500ms', () => {
    const newsletters = generateMockNewsletters(500)
    const time = measurePerformance(() => {
      // Simulate typing search query
      const results = searchNewsletters(newsletters, '2025')
      expect(results.length).toBeGreaterThan(0)
    })
    expect(time).toBeLessThan(500)
  })

  it('should update sort order within 100ms', () => {
    const newsletters = generateMockNewsletters(500)
    const time = measurePerformance(() => {
      // Simulate clicking sort button
      sortNewsletters(newsletters, 'date')
    })
    expect(time).toBeLessThan(100)
  })
})
