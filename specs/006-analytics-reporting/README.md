# Phase 006: Analytics & Reporting System

**版本**: 1.0
**開始日期**: 2025-12-05
**預計完成**: 2025-12-31（6 週）
**狀態**: 📋 準備完成，可開始實作
**優先級**: P2（郵件整合之前的基礎支撑）

---

## 📖 快速導航

### 📋 文檔
| 文檔 | 描述 |
|------|------|
| [spec.md](./spec.md) | 完整功能規格（6400+ 字）|
| [plan.md](./plan.md) | 實作計劃和架構設計 |
| [tasks.md](./tasks.md) | 104 個具體可執行任務 |
| [PREPARATION-SUMMARY.md](./PREPARATION-SUMMARY.md) | 準備工作摘要 |

### 📚 技術資源
| 資源 | 描述 |
|------|------|
| [ANALYTICS-STRATEGY.md](../docs/analytics/ANALYTICS-STRATEGY.md) | 詳細技術戰略和工具選擇 |
| [FUTURE-PLANS.md](../FUTURE-PLANS.md) | 項目整體進度追蹤 |
| [FUTURE-PLANS-DETAILS.md](../FUTURE-PLANS-DETAILS.md) | 詳細需求和 User Stories |

---

## 🎯 核心目標

建立完整的電子報分析和報表系統，用於：

1. **追蹤郵件開信率與點擊率** - 了解家長的閱讀習慣
2. **生成統計報表** - 按班級、週次、文章維度分析數據
3. **可視化儀表板** - 管理員實時查看關鍵指標
4. **導出和分享報表** - 支援 CSV/Excel 導出供進一步分析

---

## 📊 核心架構

### 三層架構
```
┌──────────────────────┐
│   Admin Dashboard    │  ← 儀表板 UI（React）
│  (KPI卡、圖表、表)   │
└──────────────┬───────┘
               ↓
┌──────────────────────┐
│  Query Layer         │  ← 快速查詢（snapshot）
│  (useAnalyticsQuery) │
└──────────────┬───────┘
               ↓
┌──────────────────────┐
│  Aggregation Layer   │  ← 日聚合（Job）
│  (Snapshots)         │
└──────────────┬───────┘
               ↓
┌──────────────────────┐
│  Tracking Layer      │  ← 事件記錄（API）
│  (Pixel, Redirect)   │
└──────────────┬───────┘
               ↓
┌──────────────────────┐
│  Supabase Database   │  ← 數據持久化
│  (analytics_events)  │
└──────────────────────┘
```

### 追蹤流程
```
Email Client (with token)
         ↓
    [追蹤像素] ← 記錄開啟
         ↓
    [智能連結] ← 魔法令牌認證
         ↓
    Front-end ← 驗證令牌、初始化會話
         ↓
    useAnalyticsTracking() ← Hook 啟動
         ↓
    事件記錄 (scroll, click, etc)
         ↓
    analytics_events 表 ← Supabase
         ↓
    Daily Snapshot Job ← 聚合數據
         ↓
    analytics_snapshots 表 ← 快速查詢
         ↓
    Admin Dashboard ← 可視化呈現
```

---

## 🚀 實作路線圖

### MVP（3 週）
完成 Phase 1-3，可交付基礎開信率和點擊率追蹤

**交付物**:
- ✅ 追蹤像素工作
- ✅ 重定向連結工作
- ✅ 基礎儀表板（開信率、點擊率、停留時間）

### Phase 4-7（2 週）
API 優化、聚合和進階儀表板功能

**交付物**:
- ✅ 班級對比分析
- ✅ 文章維度分析
- ✅ 時間序列趨勢
- ✅ 進階篩選

### Phase 8-9（1 週）
導出、分享和完整測試套件

**交付物**:
- ✅ CSV/Excel 導出
- ✅ 報表分享功能
- ✅ 完整測試覆蓋（95%+）
- ✅ 完整文檔

---

## 📋 任務統計

| Phase | 描述 | 任務數 | 工時 |
|-------|------|--------|------|
| 1 | 基礎架構與數據庫 | 15 | 1 週 |
| 2 | 追蹤令牌與服務 | 12 | 1 週 |
| 3 | 前端追蹤實現 | 14 | 1 週 |
| 4 | API 端點與優化 | 13 | 1 週 |
| 5 | 聚合與查詢優化 | 12 | 1 週 |
| 6 | 儀表板 UI (MVP) | 18 | 1.5 週 |
| 7 | 進階儀表板功能 | 10 | 1 週 |
| 8 | 導出與報表 | 8 | 1 週 |
| 9 | 測試與文檔 | 12 | 1 週 |
| **總計** | **104 個任務** | **114** | **4-6 週** |

---

## ✅ 驗收標準

### 功能驗收標準
- [ ] AC-001: 追蹤像素集成
- [ ] AC-002: 重定向 URL 工作
- [ ] AC-003: 身份令牌驗證
- [ ] AC-004: 會話追蹤
- [ ] AC-005: 滾動跟蹤
- [ ] AC-006: 停留時間計算
- [ ] AC-007: 儀表板指標
- [ ] AC-008: 分班統計
- [ ] AC-009: 時間序列分析
- [ ] AC-010: 報表導出

### 性能標準
- [ ] PERF-001: 追蹤像素 <100ms
- [ ] PERF-002: 重定向 <200ms
- [ ] PERF-003: 儀表板 <2s
- [ ] PERF-004: 報表生成 <5s

### 測試覆蓋
- [ ] 單元測試: 95%+
- [ ] 集成測試: 完整流程
- [ ] E2E 測試: 郵件到儀表板
- [ ] 性能測試: 所有標準達成

---

## 🛠️ 技術棧

