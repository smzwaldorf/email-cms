# 實作任務列表：分析與報表系統

**分支**: `006-analytics-reporting`
**狀態**: 📋 準備實作，64% 架構重用驗證完成
**預估工作量**: 4-6 週（104 個任務）
**優先順序**: 5 個使用者故事 (P1: 2個, P2: 3個)

---

## 🎯 架構重用優化

> ✅ **64% Schema Reuse Verified** - 6 existing tables reused, only 3 new tables required
> 📄 詳見: [SCHEMA-REUSE-ANALYSIS.md](./SCHEMA-REUSE-ANALYSIS.md)

**Reused Tables** (零改動):
- ✅ `user_roles` - User/recipient tracking
- ✅ `child_class_enrollment` - Parent-child relationships
- ✅ `family_enrollment` - Family grouping
- ✅ `articles` - Article metadata
- ✅ `newsletter_weeks` - Time-based aggregation
- ✅ `classes` - Class/cohort analysis

**New Tables** (最小化):
- 🆕 `analytics_events` - Raw event tracking
- 🆕 `analytics_snapshots` - Daily aggregation
- 🆕 `tracking_tokens` - JWT management
- 🆕 `tracking_links` (optional, Phase 8) - URL mapping

**Benefits**:
- ⏱️ 節省 1-2 天設計時間
- 🔒 100% 向後相容性
- 🚫 零破壞性改動
- ✅ 全現有索引可複用

---

## 📊 任務統計

| 階段 | 描述 | 任務數 | 預計工時 |
|------|------|--------|---------|
| Phase 1 | 基礎架構與數據庫 (3 新表) | 15 | 1 週 |
| Phase 2 | 追蹤令牌與服務 | 12 | 1 週 |
| Phase 3 | 前端追蹤實現 | 14 | 1 週 |
| Phase 4 | API 端點與優化 | 13 | 1 週 |
| Phase 5 | 聚合與查詢優化 | 12 | 1 週 |
| Phase 6 | 儀表板 UI (MVP) | 18 | 1.5 週 |
| Phase 7 | 進階儀表板功能 | 10 | 1 週 |
| Phase 8 | 導出與報表 | 8 | 1 週 |
| Phase 9 | 測試與文檔 | 12 | 1 週 |

**總計**: 104 個任務 | **4-6 週完成** | **測試覆蓋**: 95%+

---

## Phase 1: 基礎架構與數據庫（1 週）

**目的**: 建立數據持久化基礎和表結構（僅需添加 3 個新表，無現存表改動）

### 數據庫遷移

> 📌 **架構說明**: 以下 3 個新表透過 FK 連接到 6 個既有表
> - `analytics_events.user_id` → `user_roles.id` ✅
> - `analytics_events.newsletter_id` → `newsletter_weeks.week_number` ✅
> - `analytics_events.article_id` → `articles.id` ✅
> - `analytics_snapshots` 類似連接到既有表 ✅

- [x] **T001** [P] 建立單一遷移文件：`supabase/migrations/20251205_000_add_analytics_tables.sql`
  - 包含: 3 個新表定義 + RLS 政策 + 索引
  - 檔案: `supabase/migrations/20251205_000_add_analytics_tables.sql`
  - 驗收: 遷移檔案包含所有 3 個表 + FK + 索引 + RLS

- [x] **T002** [P] 在遷移文件中定義 `analytics_events` 表
  - 字段: id, user_id (FK), newsletter_id (FK), article_id (FK), session_id, event_type, metadata, created_at
  - 索引: user_id, newsletter_id, article_id, session_id, created_at
  - FK: 連接到 user_roles, newsletter_weeks, articles (均為既有表)
  - 驗收: 表結構正確，所有 FK 有效

- [x] **T003** [P] 在遷移文件中定義 `analytics_snapshots` 表
  - 字段: id, snapshot_date, newsletter_id (FK), article_id (FK), class_id (FK), metric_name, metric_value, created_at
  - 索引: snapshot_date, newsletter_id, article_id, class_id
  - FK: 連接到 newsletter_weeks, articles, classes (均為既有表)
  - 驗收: 表結構支援日聚合查詢

