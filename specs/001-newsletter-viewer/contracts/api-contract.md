# API 契約：電子報閱讀 Web App

**功能**: 001-newsletter-viewer
**日期**: 2025-10-28
**格式**: REST JSON API
**版本**: v1

## 概述

此文件定義前端與後端之間的 API 契約。前端使用這些端點存取週報資料、文章內容和執行編輯操作。

---

## 基本資訊

**基礎 URL**: `https://api.example.com/api/v1`

**驗證**:
- 讀者：無驗證
- 編輯者：Bearer Token (JWT 或 Session)

**內容類型**: `application/json`

**錯誤格式**:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "人類可讀的錯誤信息"
  }
}
```

---

## 端點

### 1. 獲取週報清單

**用途**: 列出所有週報（首頁、週份選擇器）

**端點**:
```
GET /newsletters
```

**查詢參數**:
| 參數 | 類型 | 說明 |
|------|------|------|
| `limit` | int | 返回的最大週數（預設 10） |
| `offset` | int | 分頁偏移（預設 0） |
| `sort` | string | 排序方向 "asc" 或 "desc"（預設 "desc"） |

**成功回應 (200)**:
```json
{
  "data": [
    {
      "weekNumber": "2025-W42",
      "releaseDate": "2025-10-27",
      "title": "第 42 週電子報",
      "totalArticles": 10,
      "isPublished": true
    },
    {
      "weekNumber": "2025-W41",
      "releaseDate": "2025-10-20",
      "title": "第 41 週電子報",
      "totalArticles": 8,
      "isPublished": true
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0
  }
}
```

**錯誤回應 (500)**:
```json
{
  "error": {
    "code": "SERVER_ERROR",
    "message": "無法載入週報清單"
  }
}
```

---

### 2. 獲取週報詳細資訊

**用途**: 取得特定週份的所有文章清單和元數據

**端點**:
```
GET /newsletters/{weekNumber}
```

**路徑參數**:
| 參數 | 格式 | 說明 |
|------|------|------|
| `weekNumber` | YYYY-W## | ISO 8601 周格式，例如 "2025-W42" |

**成功回應 (200)**:
```json
{
  "data": {
    "weekNumber": "2025-W42",
    "releaseDate": "2025-10-27",
    "title": "第 42 週電子報",
    "isPublished": true,
    "createdAt": "2025-10-20T10:00:00Z",
    "updatedAt": "2025-10-27T09:00:00Z",
    "articles": [
      {
        "id": "article-001",
        "order": 1,
        "title": "AI 新聞速遞",
        "summary": "本週 AI 領域重點新聞",
        "author": "編輯部",
        "publicUrl": "/newsletter/2025-w42/article/article-001"
      },
      {
        "id": "article-002",
        "order": 2,
        "title": "科技趨勢分析",
        "summary": "2025 年科技發展預測",
        "author": "分析師",
        "publicUrl": "/newsletter/2025-w42/article/article-002"
      }
      // ... 更多文章
    ]
  }
}
```

**錯誤回應 (404)**:
```json
{
  "error": {
    "code": "WEEK_NOT_FOUND",
    "message": "週份 2025-W99 不存在"
  }
}
```

---

### 3. 獲取單篇文章內容

**用途**: 取得文章的完整內容（用於讀者閱讀）

**端點**:
```
GET /articles/{articleId}
```

**路徑參數**:
| 參數 | 格式 | 說明 |
|------|------|------|
| `articleId` | string | 文章的唯一識別符 |

**成功回應 (200)**:
```json
{
  "data": {
    "id": "article-001",
    "weekNumber": "2025-W42",
    "title": "AI 新聞速遞",
    "author": "編輯部",
    "content": "# AI 新聞速遞\n\nOpenAI 發佈最新版本...\n\n## 主要亮點\n\n- 功能 1\n- 功能 2",
    "order": 1,
    "totalInWeek": 10,
    "publicUrl": "/newsletter/2025-w42/article/article-001",
    "createdAt": "2025-10-20T10:00:00Z",
    "updatedAt": "2025-10-27T09:00:00Z",
    "isPublished": true
  }
}
```

**計算欄位**:
- `totalInWeek`: 該週的文章總數（用於位置指示器）

**錯誤回應 (404)**:
```json
{
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "文章 article-001 不存在或已刪除"
  }
}
```

---

### 4. 獲取下一篇文章 ID

**用途**: 快速獲取下一篇文章的 ID（最佳化導航）

**端點**:
```
GET /articles/{articleId}/next
```

**成功回應 (200)**:
```json
{
  "data": {
    "nextArticleId": "article-002",
    "hasNext": true
  }
}
```

**錯誤回應 (404 - 是最後一篇)**:
```json
{
  "data": {
    "nextArticleId": null,
    "hasNext": false
  }
}
```

---

### 5. 獲取上一篇文章 ID

**用途**: 快速獲取上一篇文章的 ID（最佳化導航）

**端點**:
```
GET /articles/{articleId}/previous
```

**成功回應 (200)**:
```json
{
  "data": {
    "previousArticleId": "article-001",
    "hasPrevious": true
  }
}
```

**錯誤回應 (404 - 是第一篇)**:
```json
{
  "data": {
    "previousArticleId": null,
    "hasPrevious": false
  }
}
```

---

### 6. 更新文章順序 (編輯者)

**用途**: 重新排列週報中的文章順序

**端點**:
```
PUT /newsletters/{weekNumber}/articles
```

**驗證**: 需要編輯者令牌

**請求本體**:
```json
{
  "articleIds": [
    "article-003",
    "article-001",
    "article-002",
    "article-004"
  ]
}
```

**成功回應 (200)**:
```json
{
  "data": {
    "weekNumber": "2025-W42",
    "articles": [
      {
        "id": "article-003",
        "order": 1,
        "title": "新排序的第一篇"
      }
      // ... 更新後的順序
    ]
  }
}
```

**錯誤回應 (409 - 衝突)**:
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "文章清單已被他人修改，請重新整理"
  }
}
```

