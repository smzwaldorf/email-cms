# 功能規格：分析與報表系統 (Analytics & Reporting)

**版本**: 1.0
**日期**: 2025-12-05
**優先級**: P2（郵件整合之前的基礎支撑）
**狀態**: 📋 規格完成，準備實作

---

## 📋 概述

Email Newsletter CMS 需要一套完整的分析系統，用於：
1. **追蹤郵件開信率與點擊率** - 了解家長的閱讀習慣
2. **生成統計報表** - 按班級、週次、文章維度分析數據
3. **可視化儀表板** - 管理員實時查看關鍵指標
4. **導出報表** - 支援 CSV/Excel 導出供進一步分析

## 核心問題

### 挑戰：電子郵件與網頁的身份追蹤
使用者的旅程跨越兩個斷裂環境：
- **電子郵件客戶端**（Gmail、Outlook 等）- 靜態、受限
- **CMS 網頁應用**（瀏覽器）- 動態、交互式

### 解決方案：使用身份令牌的「智能連結」
郵件中的每條連結都包含唯一的安全令牌：
- **格式**: `https://cms.com/article/123?t=SECURE_TOKEN`
- **有效載荷**: 令牌映射到 `{ userId, newsletterId, classId }`
- **安全性**: 令牌應該是時間限制或簽名的 (JWT)，但允許「魔法連結」風格訪問

---

## ✅ 驗收標準

### 功能驗收標準

| # | 驗收標準 | 優先級 |
|---|---------|--------|
| **AC-001** | 追蹤像素集成：單一週報可生成追蹤像素以檢測郵件開啟 | P1 |
| **AC-002** | 重定向 URL：文章連結可重定向到追蹤服務，記錄點擊並重定向至原文章 | P1 |
| **AC-003** | 身份令牌：每個郵件接收者獲得唯一的 JWT 令牌，無需登入即可訪問個人化內容 | P1 |
| **AC-004** | 會話追蹤：訪問者到達網頁時自動記錄會話開始事件（從令牌提取身份） | P1 |
| **AC-005** | 滾動跟蹤：捕獲 50% 和 90% 滾動事件以衡量參與度 | P2 |
| **AC-006** | 停留時間：計算訪問者在每篇文章上的停留時長 | P2 |
| **AC-007** | 儀表板指標：管理員可查看開信率、點擊率、平均停留時間等 | P1 |
| **AC-008** | 分班統計：按班級分組統計數據，查看不同班級的參與度差異 | P2 |
| **AC-009** | 時間序列分析：追蹤 7 天和 30 天內的參與趨勢 | P2 |
| **AC-010** | 報表導出：支援 CSV/Excel 導出，包含原始數據和匯總統計 | P2 |

### 性能驗收標準

| # | 標準 | 目標 |
|---|-----|------|
| **PERF-001** | 追蹤像素加載 | <100ms（異步，不阻塞郵件呈現） |
| **PERF-002** | 重定向響應 | <200ms（快速重定向，同時記錄） |
| **PERF-003** | 儀表板載入 | <2s（1000+ 事件的儀表板載入） |
| **PERF-004** | 報表生成 | <5s（1 年的數據導出） |

### 數據完整性標準

| # | 標準 | 要求 |
|---|-----|------|
| **DATA-001** | 防止重複計數 | 同一使用者在 10 秒內的重複開啟只計為一次 |
| **DATA-002** | 時區準確性 | 所有時間戳記使用 UTC，前端轉換為本地時區 |
| **DATA-003** | 數據保留 | 追蹤事件保留 12 個月，然後自動歸檔 |
| **DATA-004** | 隱私合規性 | 實作「遺忘權」，支援刪除使用者的所有追蹤數據 |

### 安全驗收標準