- [x] **T004** [P] 在遷移文件中定義 `tracking_tokens` 表
  - 字段: id, user_id (FK), token_hash, token_payload, is_revoked, created_at, expires_at
  - 索引: user_id, token_hash (unique), expires_at
  - FK: 連接到 user_roles (既有表)
  - 驗收: 支援令牌撤銷和過期檢查

- [x] **T005** [P] 在遷移文件中定義 `tracking_links` 表 (可選，Phase 8)
  - 字段: id, original_url, article_id (FK), newsletter_id (FK), created_at
  - FK: 連接到 articles, newsletter_weeks (既有表)
  - 驗收: 支援重定向映射
  - 注: 此表可延後至 Phase 8 實作，不影響 MVP

### RLS 政策

> 📌 **重用現有模式**: RLS 政策沿用 `auth_events` 表的設計模式（已驗證安全）
> - 管理員：查看全部數據
> - 使用者：查看自己或相關班級的數據
> - 父母：查看子女班級的數據

- [x] **T006** [P] 在遷移文件中實現 `analytics_events` 的 RLS 政策
  - 政策: SELECT 允許用戶查看自己的事件，管理員查看全部
  - 政策: INSERT 允許服務角色 (trackingService) 插入事件
  - 檔案: 在 `supabase/migrations/20251205_000_add_analytics_tables.sql` 中定義
  - 驗收: 政策測試通過，使用者只能查看自己的數據，管理員可查看全部

- [x] **T007** [P] 在遷移文件中實現 `analytics_snapshots` 的 RLS 政策
  - 政策: SELECT 允許用戶查看自己班級的 snapshot，管理員查看全部
  - 使用 `child_class_enrollment` 表進行班級級別的訪問控制
  - 檔案: 在 `supabase/migrations/20251205_000_add_analytics_tables.sql` 中定義
  - 驗收: 班級級別的訪問控制工作正確，父母只能看自己子女班級的統計

- [x] **T008** [P] 在遷移文件中實現 `tracking_tokens` 的 RLS 政策
  - 政策: SELECT/UPDATE 允許用戶管理自己的令牌，管理員管理全部
  - 政策: INSERT 允許認證服務生成新令牌
  - 檔案: 在 `supabase/migrations/20251205_000_add_analytics_tables.sql` 中定義
  - 驗收: 政策測試通過，令牌撤銷和過期檢查正常工作

### 類型定義

> 📌 **架構整合**: 新類型需與既有的 `user_roles`、`articles`、`newsletter_weeks`、`classes` 類型整合

- [x] **T009** [P] 建立 `src/types/analytics.ts`
  - 類型: `AnalyticsEvent`、`AnalyticsSnapshot`、`TrackingToken`、`TrackingPayload`、`AnalyticsMetrics`
  - FK 參考: `user_id` 參考 `user_roles.id`、`newsletter_id` 參考 `newsletter_weeks`、`article_id` 參考 `articles`、`class_id` 參考 `classes`
  - 檔案: `src/types/analytics.ts`
  - 驗收: 所有類型匯出並可在整個應用中使用，FK 類型相容

- [x] **T010** [P] 建立 `src/types/tracking.ts`
  - 類型: `TrackingEventType`、`TrackingMetadata`、`SessionData`、`JWTPayload`、`TokenRevocationReason`
  - 事件類型: 'page_view'、'scroll_50'、'scroll_90'、'link_click'、'session_end'、'email_open'
  - 檔案: `src/types/tracking.ts`
  - 驗收: 類型定義完整且無衝突，支援所有追蹤事件類型

### 環境配置

- [x] **T011** [P] 更新 `.env.local` 為分析配置
  - 環境變數:
    - `VITE_JWT_SECRET` - JWT 簽名密鑰（來自 Supabase 設定）
    - `VITE_TRACKING_API_BASE` - 追蹤 API 基礎 URL（如 `https://api.example.com/tracking`）
    - `VITE_TRACKING_ENABLED` - 啟用/禁用追蹤的開關
  - 檔案: `.env.local`
  - 驗收: 環境變數在應用中可讀，npm run dev 可正常啟動