**錯誤回應 (400 - 無效請求)**:
```json
{
  "error": {
    "code": "INVALID_ARTICLE_IDS",
    "message": "某些文章不存在或不屬於該週份"
  }
}
```

---

### 7. 建立文章 (編輯者)

**用途**: 新增文章至週報

**端點**:
```
POST /newsletters/{weekNumber}/articles
```

**驗證**: 需要編輯者令牌

**請求本體**:
```json
{
  "title": "新文章標題",
  "content": "# Markdown Content\n\n文章內容...",
  "author": "作者名稱",
  "order": 5
}
```

**成功回應 (201)**:
```json
{
  "data": {
    "id": "article-005",
    "weekNumber": "2025-W42",
    "title": "新文章標題",
    "author": "作者名稱",
    "order": 5,
    "content": "# Markdown Content\n\n文章內容...",
    "publicUrl": "/newsletter/2025-w42/article/article-005",
    "isPublished": true,
    "createdAt": "2025-10-28T12:00:00Z"
  }
}
```

**錯誤回應 (400 - 驗證失敗)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "標題和內容必填"
  }
}
```

---

### 8. 更新文章 (編輯者)

**用途**: 修改文章內容

**端點**:
```
PUT /articles/{articleId}
```

**驗證**: 需要編輯者令牌

**請求本體**:
```json
{
  "title": "更新後的標題",
  "content": "# 更新的 Markdown 內容",
  "author": "新作者"
}
```

**成功回應 (200)**:
```json
{
  "data": {
    "id": "article-001",
    "title": "更新後的標題",
    "content": "# 更新的 Markdown 內容",
    "author": "新作者",
    "updatedAt": "2025-10-28T12:30:00Z"
  }
}
```

---

### 9. 刪除文章 (編輯者)

**用途**: 從週報中移除文章

**端點**:
```
DELETE /articles/{articleId}
```

**驗證**: 需要編輯者令牌

**成功回應 (204 無內容)**:
```
（無回應本體）
```

**錯誤回應 (404)**:
```json
{
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "文章不存在"
  }
}
```

---

## 狀態碼速查

| 碼 | 說明 | 常見情況 |
|----|------|---------|
| 200 | OK | 成功取得資料 |
| 201 | Created | 成功建立新資源 |
| 204 | No Content | 成功刪除 |
| 400 | Bad Request | 請求格式錯誤、缺少必填欄位 |
| 401 | Unauthorized | 缺少或無效的驗證令牌 |
| 404 | Not Found | 資源不存在 |
| 409 | Conflict | 並行編輯衝突 |
| 500 | Server Error | 伺服器錯誤 |

---

## 速率限制

- **讀者**：每 IP 100 req/min
- **編輯者**：每使用者 30 req/min

回應標頭：
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## CORS 策略

允許來自所有來源的讀取請求，編輯請求需要特定來源驗證。

```
Access-Control-Allow-Origin: *  (讀取)
Access-Control-Allow-Origin: https://editor.example.com  (編輯)
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS  (編輯者)
```

---

## 總結

此 API 契約支援所有使用者故事：

✅ **故事 1**: GET /newsletters/{weekNumber} + GET /articles/{articleId}
✅ **故事 2**: GET /articles/{articleId}（深度連結）
✅ **故事 3**: GET .../next, .../previous（快速導航）
✅ **故事 4**: PUT /newsletters/{weekNumber}/articles（順序管理）

前端可以基於此契約進行獨立開發和單元測試（使用 Mock API）。