| # | 標準 | 實施 |
|---|-----|------|
| **SEC-001** | 令牌驗證 | JWT 簽名驗證，檢查過期時間 |
| **SEC-002** | 令牌洩露防護 | 令牌洩露後可撤銷，不允許重用已撤銷令牌 |
| **SEC-003** | RLS 政策 | `analytics_events` 表限制用戶只能查看自己或其班級的數據 |
| **SEC-004** | XSS 防護 | 所有用戶輸入（查詢過濾）進行 DOMPurify 清理 |

---

## 📊 使用者故事

### US1: 管理員查看開信率與點擊率統計 (P1) 🎯 MVP

**角色**: 系統管理員
**目標**: 了解郵件發送的有效性和閱讀習慣
**情境**: 發送上週週報後，管理員登入儀表板查看統計

**驗收標準**:
- [ ] 儀表板顯示「本週開信率」（%）
- [ ] 顯示「本週點擊率」（%）
- [ ] 顯示「平均停留時間」（分鐘）
- [ ] 數據自動更新，無需手動刷新
- [ ] 支援週選擇器，查看歷史數據

**數據要求**:
```
開信率 = unique_opens / total_sends × 100
點擊率 = unique_clicks / unique_opens × 100
停留時間 = SUM(session_duration) / unique_sessions
```

**邊界情況**:
- [ ] 郵件未發送時，顯示「無可用數據」
- [ ] 無開啟時，率數顯示為 0%
- [ ] 極端停留時間（>1 小時）進行離群值檢測

---

### US2: 分班級統計對比 (P2)

**角色**: 學校主任
**目標**: 對比不同班級的參與度，識別需要支援的班級

**驗收標準**:
- [ ] 儀表板顯示班級列表，按開信率排序
- [ ] 支援班級篩選，查看單班統計詳情
- [ ] 條形圖對比各班級的開信率和點擊率
- [ ] 表格顯示班級名稱、開信數/總數、點擊數、平均停留時間

**表結構**:
```
班級 | 發送人數 | 開啟人數 | 開信率 | 點擊數 | 平均停留時間
A班  |   45    |   38   |  84%  |  128  |  2.5 分
B班  |   42    |   35   |  83%  |  110  |  2.1 分
C班  |   48    |   32   |  67%  |   85  |  1.8 分
```

---

### US3: 文章維度的點擊分析 (P2)

**角色**: 內容編輯
**目標**: 了解哪些文章最受歡迎，優化內容策略

**驗收標準**:
- [ ] 儀表板顯示週報的所有文章清單
- [ ] 每篇文章顯示：標題、點擊數、點擊率、平均停留時間
- [ ] 支援按點擊數排序，識別最受歡迎的文章
- [ ] 支援時間範圍篩選（本週/上週/上月）

**表結構**:
```
文章標題      | 發佈日期   | 點擊數 | 點擊率 | 平均停留時間
開學準備清單  | 2025-09-01 |  156  |  92%  |  3.2 分
秋季野外活動 | 2025-09-02 |   89  |  65%  |  1.5 分
家長讚賞函   | 2025-09-03 |   45  |  28%  |  0.8 分
```

---

### US4: 時間序列趨勢分析 (P2)

**角色**: 系統管理員
**目標**: 追蹤季節性趨勢，識別下降模式

**驗收標準**:
- [ ] 折線圖顯示過去 12 週的開信率趨勢
- [ ] 支援 7 天、30 天、12 週視圖切換
- [ ] 標記異常值（如突降）
- [ ] 可與上年同期對比（如有數據）

---

### US5: 報表導出與分享 (P2)

**角色**: 學校行政人員
**目標**: 導出數據用於報告和決策

**驗收標準**:
- [ ] 支援一鍵導出為 CSV 或 Excel
- [ ] 導出包含原始數據和匯總統計
- [ ] 導出檔名包含日期戳（如 `analytics-2025-12-05.xlsx`）
- [ ] 導出速度 <5 秒（1 年數據）
- [ ] 支援郵件分享導出檔案連結

---

## 🏗️ 技術設計

### 數據庫架構