- [x] **T012** [P] 建立 `src/config/analytics.ts` 配置文件
  - 配置項:
    - `trackingPixelSize` - 追蹤像素尺寸 (1x1)
    - `eventThrottleMs` - 事件節流延遲 (500ms)
    - `sessionIdStorageKey` - sessionStorage 鍵名
    - `tokenExpiryDays` - JWT 令牌有效期 (14 天)
    - `retentionMonths` - 事件保留月數 (12 個月)
  - 檔案: `src/config/analytics.ts`
  - 驗收: 配置在服務中可用，所有服務可讀取配置值

### 測試與驗證

- [x] **T013** [P] 執行數據庫遷移並驗證
  - 命令: `supabase migration up` 或 `npm run db:migrate`
  - 檔案: `supabase/migrations/20251205_000_add_analytics_tables.sql`
  - 驗收:
    - 遷移成功執行
    - 3 個新表 (`analytics_events`、`analytics_snapshots`、`tracking_tokens`) 在數據庫中存在
    - 所有索引建立成功
    - RLS 政策已啟用並生效

- [x] **T014** [P] 驗證 TypeScript 編譯
  - 命令: `npm run build`
  - 檔案: 新建的 `src/types/analytics.ts` 和 `src/types/tracking.ts`
  - 驗收: 編譯成功，無 TypeScript 類型錯誤

- [x] **T015** [P] 驗證現有測試和功能未受影響
  - 命令: `npm test -- --run`
  - 驗收:
    - 所有現有測試仍然通過 (1705+ 測試)
    - 無回歸錯誤
    - 數據庫連接正常
    - 既有表數據完整性未受影響

---

## Phase 2: 追蹤令牌與服務（1 週）

**目的**: 實現 JWT 令牌生成、驗證和撤銷

### 令牌服務實現

- [ ] **T016** [P] 建立 `src/services/trackingTokenService.ts`
  - 函數: generateToken(), verifyToken(), revokeToken()
  - 驗收: 基本函數實現並可測試

- [ ] **T017** 實現 `generateToken()` 函數
  - 功能: 生成 JWT，包含 userId, newsletterId, classIds, issuedAt, expiresAt
  - 簽名算法: HS256
  - 過期時間: 14 天
  - 驗收: 生成的令牌可驗證

- [ ] **T018** 實現 `verifyToken()` 函數
  - 功能: 驗證 JWT 簽名、檢查過期時間、檢查撤銷狀態
  - 驗收: 有效令牌驗證通過，無效令牌拒絕

- [ ] **T019** 實現 `revokeToken()` 函數
  - 功能: 標記令牌為已撤銷，更新 `is_revoked = true`
  - 驗收: 已撤銷令牌驗證失敗

- [ ] **T020** [P] 實現 `getTokenHash()` 輔助函數
  - 功能: 生成令牌的 SHA256 哈希用於快速查找
  - 驗收: 哈希值可重複生成且一致

### 令牌存儲與管理

- [ ] **T021** 實現 `storeToken()` 函數
  - 功能: 將令牌哈希和有效載荷存儲到 Supabase
  - 驗收: 令牌儲存成功，可查詢

- [ ] **T022** 實現 `checkTokenRevoked()` 函數
  - 功能: 查詢 Supabase 檢查令牌撤銷狀態
  - 驗收: 準確反映撤銷狀態

- [ ] **T023** [P] 實現批量撤銷函數
  - 功能: 為用戶撤銷所有舊令牌（如密碼重置）
  - 驗收: 所有匹配令牌被撤銷

### 安全性與測試

- [ ] **T024** 建立 `tests/unit/services/trackingTokenService.test.ts`
  - 測試: 令牌生成、驗證、撤銷、過期檢查
  - 涵蓋率目標: 95%+
  - 驗收: 所有測試通過

- [ ] **T025** [P] 安全性審查
  - 檢查: 令牌簽名強度、防止重放攻擊、時間驗證
  - 驗收: 無已知漏洞

