# 資料模型設計：電子報閱讀 Web App

**功能**: 001-newsletter-viewer
**日期**: 2025-10-28

## 概述

此文件定義電子報應用程式中的關鍵實體、屬性、關係和驗證規則。所有資料結構都使用 TypeScript 強類型定義。

---

## 核心實體

### 1. 電子報周份 (NewsletterWeek)

代表電子報的特定一週發行。

#### TypeScript 類型定義

```typescript
interface NewsletterWeek {
  // 唯一識別
  weekNumber: string; // 格式: "2025-W42" (ISO 8601)

  // 基本資訊
  releaseDate: Date;  // 發行日期
  title?: string;     // 週報標題（可選）

  // 時間戳
  createdAt: Date;
  updatedAt: Date;

  // 文章清單（內聯或參考）
  articleIds: string[]; // 文章 ID 清單，按序

  // 元數據
  isPublished: boolean; // 是否已發行（無時間限制，可隨時編輯）
  totalArticles: number; // 快取：文章總數
}
```

#### 驗證規則

| 欄位 | 規則 |
|------|------|
| `weekNumber` | 格式必須為 ISO 8601 周格式 (YYYY-W##)，必填 |
| `releaseDate` | 必填，有效日期 |
| `articleIds` | 必須是唯一 ID 清單，長度 0-500 |
| `isPublished` | 布林值，預設 false |

#### 狀態轉換

```
未發行 (isPublished: false)
  ↓ [編輯發行]
已發行 (isPublished: true)
  ↓ [編輯任何時間可修改]
已發行 (isPublished: true)
```

**說明**: 根據澄清 Q5，無發行狀態鎖定，編輯者任何時間可修改任何週份。

#### 關係

- **包含** 多個 **文章** (1:N)
- 文章清單順序由 `articleIds` 陣列順序決定

---

### 2. 文章 (Article)

代表電子報中的單篇內容。

#### TypeScript 類型定義

```typescript
interface Article {
  // 唯一識別
  id: string; // UUID 或遞增整數

  // 內容
  title: string; // 文章標題，必填
  content: string; // Markdown 格式內容，必填
  author?: string; // 作者名稱（可選）
  summary?: string; // 摘要（可選）

  // 分類與排序
  weekNumber: string; // 所屬週份 (ISO 8601 格式)
  order: number; // 該週內的排序序號（1, 2, 3...）

  // 連結與訪問
  slug: string; // URL 友好名稱（可選，用於生成讀者連結）
  publicUrl: string; // 公開可訪問的 URL
  // 格式: /newsletter/{weekNumber}/article/{id}
  // 或: /newsletter/{weekNumber}/article/{order}

  // 時間戳
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date; // 發行時間（可選）

  // 元數據
  isPublished: boolean; // 該文章是否可讀
  viewCount?: number; // 瀏覽次數（分析用）
}
```

#### 驗證規則

| 欄位 | 規則 |
|------|------|
| `id` | 必填，全域唯一，不可變 |
| `title` | 必填，1-200 字符，非空 |
| `content` | 必填，Markdown 格式 |
| `weekNumber` | 必填，格式 YYYY-W##，必須對應有效週份 |
| `order` | 必填，正整數，該週內唯一 |
| `publicUrl` | 自動生成，不可手動修改 |
| `isPublished` | 預設繼承週份的 `isPublished` 值 |

#### 狀態轉換

```
未發行
  ↓ [發行週份]
已發行（同週份狀態）
  ↓ [刪除]
已刪除
```

#### 關係

- **屬於** 一個 **電子報周份** (N:1)
- **獨立存在** 作為可分享的單位

---

### 3. 導航狀態 (NavigationState)

追蹤讀者當前的瀏覽位置（客戶端狀態）。

#### TypeScript 類型定義

```typescript
interface NavigationState {
  // 當前位置
  currentWeekNumber: string; // 當前週份 (ISO 8601)
  currentArticleId: string; // 當前文章 ID
  currentArticleOrder: number; // 當前文章在週內的序號

  // 快取資訊
  totalArticlesInWeek: number; // 該週的文章總數
  articleList: Article[]; // 該週的文章清單（快取）

  // 導航狀態
  isLoading: boolean; // 是否正在載入
  error?: {
    code: string; // 錯誤碼 (e.g., "WEEK_NOT_FOUND", "ARTICLE_DELETED")
    message: string; // 使用者友善的錯誤信息
  };

  // 上下文
  previousArticleId?: string; // 快速存取上一篇
  nextArticleId?: string; // 快速存取下一篇
}
```

#### 計算屬性

```typescript
// 位置指示器文字
positionText(): string {
  return `第 ${this.currentArticleOrder} 篇，共 ${this.totalArticlesInWeek} 篇`;
}

// 是否可導航至下一篇
hasNext(): boolean {
  return this.currentArticleOrder < this.totalArticlesInWeek;
}

// 是否可導航至上一篇
hasPrevious(): boolean {
  return this.currentArticleOrder > 1;
}
```

#### 更新規則

- 當讀者點擊導航按鈕時更新
- 當讀者訪問深度連結時初始化
- 當文章被刪除時更新（轉至下一篇或錯誤頁面）

---

## 實體關係圖

```
┌─────────────────────┐
│  NewsletterWeek     │
├─────────────────────┤
│ weekNumber (PK)     │
│ releaseDate         │
│ articleIds[]        │---┐
│ isPublished         │   │
│ createdAt           │   │ (1:N)
│ updatedAt           │   │
│ totalArticles       │   │
└─────────────────────┘   │
                          │
                          ↓
┌─────────────────────┐
│    Article          │
├─────────────────────┤
│ id (PK)             │
│ title               │
│ content (Markdown)  │
│ weekNumber (FK)     │◄──┘
│ order               │
│ publicUrl           │
│ isPublished         │
│ createdAt           │
│ updatedAt           │
└─────────────────────┘

NavigationState (瞬態，僅客戶端)
├─ currentWeekNumber (指向 NewsletterWeek)
├─ currentArticleId (指向 Article)
└─ articleList[] (快取 Article 清單)
```

---

## 資料流

### 讀者查看週報

```
1. GET /api/newsletters/{weekNumber}
   → 返回 NewsletterWeek + Article[] 清單

2. 初始化 NavigationState
   currentWeekNumber = weekNumber
   currentArticleOrder = 1
   articleList = [文章清單]
   currentArticleId = articleList[0].id

3. 渲染 UI
   - 顯示第一篇文章內容
   - 更新位置指示器 (1/N)
   - 啟用/禁用導航按鈕
```

### 讀者點擊下一篇

```
1. 檢查 currentArticleOrder < totalArticlesInWeek

2. 更新 NavigationState
   currentArticleOrder++
   currentArticleId = articleList[order-1].id

3. 渲染新文章
   - 顯示載入指示器
   - 加載新文章內容
   - 隱藏舊內容
   - 更新位置指示器
   - 更新 URL: /newsletter/{week}/article/{newId}
```

### 讀者訪問深度連結

```
1. URL: /newsletter/2025-w42/article/5

2. 解析 URL 參數
   weekNumber = "2025-w42"
   articleId = 5 (或 order)

3. GET /api/newsletters/{weekNumber}
   返回週份資料與文章清單

4. 初始化 NavigationState
   找到 order = 5 的文章
   currentArticleOrder = 5
   currentArticleId = Article.id

5. 渲染
   - 顯示第 5 篇文章
   - 位置指示器: "5/10"
   - 導航按鈕啟用（如果不在邊界）
```

---

## 邊界情況處理

### 週份不存在

```typescript
if (!weekData) {
  navigationState.error = {
    code: "WEEK_NOT_FOUND",
    message: "此週的電子報不存在"
  };
  // 建議使用者查看最新可用週份或首頁
}
```

### 文章已刪除

```typescript
if (!currentArticle) {
  navigationState.error = {
    code: "ARTICLE_DELETED",
    message: "此文章已被移除"
  };
  // 導航至該週的下一篇，或顯示「無文章」訊息
}
```

### 週份無文章

```typescript
if (articleList.length === 0) {
  navigationState.error = {
    code: "NO_ARTICLES",
    message: "此週暫無文章"
  };
}
```

---

## 並行編輯與一致性

根據澄清 Q4，系統採用「最後寫入勝出」策略，無衝突解決機制。

```typescript
// 編輯者保存變更
PUT /api/newsletters/{weekNumber}
{
  articleIds: [新順序的 ID 清單],
  updatedAt: timestamp
}

// 若多個編輯者同時編輯
// 後發的 PUT 請求會覆蓋先前的變更
// 客戶端應實現樂觀更新 + 刷新機制
```

---

## 資料持久化

本設計假設存在後端 API 提供資料持久化。前端責任：

1. **快取**：使用 React Context 暫存當前週份資料
2. **狀態管理**：NavigationState 僅存在客戶端
3. **數據更新**：編輯操作通過 API 提交至後端

---

## 總結

| 實體 | 責任 | 存儲 |
|------|------|------|
| **NewsletterWeek** | 周級別資料、文章清單 | 後端 API |
| **Article** | 單篇文章內容、元數據 | 後端 API |
| **NavigationState** | 讀者瀏覽位置、UI 狀態 | 前端 Context |

此設計簡潔、易於測試，符合 MVP 原則，支援所有使用者故事和邊界情況。