#### 1. analytics_events 表（核心追蹤表）

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  newsletter_id UUID REFERENCES newsletters(id),
  article_id UUID REFERENCES articles(id) NULL, -- 如果是索引頁則為 NULL
  session_id UUID NOT NULL, -- 用於關聯同一會話的多個事件
  event_type TEXT NOT NULL,
    -- 'page_view', 'scroll_50', 'scroll_90',
    -- 'link_click', 'session_end', 'email_open'
  metadata JSONB, -- { duration_seconds, scroll_depth, source: 'email'|'web' }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- RLS 政策：用戶只能查看自己或其班級的數據
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'page_view', 'scroll_50', 'scroll_90', 'link_click',
    'session_end', 'email_open'
  ))
);

CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_newsletter_id ON analytics_events(newsletter_id);
CREATE INDEX idx_analytics_article_id ON analytics_events(article_id);
CREATE INDEX idx_analytics_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
```

#### 2. analytics_snapshots 表（每日快照，優化查詢）

```sql
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  newsletter_id UUID REFERENCES newsletters(id),
  article_id UUID REFERENCES articles(id) NULL,
  class_id UUID REFERENCES classes(id) NULL,

  metric_name TEXT NOT NULL, -- 'opens', 'clicks', 'avg_duration'
  metric_value DECIMAL(10, 4),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(snapshot_date, newsletter_id, article_id, class_id, metric_name)
);

CREATE INDEX idx_snapshots_date ON analytics_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_newsletter ON analytics_snapshots(newsletter_id);
```

#### 3. tracking_tokens 表（JWT 令牌管理）

```sql
CREATE TABLE tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, -- JWT 的 HMAC，用於快速查找
  token_payload JSONB NOT NULL, -- { userId, newsletterId, classIds, issuedAt, expiresAt }
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  CONSTRAINT token_expiration CHECK (expires_at > created_at)
);

CREATE INDEX idx_tokens_user_id ON tracking_tokens(user_id);
CREATE INDEX idx_tokens_hash ON tracking_tokens(token_hash);
CREATE INDEX idx_tokens_revoked ON tracking_tokens(is_revoked) WHERE NOT is_revoked;
```

### 身份令牌流程（JWT）

#### 生成令牌

```typescript
// 當郵件準備發送時，為每個接收者生成令牌
interface TrackingPayload {
  userId: string
  newsletterId: string
  classIds: string[] // 用戶能訪問的班級
  issuedAt: number // Unix timestamp
  expiresAt: number // 14 天後
  scope: 'read_only' // 限制令牌只能讀取文章，不能編輯
}

const token = jwt.sign(payload, process.env.JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn: '14d'
})

// 存儲令牌哈希用於快速撤銷
const tokenHash = crypto.createHmac('sha256', process.env.SECRET_KEY)
  .update(token)
  .digest('hex')

await db.from('tracking_tokens').insert({
  user_id: userId,
  token_hash: tokenHash,
  token_payload: payload,
  expires_at: new Date(payload.expiresAt * 1000)
})
```

#### 驗證令牌

```typescript
export async function verifyTrackingToken(token: string) {
  try {
    // 1. JWT 簽名驗證
    const payload = jwt.verify(token, process.env.JWT_SECRET) as TrackingPayload

    // 2. 檢查撤銷狀態
    const tokenHash = crypto.createHmac('sha256', process.env.SECRET_KEY)
      .update(token)
      .digest('hex')

    const { data: record } = await db
      .from('tracking_tokens')
      .select('is_revoked')
      .eq('token_hash', tokenHash)
      .single()

    if (record?.is_revoked) throw new Error('Token revoked')

    return payload
  } catch (error) {
    return null
  }
}
```

### 前端追蹤實現

#### 1. 會話初始化 Hook

```typescript
// src/hooks/useAnalyticsTracking.ts
export function useAnalyticsTracking() {
  const { t } = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (!t) return

    // 驗證令牌並建立會話
    const payload = verifyTrackingToken(t)
    if (!payload) {
      // 令牌無效，重定向到登入
      navigate('/login')
      return
    }

    // 儲存會話 ID
    const sessionId = generateUUID()
    sessionStorage.setItem('sessionId', sessionId)

    // 記錄會話開始事件
    trackEvent({
      sessionId,
      event_type: 'page_view',
      article_id: extractArticleIdFromUrl(),
      metadata: { source: 'email', duration_seconds: 0 }
    })
  }, [t, navigate])
}