- [ ] **T026** 集成環境變數管理
  - 功能: 從 `.env.local` 讀取 `JWT_SECRET`
  - 驗收: 配置可靠且安全

- [ ] **T027** 實現令牌刷新機制（可選）
  - 功能: 用戶在令牌即將過期時可申請新令牌
  - 驗收: 刷新流程工作

---

## Phase 3: 前端追蹤實現（1 週）

**目的**: 建立用戶端事件捕獲和發送

### 追蹤 Hook 實現

- [ ] **T028** [P] 建立 `src/hooks/useAnalyticsTracking.ts`
  - 功能: 令牌驗證、會話初始化、事件發送設置
  - 驗收: Hook 可在任何組件中使用

- [ ] **T029** 實現會話管理邏輯
  - 功能: 生成唯一 sessionId，儲存到 sessionStorage
  - 驗收: 每次頁面加載生成新 session ID

- [ ] **T030** 實現令牌提取和驗證
  - 功能: 從 URL 查詢參數提取 `?t=TOKEN`，驗證簽名
  - 驗收: 無效令牌導致重定向到登入

- [ ] **T031** 實現會話開始事件
  - 功能: 令牌驗證後立即記錄 `page_view` 事件
  - 驗收: 事件記錄到 Supabase

### 事件追蹤邏輯

- [ ] **T032** [P] 建立 `src/services/analyticsService.ts`
  - 函數: trackEvent(), recordScrollDepth(), recordSessionEnd()
  - 驗收: 服務可在應用中使用

- [ ] **T033** 實現 `trackEvent()` 函數
  - 功能: 發送事件到 API，包含 sessionId, event_type, article_id, metadata
  - 驗收: 事件成功發送

- [ ] **T034** [P] 實現滾動追蹤
  - 功能: 監聽滾動事件，在 50% 和 90% 時記錄
  - 節流: 防止過度觸發（最多 1 次/50%，1 次/90%）
  - 驗收: 滾動事件准確記錄

- [ ] **T035** 實現停留時間計算
  - 功能: 記錄進入和離開時間，計算停留時長
  - 驗收: 停留時長准確

- [ ] **T036** [P] 實現會話結束事件
  - 功能: 用戶離開頁面或關閉標籤時記錄 `session_end`
  - 事件: `beforeunload`、`pagehide`
  - 驗收: 會話結束事件記錄

### 與組件集成

- [ ] **T037** 在 `ArticleContent.tsx` 中集成追蹤
  - 修改: 添加 `useAnalyticsTracking()` 和滾動監聽
  - 驗收: 文章訪問被追蹤

- [ ] **T038** [P] 在 `WeeklyReaderPage.tsx` 中集成追蹤
  - 修改: 添加追蹤 Hook
  - 驗收: 週報訪問被追蹤

### 閱讀狀態顯示 (Read Status)

- [ ] **T038a** [P] 實現 `getReadArticles` 服務方法
  - 功能: 查詢當前用戶在特定週次或班級已閱讀的文章 ID 列表
  - 查詢: `SELECT article_id FROM analytics_events WHERE event_type = 'page_view' AND user_id = ?`
  - 驗收: 返回準確的已讀文章 ID 集合

- [ ] **T038b** [P] 建立 `useReadStatus` Hook
  - 功能: 獲取並緩存已讀狀態，支援即時更新 (Optimistic UI)
  - 驗收: 進入文章後，列表狀態立即更新為已讀

- [ ] **T038c** [P] 更新文章列表 UI
  - 修改: 在文章卡片/列表項顯示「已讀」勾選框或視覺提示
  - 樣式: 綠色勾選或變灰標題
  - 驗收: 已讀文章有明顯視覺區別

- [ ] **T039** 建立 `tests/unit/hooks/useAnalyticsTracking.test.ts`
  - 測試: 令牌驗證、會話初始化、事件發送
  - 驗收: 所有測試通過