### 現有依賴
- **React 18** - UI 框架
- **TypeScript 5** - 類型安全
- **Supabase** - 數據庫 + RLS
- **TanStack Query** - 數據查詢
- **Tailwind CSS** - 樣式
- **Vitest** - 單元測試

### 新增依賴
```bash
npm install recharts@^2.10.0         # 圖表庫
npm install papaparse@^5.4.1         # CSV 導出
npm install exceljs@^4.3.0           # Excel 導出
npm install date-fns@^2.30.0         # 日期處理
npm install uuid@^9.0.0              # UUID 生成
```

---

## 📚 關鍵概念

### 1. 身份令牌（JWT）
郵件中的每條連結都包含一個唯一的 JWT 令牌：
```
https://cms.com/article/123?t=eyJhbGciOiJIUzI1NiIs...
```
令牌有效期 14 天，包含：
- userId
- newsletterId
- classIds
- issuedAt
- expiresAt

### 2. 防止重複計數
同一用戶 10 秒內的多次開啟只計為一次（使用時間戳檢查）

### 3. 會話追蹤
每次訪問生成唯一 sessionId，用於關聯該會話的所有事件

### 4. 日聚合
每日午夜 UTC 運行 snapshot 生成 job，將原始事件聚合為可查詢的快照

### 5. RLS 政策
數據庫層級的訪問控制，確保用戶只能查看自己的數據

---

## 🔒 安全設計

### 令牌安全
- JWT 簽名驗證
- 過期時間檢查（14 天）
- 令牌撤銷機制（is_revoked 標記）
- Hash-based 快速查找（防止時序攻擊）

### API 安全
- 速率限制（1000 req/min per IP）
- 無聲失敗（不洩露信息）
- CORS 配置

### 數據安全
- RLS 政策（用戶級別訪問控制）
- DOMPurify 清理用戶輸入
- 數據保留政策（12 個月后自動歸檔）
- 支援數據刪除（GDPR 遺忘權）

---

## 🚦 開始實作

### 1. 確認準備
```bash
# 檢查當前分支
git branch -v
# 應看到: 006-analytics-reporting

# 確認沒有未提交更改
git status
```

### 2. 開始 Phase 1
```bash
# 建立遷移文件
supabase migration new analytics_tables

# 編輯遷移文件
# 添加 analytics_events、analytics_snapshots、
#     tracking_tokens、tracking_links 表
# 添加 RLS 政策

# 執行遷移
npm run db:migrate

# 驗證
npm run build
npm test -- --run
```

### 3. 逐 Phase 推進
按 [tasks.md](./tasks.md) 中的順序完成每個 Phase：
1. Phase 1: 數據庫和類型
2. Phase 2: 令牌服務
3. Phase 3: 前端追蹤
...（依此類推）

### 4. 每完成一個 Phase
```bash
# 運行完整測試
npm test -- --run

# 提交 commit
git add .
git commit -m "feat(analytics): Complete Phase X - [描述]"

# 檢查進度
# 在 tasks.md 中標記完成任務
```

---

## 🐛 常見問題

### Q: 我可以並行執行任務嗎？
**A**: 是的！標記為 [P] 的任務可以並行執行。詳見 [plan.md](./plan.md) 的「並行執行機會」。

### Q: 郵件令牌如何生成？
**A**: 在郵件生成時，系統為每個接收者生成唯一 JWT，並包含在郵件連結的查詢參數中。詳見 [spec.md](./spec.md) 的「身份令牌流程」。

### Q: 如何處理郵件轉發場景？
**A**: 令牌映射到原始發送者（收件人），不會自動跟蹤轉發者的訪問。這是安全設計的一部分。

### Q: 支援哪些郵件平台？
**A**: 當前設計針對 Kit.com（ConvertKit）。可擴展支援 SendGrid，需調整令牌策略。詳見 [ANALYTICS-STRATEGY.md](../docs/analytics/ANALYTICS-STRATEGY.md)。

### Q: 數據保留多久？
**A**: 原始事件 12 個月，快照永久保留。詳見 [spec.md](./spec.md) 的「數據完整性標準」。

---

## 📞 支持和聯繫

### 文檔問題
查看相應的 spec.md 章節或 ANALYTICS-STRATEGY.md

### 技術問題
1. 檢查 [plan.md](./plan.md) 的「技術棧」和「架構設計」
2. 查看 [tasks.md](./tasks.md) 中任務的「驗收準則」
3. 參考 [spec.md](./spec.md) 的「特殊情況」

### 進度問題
每 Phase 完成后提交 commit，根據 [tasks.md](./tasks.md) 追蹤進度

---

## 📝 相關項目

### 前置條件
- ✅ 003-passwordless-auth - 用戶身份系統
- ✅ 004-rich-text-editor - 郵件內容編輯
- ✅ 005-admin-dashboard - 郵件管理介面

### 相關文檔
- [FUTURE-PLANS.md](../FUTURE-PLANS.md) - 項目進度追蹤
- [requirements.md](../requirements.md) - 原始需求
- [FUTURE-PLANS-DETAILS.md](../FUTURE-PLANS-DETAILS.md) - 詳細 User Stories

---

## ✨ 成功指標

- [x] 規格完成（spec.md）
- [x] 計劃完成（plan.md）
- [x] 任務列表完成（tasks.md）
- [x] 分支建立（006-analytics-reporting）
- [ ] 所有 AC 驗收標準通過
- [ ] 所有 PERF 性能標準達成
- [ ] 95%+ 測試覆蓋
- [ ] 完整文檔和 API 說明

---

**最後更新**: 2025-12-05
**版本**: 1.0
**狀態**: ✅ 準備完成，可立即開始實作