// 在 ArticleContent 組件中使用
export function ArticleContent({ articleId }: Props) {
  useAnalyticsTracking()
  const [scrollDepth, setScrollDepth] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const depth = (window.scrollY / document.documentElement.scrollHeight) * 100

      // 記錄 50% 和 90% 滾動事件
      if (depth > 50 && scrollDepth <= 50) {
        trackEvent({ event_type: 'scroll_50', article_id: articleId })
      }
      if (depth > 90 && scrollDepth <= 90) {
        trackEvent({ event_type: 'scroll_90', article_id: articleId })
      }

      setScrollDepth(depth)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [scrollDepth, articleId])
}
```

#### 2. 追蹤事件函數

```typescript
// src/services/analyticsService.ts
interface TrackingEvent {
  sessionId: string
  event_type: string
  article_id?: string
  metadata?: Record<string, any>
}

export async function trackEvent(event: TrackingEvent) {
  const payload = verifyTrackingTokenFromStorage()
  if (!payload) return // 不追蹤無令牌的訪問

  await supabase.from('analytics_events').insert({
    user_id: payload.userId,
    newsletter_id: payload.newsletterId,
    session_id: event.sessionId,
    event_type: event.event_type,
    article_id: event.article_id,
    metadata: event.metadata || {}
  })
}
```

### 追蹤像素實現

```typescript
// 在郵件 HTML 生成時添加
function generateNewsletterHtml(newsletter: Newsletter) {
  const trackingPixelUrl = `${TRACKING_API_BASE}/pixel/${newsletter.id}?t=${trackingToken}`

  return `
    <html>
      <body>
        <!-- 郵件內容 -->
        ...
      </body>
      <!-- 追蹤像素：1x1 透明 GIF -->
      <img src="${trackingPixelUrl}" alt="" width="1" height="1" />
    </html>
  `
}