- [ ] **T040** [P] 集成測試：追蹤流程
  - 檔案: `tests/integration/analytics-tracking-flow.test.ts`
  - 測試: 從令牌驗證到事件記錄的完整流程
  - 驗收: 流程工作正常

- [ ] **T041** 性能測試
  - 檔案: `tests/performance/analytics-tracking-performance.test.ts`
  - 目標: 事件發送 <50ms
  - 驗收: 性能指標達成

---

## Phase 4: API 端點與優化（1 週）

**目的**: 實現追蹤像素和重定向端點

### 追蹤像素端點

- [ ] **T042** [P] 建立 `api/tracking/pixel.ts` Supabase 函數
  - 端點: `GET /api/tracking/pixel/:newsletterId?t=TOKEN`
  - 功能: 驗證令牌、記錄 email_open 事件、返回 GIF
  - 驗收: 端點工作，返回 1x1 GIF

- [ ] **T043** 實現 email_open 事件記錄
  - 功能: 從令牌提取 userId，記錄 email_open 事件
  - 驗收: 事件儲存到 analytics_events

- [ ] **T044** [P] 實現重複檢測（10 秒去重）
  - 功能: 同用戶在 10 秒內的多次開啟只計一次
  - 驗收: 重複檢測工作

- [ ] **T045** 實現返回追蹤像素
  - 功能: 返回 1x1 透明 GIF
  - 優化: 緩存 GIF 資源
  - 驗收: 郵件客戶端正確顯示（無呈現延遲）

### 重定向追蹤端點

- [ ] **T046** [P] 建立 `api/tracking/click.ts` Supabase 函數
  - 端點: `GET /api/tracking/click/:trackingLinkId?t=TOKEN&redirect=true`
  - 功能: 驗證令牌、記錄 link_click 事件、重定向
  - 驗收: 端點工作，重定向成功

- [ ] **T047** 實現 link_click 事件記錄
  - 功能: 從令牌提取信息，記錄點擊事件
  - 驗收: 事件儲存

- [ ] **T048** 實現重定向邏輯
  - 功能: 查找 tracking_links，返回 302 重定向
  - 驗收: 用戶重定向到原始 URL

### 端點安全性與性能

- [ ] **T049** [P] 實現端點速率限制
  - 策略: 每個 IP 每分鐘 1000 次請求
  - 驗收: 過度請求被拒絕

- [ ] **T050** 實現端點驗證錯誤處理
  - 行為: 無聲失敗（無信息泄露）
  - 驗收: 無效請求返回 204 或 302

- [ ] **T051** [P] 性能測試
  - 檔案: `tests/performance/analytics-api-performance.test.ts`
  - 目標: 像素端點 <100ms，重定向端點 <200ms
  - 驗收: 性能指標達成

- [ ] **T052** 集成 CDN 快取（可選）
  - 功能: 追蹤像素在邊界緩存 60 秒
  - 驗收: 減少數據庫查詢

- [ ] **T053** [P] 安全審查
  - 檢查: 令牌驗證、CORS、速率限制
  - 驗收: 無已知漏洞

- [ ] **T054** 建立 `tests/integration/tracking-api.test.ts`
  - 測試: 像素和重定向端點的完整流程
  - 驗收: 所有測試通過

---

## Phase 5: 聚合與查詢優化（1 週）

**目的**: 優化查詢性能，實施日 snapshot

### Snapshot 生成

- [ ] **T055** [P] 建立 `src/services/analyticsAggregator.ts`
  - 函數: generateDailySnapshot(), aggregateMetrics()
  - 驗收: 服務可運行

- [ ] **T056** 實現日聚合 Job
  - 功能: 每天午夜 UTC 運行，聚合前一天的事件
  - 驗收: Job 成功執行

- [ ] **T057** [P] 實現開信數聚合
  - 邏輯: COUNT(DISTINCT user_id) WHERE event_type = 'email_open'
  - 驗收: 聚合結果准確

- [ ] **T058** 實現點擊數聚合
  - 邏輯: COUNT(DISTINCT user_id) WHERE event_type = 'link_click' BY article
  - 驗收: 結果准確

