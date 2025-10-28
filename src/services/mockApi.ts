/**
 * 模擬 API 服務 - 開發用
 * 提供電子報資料的模擬實現
 */

import { NewsletterWeek, Article } from '@/types'

// 模擬文章資料
const mockArticles: Record<string, Article> = {
  'article-001': {
    id: 'article-001',
    title: '如何優化 React 應用的效能',
    content: `# 如何優化 React 應用的效能

React 應用的效能優化是一個重要的話題。本文將探討幾個關鍵的最佳實踐。

## 1. 使用 React.memo

React.memo 可以幫助你避免不必要的重新渲染。

\`\`\`jsx
const MyComponent = React.memo(({ data }) => {
  return <div>{data}</div>
})
\`\`\`

## 2. 使用 useMemo 和 useCallback

這兩個 Hook 可以幫助你記憶化計算和函式。

## 3. 代碼分割

使用動態導入來分割你的代碼包。

---

希望這些建議對你有幫助！`,
    author: '李明',
    summary: '探討 React 應用效能優化的最佳實踐',
    weekNumber: '2025-W43',
    order: 1,
    slug: 'react-performance-optimization',
    publicUrl: '/article/article-001',
    createdAt: '2025-10-20T10:00:00Z',
    updatedAt: '2025-10-20T10:00:00Z',
    isPublished: true,
    viewCount: 1250,
  },
  'article-002': {
    id: 'article-002',
    title: 'TypeScript 中的高級型別技巧',
    content: `# TypeScript 中的高級型別技巧

TypeScript 提供了許多強大的型別系統功能。

## 條件型別

\`\`\`typescript
type IsString<T> = T extends string ? true : false
\`\`\`

## 映射型別

映射型別允許你基於現有型別創建新型別。

## 工具型別

TypeScript 提供了許多內置的工具型別，如 Partial、Pick、Omit 等。`,
    author: '王芳',
    summary: '深入了解 TypeScript 高級型別系統',
    weekNumber: '2025-W43',
    order: 2,
    slug: 'typescript-advanced-types',
    publicUrl: '/article/article-002',
    createdAt: '2025-10-21T10:00:00Z',
    updatedAt: '2025-10-21T10:00:00Z',
    isPublished: true,
    viewCount: 980,
  },
  'article-003': {
    id: 'article-003',
    title: 'Web 安全基礎知識',
    content: `# Web 安全基礎知識

保護 Web 應用安全是每個開發者的責任。

## HTTPS

始終使用 HTTPS 來保護資料傳輸。

## 內容安全策略 (CSP)

CSP 可以幫助防止 XSS 攻擊。

## CSRF 防護

使用令牌來防止跨站請求偽造。`,
    author: '張偉',
    summary: '了解基本的 Web 安全防護措施',
    weekNumber: '2025-W43',
    order: 3,
    slug: 'web-security-basics',
    publicUrl: '/article/article-003',
    createdAt: '2025-10-22T10:00:00Z',
    updatedAt: '2025-10-22T10:00:00Z',
    isPublished: true,
    viewCount: 654,
  },
}

// 模擬週報資料
const mockNewsletters: Record<string, NewsletterWeek> = {
  '2025-W43': {
    weekNumber: '2025-W43',
    releaseDate: '2025-10-23T00:00:00Z',
    title: '第 43 週電子報',
    articleIds: ['article-001', 'article-002', 'article-003'],
    createdAt: '2025-10-20T00:00:00Z',
    updatedAt: '2025-10-20T00:00:00Z',
    isPublished: true,
    totalArticles: 3,
  },
}

/**
 * 取得所有週報清單
 */
export async function fetchNewsletterList(): Promise<NewsletterWeek[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Object.values(mockNewsletters))
    }, 300)
  })
}

/**
 * 取得特定週報資訊
 */
export async function fetchNewsletter(weekNumber: string): Promise<NewsletterWeek | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockNewsletters[weekNumber] || null)
    }, 300)
  })
}

/**
 * 取得特定文章
 */
export async function fetchArticle(articleId: string): Promise<Article | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockArticles[articleId] || null)
    }, 300)
  })
}

/**
 * 取得該週的所有文章
 */
export async function fetchArticlesForWeek(weekNumber: string): Promise<Article[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newsletter = mockNewsletters[weekNumber]
      if (!newsletter) {
        resolve([])
        return
      }

      const articles = newsletter.articleIds
        .map((id) => mockArticles[id])
        .filter((article): article is Article => article !== undefined)

      resolve(articles)
    }, 300)
  })
}

/**
 * 取得下一篇文章 ID
 */
export async function fetchNextArticleId(
  weekNumber: string,
  currentOrder: number
): Promise<string | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newsletter = mockNewsletters[weekNumber]
      if (!newsletter || currentOrder >= newsletter.totalArticles) {
        resolve(null)
        return
      }

      const nextArticleId = newsletter.articleIds[currentOrder] || null
      resolve(nextArticleId)
    }, 300)
  })
}

/**
 * 取得上一篇文章 ID
 */
export async function fetchPreviousArticleId(
  weekNumber: string,
  currentOrder: number
): Promise<string | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newsletter = mockNewsletters[weekNumber]
      if (!newsletter || currentOrder <= 1) {
        resolve(null)
        return
      }

      const previousArticleId = newsletter.articleIds[currentOrder - 2] || null
      resolve(previousArticleId)
    }, 300)
  })
}

/**
 * 更新文章
 */
export async function updateArticle(articleId: string, updates: Partial<Article>): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (mockArticles[articleId]) {
        mockArticles[articleId] = {
          ...mockArticles[articleId],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
        resolve(true)
      } else {
        resolve(false)
      }
    }, 300)
  })
}

/**
 * 重新排序文章
 */
export async function reorderArticles(
  weekNumber: string,
  articleIds: string[]
): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newsletter = mockNewsletters[weekNumber]
      if (newsletter) {
        newsletter.articleIds = articleIds
        newsletter.updatedAt = new Date().toISOString()
        resolve(true)
      } else {
        resolve(false)
      }
    }, 300)
  })
}