// API 端點：api/tracking/pixel/:newsletterId
export async function handleTrackingPixel(
  req: Request,
  context: Context
) {
  const { newsletterId } = context.params
  const token = new URL(req.url).searchParams.get('t')

  // 驗證令牌
  const payload = verifyTrackingToken(token)
  if (!payload) {
    return new Response('', { status: 204 }) // 無聲失敗
  }

  // 記錄開啟事件（防止重複：同用戶 10 秒內只計一次）
  const recentOpen = await db
    .from('analytics_events')
    .select('id')
    .eq('user_id', payload.userId)
    .eq('newsletter_id', newsletterId)
    .eq('event_type', 'email_open')
    .gte('created_at', new Date(Date.now() - 10000).toISOString())
    .limit(1)

  if (recentOpen.data.length === 0) {
    await trackEvent({
      sessionId: payload.sessionId || generateUUID(),
      event_type: 'email_open',
      metadata: { source: 'email' }
    })
  }

  // 返回 1x1 GIF
  return new Response(GIF_BYTES, {
    headers: { 'Content-Type': 'image/gif' }
  })
}
```

### 重定向 URL 實現

```typescript
// API 端點：api/tracking/click/:trackingLinkId
export async function handleTrackingClick(
  req: Request,
  context: Context
) {
  const { trackingLinkId } = context.params
  const token = new URL(req.url).searchParams.get('t')

  // 驗證令牌
  const payload = verifyTrackingToken(token)
  if (!payload) return redirectToLoginOrOriginal()

  // 查找原始 URL
  const { data: link } = await db
    .from('tracking_links')
    .select('original_url, article_id, newsletter_id')
    .eq('id', trackingLinkId)
    .single()

  if (!link) return redirectToError()

  // 記錄點擊事件
  await trackEvent({
    sessionId: sessionStorage.getItem('sessionId'),
    event_type: 'link_click',
    article_id: link.article_id,
    metadata: { link_id: trackingLinkId }
  })

  // 重定向到原始 URL
  return redirect(link.original_url)
}
```

---

## 📈 儀表板設計

### 主儀表板佈局

```
┌─────────────────────────────────────────────────────────┐
│ 分析儀表板                           [周選擇器] [導出] [刷新] │
├─────────────────────────────────────────────────────────┤
│
│ 關鍵指標卡片（3 列）
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ │  開信率     │  │  點擊率     │  │ 平均停留時間 │
│ │    78%      │  │    52%      │  │   2.4 分    │
│ └─────────────┘  └─────────────┘  └─────────────┘
│
│ 趨勢圖（過去 12 週開信率）
│ ┌─────────────────────────────────────────────────────┐
│ │ 折線圖：開信率趨勢                                     │
│ │                                                     │
│ │  100% ┤                                             │
│ │   80% ┤  ╱╲      ╱╲                                  │
│ │   60% ┤╱    ╲╱    ╲╱╲                                │
│ │   40% ┤              ╲╱╲╱                            │
│ └─────────────────────────────────────────────────────┘
│
│ 分班統計表
│ ┌─────────────────────────────────────────────────────┐
│ │ 班級   │開啟│總數│開信率│點擊數│平均停留│           │
│ │───────┼────┼────┼─────┼─────┼────────┤           │
│ │ A班   │ 38 │ 45 │ 84% │ 128 │ 2.5分  │           │
│ │ B班   │ 35 │ 42 │ 83% │ 110 │ 2.1分  │           │
│ │ C班   │ 32 │ 48 │ 67% │  85 │ 1.8分  │           │
│ └─────────────────────────────────────────────────────┘
│
│ 文章點擊分析表
│ ┌─────────────────────────────────────────────────────┐
│ │ 文章標題     │點擊數│點擊率│平均停留│趨勢          │
│ │──────────────┼────┼─────┼────────┼──────         │
│ │ 開學準備清單 │ 156│ 92% │ 3.2分  │ ↑ 12%         │
│ │ 秋季野外活動 │  89│ 65% │ 1.5分  │ ↓ -5%         │
│ │ 家長讚賞函   │  45│ 28% │ 0.8分  │ ↑ 3%          │
│ └─────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 特殊情況與邊界條件

| 情況 | 行為 | 實施 |
|------|------|------|
| 郵件未發送 | 不追蹤，儀表板顯示「無數據」 | AC-001 檢查 |
| 零開啟 | 顯示開信率為 0%，不計算其他指標 | 數據驗證 |
| 令牌過期 | 使用者須重新登入，重新獲取令牌 | JWT exp 檢查 |
| 令牌洩露 | 管理員可撤銷令牌，阻止進一步訪問 | is_revoked 標記 |
| 轉發郵件 | 收件者以轉發者身份登入，記錄為轉發者 | Token 映射到發送令牌的用戶 |
| 離群值（>1小時停留） | 標記為異常，排除於平均計算外 | 統計過濾邏輯 |

---

## 📚 相關文件

- [ANALYTICS-STRATEGY.md](../docs/analytics/ANALYTICS-STRATEGY.md) - 詳細技術戰略與工具選擇
- [實作計劃](./plan.md) - 完整實作路線圖
- [任務列表](./tasks.md) - 可執行的實作任務

---

## 🔄 下一步

1. ✅ **本文檔** - 規格完成
2. 📋 **plan.md** - 設計技術實現方案（待建立）
3. 📝 **tasks.md** - 生成實作任務列表（待建立）
4. 🔀 **建立分支** - 創建 `006-analytics-reporting` 分支
5. 💻 **實作** - 按任務列表開始編碼