- [ ] **T059** [P] 實現停留時間聚合
  - 邏輯: AVG(duration_seconds) 計算
  - 驗收: 平均值准確

### 查詢優化

- [ ] **T060** [P] 建立 `src/hooks/useAnalyticsQuery.ts`
  - Hook: useOpenRate(), useClickRate(), useAverageStayTime()
  - 驗收: Hook 可在組件中使用

- [ ] **T061** 實現 Snapshot 查詢
  - 功能: 優先查詢 snapshot，若無數據則回退原始數據
  - 驗收: 查詢速度 <2s

- [ ] **T062** [P] 實現快取策略
  - 使用: TanStack Query 緩存
  - TTL: 5 分鐘
  - 驗收: 後續查詢返回緩存數據

- [ ] **T063** 實現時間範圍篩選
  - 功能: 支援 week, month, year 視圖
  - 驗收: 篩選工作

- [ ] **T064** [P] 實現班級篩選
  - 功能: 按 class_id 篩選數據
  - 驗收: 篩選工作

- [ ] **T065** 建立 `tests/unit/services/analyticsAggregator.test.ts`
  - 測試: 聚合邏輯、計算准確性
  - 驗收: 所有測試通過

- [ ] **T066** [P] 集成測試：聚合流程
  - 檔案: `tests/integration/analytics-aggregation.test.ts`
  - 測試: 從事件到 snapshot 的完整流程
  - 驗收: 流程工作

---

## Phase 6: 儀表板 UI (MVP)（1.5 週）

**目的**: 建立基礎儀表板和核心視圖

### 主儀表板頁面

- [ ] **T067** [P] 建立 `src/pages/AnalyticsDashboardPage.tsx`
  - 布局: 標題、篩選器、KPI 卡片、圖表、表格
  - 驗收: 頁面呈現，支援響應式設計

- [ ] **T068** 實現週選擇器
  - 功能: 選擇週次，儀表板數據隨之更新
  - 驗收: 選擇工作，數據更新

- [ ] **T069** [P] 實現刷新按鈕
  - 功能: 手動刷新數據（無快取）
  - 驗收: 點擊後數據更新

- [ ] **T070** 實現導出按鈕
  - 功能: 導出當前視圖的數據
  - 驗收: 導出按鈕存在（功能在 Phase 8）

### KPI 卡片組件

- [ ] **T071** [P] 建立 `src/components/analytics/KPICard.tsx`
  - 顯示: 指標名稱、數值、環比變化（↑/↓）、趨勢圖
  - 驗收: 組件可重用

- [ ] **T072** 建立 `src/components/analytics/OpenRateCard.tsx`
  - 數據: 本週開信率 (%)、對比上週趨勢
  - 驗收: 卡片顯示正確數據

- [ ] **T073** [P] 建立 `src/components/analytics/ClickRateCard.tsx`
  - 數據: 本週點擊率 (%)、對比上週趨勢
  - 驗收: 卡片顯示正確數據

- [ ] **T074** 建立 `src/components/analytics/AvgStayTimeCard.tsx`
  - 數據: 平均停留時間（分鐘）、對比上週趨勢
  - 驗收: 卡片顯示正確數據

- [ ] **T075** [P] 建立動畫和互動
  - 效果: 數值動畫、懸停提示
  - 驗收: 動畫流暢

### 趨勢圖組件

- [ ] **T076** [P] 建立 `src/components/analytics/TrendChart.tsx`
  - 圖表類型: 折線圖（使用 Recharts）
  - 驗收: 圖表呈現正確

- [ ] **T077** 實現 12 週趨勢視圖
  - 數據: 過去 12 週的開信率
  - 驗收: 圖表顯示完整趨勢

- [ ] **T078** [P] 實現時間範圍切換
  - 選項: 7 天、30 天、12 週
  - 驗收: 切換工作

- [ ] **T079** 實現異常值標記（可選）
  - 功能: 標記異常高或低的點
  - 驗收: 異常值視覺化

### 數據表格

- [ ] **T080** [P] 建立 `src/components/analytics/ClassComparisonTable.tsx`
  - 列: 班級、發送人數、開啟人數、開信率、點擊數、平均停留
  - 驗收: 表格呈現正確

