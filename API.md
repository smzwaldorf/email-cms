# API 文檔

電子報閱讀 CMS 應用的完整 API 文檔。本應用當前使用模擬 API (`mockApi.ts`)，實際生產環境應與真實後端 API 集成。

## 📋 目錄

- [概述](#概述)
- [認證](#認證)
- [端點](#端點)
  - [週報](#週報)
  - [文章](#文章)
  - [編輯](#編輯)
- [錯誤處理](#錯誤處理)
- [示例](#示例)

## 概述

### 基本信息

- **基本 URL**: `https://api.example.com/v1`（生產環境）
- **版本**: 1.0
- **數據格式**: JSON
- **內容類型**: `application/json`

### 當前實現

當前版本使用 `src/services/mockApi.ts` 中的模擬 API：

```typescript
// 模擬 API 導入
import {
  fetchWeeklyNewsletter,
  fetchArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  reorderArticles,
} from '@/services/mockApi'
```

### 遷移說明

當實際後端就緒時，將 `mockApi.ts` 中的函數替換為真實的 HTTP 調用：

```typescript
// 示例：遷移 fetchWeeklyNewsletter
// 從：
export function fetchWeeklyNewsletter(weekNumber: string): Promise<NewsletterWeek> {
  return Promise.resolve(mockNewsletters.find(...))
}

// 到：
export function fetchWeeklyNewsletter(weekNumber: string): Promise<NewsletterWeek> {
  return fetch(`${API_BASE_URL}/newsletters/${weekNumber}`)
    .then(res => res.json())
}
```

## 認證

### 預計認證方式

生產 API 應支持以下認證方式：

#### 1. Bearer Token（推薦）

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.example.com/v1/newsletters/2025-W43
```

#### 2. API Key

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
     https://api.example.com/v1/newsletters/2025-W43
```

#### 3. OAuth 2.0

```bash
# 獲取 Token
POST /oauth/token
{
  "grant_type": "client_credentials",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}

# 使用 Token
Authorization: Bearer <access_token>
```

## 端點

### 週報

#### 獲取週報

**請求**
```http
GET /newsletters/:weekNumber
```

**參數**
```typescript
interface GetWeeklyNewsletterParams {
  weekNumber: string  // 格式：'2025-W43'
}
```

**成功響應** (200 OK)
```json
{
  "weekNumber": "2025-W43",
  "releaseDate": "2025-11-16",
  "title": "Week 43",
  "articleIds": ["article-001", "article-002"],
  "createdAt": "2025-11-16T00:00:00Z",
  "updatedAt": "2025-11-16T00:00:00Z",
  "isPublished": true,
  "totalArticles": 2,
  "articles": [
    {
      "id": "article-001",
      "title": "Article Title",
      "content": "# Markdown content",
      "author": "Author Name",
      "summary": "Article summary",
      "weekNumber": "2025-W43",
      "order": 1,
      "slug": "article-slug",
      "publicUrl": "/article/article-001",
      "createdAt": "2025-11-16T00:00:00Z",
      "updatedAt": "2025-11-16T00:00:00Z",
      "isPublished": true
    }
  ]
}
```

#### 當前實現
```typescript
export function fetchWeeklyNewsletter(weekNumber: string): Promise<NewsletterWeek> {
  // 返回給定週份的完整週報數據
}
```

### 文章

#### 獲取單篇文章

**請求**
```http
GET /articles/:articleId
```

**參數**
```typescript
interface GetArticleParams {
  articleId: string  // 文章 ID
}
```

**成功響應** (200 OK)
```json
{
  "id": "article-001",
  "title": "Article Title",
  "content": "# Full Markdown content...",
  "author": "Author Name",
  "summary": "Summary text",
  "weekNumber": "2025-W43",
  "order": 1,
  "slug": "article-slug",
  "publicUrl": "/article/article-001",
  "createdAt": "2025-11-16T00:00:00Z",
  "updatedAt": "2025-11-16T00:00:00Z",
  "isPublished": true
}
```

#### 獲取下一篇文章 ID

**請求**
```http
GET /articles/:articleId/next?weekNumber=2025-W43
```

**成功響應** (200 OK)
```json
{
  "nextArticleId": "article-002"
}
```

#### 當前實現
```typescript
export function fetchArticle(articleId: string): Promise<Article> {
  // 返回指定的文章
}

export function fetchNextArticleId(
  weekNumber: string,
  currentArticleId: string
): Promise<string | null> {
  // 返回下一篇文章的 ID
}

export function fetchPreviousArticleId(
  weekNumber: string,
  currentArticleId: string
): Promise<string | null> {
  // 返回上一篇文章的 ID
}
```

### 編輯

#### 創建文章

**請求**
```http
POST /articles
Content-Type: application/json

{
  "title": "New Article",
  "content": "# Content...",
  "author": "Author Name",
  "summary": "Summary",
  "weekNumber": "2025-W43"
}
```

**成功響應** (201 Created)
```json
{
  "id": "article-new",
  "title": "New Article",
  "content": "# Content...",
  "author": "Author Name",
  "summary": "Summary",
  "weekNumber": "2025-W43",
  "order": 3,
  "slug": "new-article",
  "publicUrl": "/article/article-new",
  "createdAt": "2025-11-16T10:00:00Z",
  "updatedAt": "2025-11-16T10:00:00Z",
  "isPublished": true
}
```

#### 更新文章

**請求**
```http
PATCH /articles/:articleId
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "# Updated content..."
}
```

**成功響應** (200 OK)
```json
{
  "id": "article-001",
  "title": "Updated Title",
  // ... 其他字段
}
```

#### 刪除文章

**請求**
```http
DELETE /articles/:articleId?weekNumber=2025-W43
```

**成功響應** (204 No Content)

#### 重新排列文章

**請求**
```http
POST /articles/reorder
Content-Type: application/json

{
  "weekNumber": "2025-W43",
  "articleOrder": ["article-002", "article-001", "article-003"]
}
```

**成功響應** (200 OK)
```json
{
  "success": true,
  "message": "Articles reordered successfully"
}
```

#### 當前實現
```typescript
export function createArticle(
  weekNumber: string,
  article: Omit<Article, 'id' | 'slug' | 'createdAt' | 'updatedAt'>
): Promise<Article> {
  // 創建新文章
}

export function updateArticle(
  weekNumber: string,
  articleId: string,
  updates: Partial<Article>
): Promise<Article> {
  // 更新文章
}

export function deleteArticle(
  weekNumber: string,
  articleId: string
): Promise<void> {
  // 刪除文章
}

export function reorderArticles(
  weekNumber: string,
  newOrder: string[]
): Promise<boolean> {
  // 重新排列文章
}
```

## 錯誤處理

### 錯誤響應格式

```json
{
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "Article with ID 'article-999' not found",
    "details": {
      "articleId": "article-999"
    }
  }
}
```

### 常見錯誤碼

| 代碼 | HTTP 狀態 | 描述 |
|------|---------|------|
| `ARTICLE_NOT_FOUND` | 404 | 文章不存在 |
| `WEEK_NOT_FOUND` | 404 | 週份不存在 |
| `INVALID_REQUEST` | 400 | 請求參數無效 |
| `UNAUTHORIZED` | 401 | 未授權 |
| `FORBIDDEN` | 403 | 禁止訪問 |
| `INTERNAL_ERROR` | 500 | 服務器內部錯誤 |

### 當前錯誤處理

```typescript
// src/services/errorReporting.ts - 全局錯誤報告
export class ErrorReportingService {
  logError(message: string, options?: ErrorOptions): ErrorLog
  captureException(error: Error, context?: Record<string, unknown>): ErrorLog
  calculateDirectLinkSuccessRate(): number
}
```

## 示例

### JavaScript/TypeScript

```typescript
import { fetchWeeklyNewsletter, fetchArticle } from '@/services/mockApi'

// 獲取週報
const weeklyData = await fetchWeeklyNewsletter('2025-W43')
console.log(`本週共有 ${weeklyData.totalArticles} 篇文章`)

// 獲取第一篇文章
const firstArticle = await fetchArticle(weeklyData.articles[0].id)
console.log(`文章標題: ${firstArticle.title}`)
console.log(`作者: ${firstArticle.author}`)
```

### cURL

```bash
# 獲取週報
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.example.com/v1/newsletters/2025-W43

# 創建文章
curl -X POST https://api.example.com/v1/articles \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "New Article",
       "content": "# Content",
       "author": "Author",
       "summary": "Summary",
       "weekNumber": "2025-W43"
     }'

# 更新文章
curl -X PATCH https://api.example.com/v1/articles/article-001 \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Updated Title"
     }'

# 刪除文章
curl -X DELETE https://api.example.com/v1/articles/article-001 \
     -H "Authorization: Bearer YOUR_TOKEN"

# 重新排列文章
curl -X POST https://api.example.com/v1/articles/reorder \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "weekNumber": "2025-W43",
       "articleOrder": ["article-002", "article-001"]
     }'
```

## 版本控制和兼容性

### 當前版本：1.0.0

- 支持週報查看（US1, US2）
- 支持快速導航（US3）
- 支持內容管理（US4）

### 計劃升級

- **v1.1.0**: 評論系統
- **v1.2.0**: 收藏和分享功能
- **v2.0.0**: 高級編輯功能

## 速率限制（生產環境推薦）

```
Rate-Limit-Limit: 1000
Rate-Limit-Remaining: 999
Rate-Limit-Reset: 1637002800
```

- **默認限制**: 每分鐘 1000 次請求
- **超限響應**: 429 Too Many Requests

## 更新日誌

### 2025-11-16

- 初始 API 文檔發佈
- 支持模擬 API 實現
- 文檔化所有主要端點
- 添加生產環境遷移指南

## 反饋和支持

有 API 問題或建議？請：
- 提交 GitHub Issue
- 聯繫 API 支持團隊
- 發送郵件至 api-support@example.com