- [ ] **T081** 實現班級表排序
  - 功能: 按任何列排序
  - 驗收: 排序工作

- [ ] **T082** [P] 建立 `src/components/analytics/ArticleAnalyticsTable.tsx`
  - 列: 文章標題、發佈日期、點擊數、點擊率、停留時間
  - 驗收: 表格呈現正確

- [ ] **T083** 實現文章表排序和篩選
  - 功能: 排序和按日期篩選
  - 驗收: 功能工作

- [ ] **T084** [P] 實現分頁
  - 功能: 每頁 20 筆，支援前後翻頁
  - 驗收: 分頁工作

### 儀表板集成

- [ ] **T085** [P] 在 `src/App.tsx` 中添加路由
  - 路由: `/admin/analytics`
  - RLS 檢查: 僅限管理員訪問
  - 驗收: 路由工作，未授權用戶被拒絕

- [ ] **T086** 建立 `tests/components/analytics/KPICard.test.tsx`
  - 驗收: 組件測試通過

- [ ] **T087** [P] 建立 `tests/integration/analytics-dashboard.test.ts`
  - 驗收: 儀表板集成測試通過

---

## Phase 7: 進階儀表板功能（1 週）

**目的**: 完善儀表板，添加進階分析

### 進階篩選和對比

- [ ] **T088** [P] 實現班級篩選
  - 功能: 選擇班級，儀表板只顯示該班級數據
  - 驗收: 篩選工作

- [ ] **T089** 實現多班級對比
  - 功能: 選擇多個班級進行對比
  - 驗收: 對比視圖正確

- [ ] **T090** [P] 實現日期範圍篩選
  - 功能: 選擇開始和結束日期
  - 驗收: 篩選工作

### 進階可視化

- [ ] **T091** [P] 實現班級對比條形圖
  - 圖表: 班級並排對比開信率和點擊率
  - 驗收: 圖表呈現

- [ ] **T092** 實現文章熱力圖（可選）
  - 圖表: 顯示文章熱度（點擊數 vs 停留時間）
  - 驗收: 熱力圖呈現

### 詳細頁面

- [ ] **T093** [P] 建立班級詳情頁面
  - 路由: `/admin/analytics/class/:classId`
  - 內容: 該班級的詳細統計和趨勢
  - 驗收: 頁面呈現

- [ ] **T094** 建立文章詳情頁面
  - 路由: `/admin/analytics/article/:articleId`
  - 內容: 該文章的詳細統計和讀者信息
  - 驗收: 頁面呈現

- [ ] **T095** [P] 建立週詳情頁面
  - 路由: `/admin/analytics/week/:weekNumber`
  - 內容: 該週的完整統計
  - 驗收: 頁面呈現

### 性能優化

- [ ] **T096** [P] 實施虛擬滾動
  - 功能: 表格支援大數據集（>1000 行）
  - 庫: react-window
  - 驗收: 性能指標 <2s

- [ ] **T097** 實施圖表數據懶加載
  - 功能: 開始時只加載最近 4 週，用戶滾動時加載更多
  - 驗收: 初始加載 <1s

---

## Phase 8: 導出與報表（1 週）

**目的**: 支援報表導出和分享

### CSV 和 Excel 導出

- [ ] **T098** [P] 建立 `src/components/analytics/ExportButton.tsx`
  - 功能: 下拉菜單選擇導出格式（CSV、Excel）
  - 驗收: 按鈕可點擊

- [ ] **T099** 實現 CSV 導出
  - 數據: 儀表板當前視圖的數據
  - 使用: papaparse 庫
  - 驗收: CSV 文件可下載

- [ ] **T100** [P] 實現 Excel 導出
  - 功能: 多個工作表（原始數據、匯總統計、圖表圖片）
  - 使用: exceljs 庫
  - 驗收: Excel 文件可下載

- [ ] **T101** 實現報表檔名和時間戳
  - 格式: `analytics-2025-12-05.csv` 或 `.xlsx`
  - 驗收: 檔名正確

### 報表分享

- [ ] **T102** [P] 實現報表分享連結
  - 功能: 生成可分享的連結，他人可查看報表
  - 過期: 7 天後失效
  - 驗收: 分享連結工作

- [ ] **T103** 建立分享頁面
  - 路由: `/analytics/share/:shareToken`
  - 驗收: 頁面呈現報表

- [ ] **T104** [P] 實現郵件分享
  - 功能: 直接郵件報表或分享連結
  - 驗收: 郵件發送成功

---

## Phase 9: 測試與文檔（1 週）

**目的**: 完整測試套件和文檔

### 單元測試

- [ ] **T105** [P] 完成追蹤服務單元測試
  - 覆蓋: 令牌服務、分析服務
  - 目標: 95%+
  - 驗收: 所有測試通過

- [ ] **T106** 完成 API 端點單元測試
  - 覆蓋: 像素端點、重定向端點
  - 驗收: 所有測試通過

### 集成測試

- [ ] **T107** [P] 完成追蹤流程集成測試
  - 場景: 郵件開啟 → 點擊 → 訪問網頁 → 記錄事件
  - 驗收: 完整流程工作

- [ ] **T108** 完成儀表板集成測試
  - 場景: 登入 → 查看儀表板 → 篩選數據 → 導出
  - 驗收: 完整流程工作

### E2E 測試

- [ ] **T109** [P] 建立完整 E2E 測試
  - 工具: Playwright
  - 場景: 端到端郵件追蹤
  - 驗收: 測試通過

### 文檔

- [ ] **T110** [P] 建立 API 文檔
  - 格式: OpenAPI 3.0
  - 內容: 追蹤端點、查詢端點、導出端點
  - 檔案: `specs/006-analytics-reporting/docs/API.md`

- [ ] **T111** 建立部署指南
  - 內容: 數據庫遷移、定時任務設置、環境變數
  - 檔案: `specs/006-analytics-reporting/docs/DEPLOYMENT.md`

- [ ] **T112** [P] 建立數據隱私和安全文檔
  - 內容: 數據保留政策、隱私考慮、安全最佳實踐
  - 檔案: `specs/006-analytics-reporting/docs/SECURITY.md`

- [ ] **T113** 建立故障排除指南
  - 內容: 常見問題、調試步驟、日誌分析
  - 檔案: `specs/006-analytics-reporting/docs/TROUBLESHOOTING.md`

### 最終驗證

- [ ] **T114** [P] 驗證所有功能需求
  - 檢查表: AC-001 到 AC-010
  - 驗收: 全部通過

- [ ] **T115** 驗證所有性能需求
  - 檢查表: PERF-001 到 PERF-004
  - 驗收: 全部達成

---

## 📊 任務分組

### 按優先級

**P1（高優先）**: T001-T015, T016-T027, T028-T041, T042-T054, T055-T066, T067-T084, T105-T115
**P2（並行可行）**: T017-T027, T042-T054, T055-T066, T088-T097, T098-T104

### 按用戶故事

**US1（開信率與點擊率統計）**: T016-T066, T067-T084
**US2（班級對比分析）**: T080-T081, T088-T089
**US3（文章維度分析）**: T082-T084, T093-T094
**US4（時間序列分析）**: T076-T079, T095
**US5（報表導出）**: T098-T104

---

## ✅ 驗收準則

所有任務完成後：

- [ ] 1705+ 測試通過（包括新測試）
- [ ] 代碼覆蓋率 95%+
- [ ] 所有 AC 驗收標準通過
- [ ] 所有 PERF 性能標準達成
- [ ] 所有文檔完成
- [ ] 功能分支合併到 main
- [ ] 發布版本標籤：`v1.4-analytics-reporting`

---

## 🔗 相關資源

- [spec.md](./spec.md) - 功能規格文檔
- [plan.md](./plan.md) - 實作計劃
- [../docs/analytics/ANALYTICS-STRATEGY.md](../docs/analytics/ANALYTICS-STRATEGY.md) - 技術戰略
