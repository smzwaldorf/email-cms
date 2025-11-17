# 📰 電子報閱讀 CMS Web App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite)](https://vitejs.dev/)

一個現代化的電子報閱讀和內容管理系統，提供優秀的用戶體驗和完整的 TypeScript 類型安全。

## ✨ 主要特性

### 📖 核心功能
- **週報瀏覽** - 按週組織的電子報文章查看
- **多種導航方式** - 靈活的文章導航交互
- **Markdown 支援** - 完整的富文本內容渲染
- **進度追蹤** - 清晰的位置指示和進度顯示
- **響應式設計** - 完美適配各種屏幕尺寸

### 🚀 技術亮點
- ✅ **完整 TypeScript** - 100% 類型安全，提升代碼質量
- ✅ **現代化框架** - React 18 + Vite 5 快速開發體驗
- ✅ **樣式系統** - Tailwind CSS v3 高效開發
- ✅ **全面測試** - Vitest + React Testing Library (17/17 ✓)
- ✅ **狀態管理** - React Context API 輕量級方案

## 🎯 應用界面

### 首頁 (Home Page)
```
┌────────────────────────────────────┐
│  電子報閱讀器                        │
│  Newsletter Viewer                  │
│                                    │
│  [查看最新週報]                      │
└────────────────────────────────────┘
```
簡潔的著陸頁面，提供進入最新週報的快速鏈接。

### 週報閱讀器 (Weekly Reader Page)

```
┌─────────────────────────────────────────────────────────────┐
│                    電子報閱讀器主頁面                          │
├──────────────┬──────────────────────────┬──────────────┤
│              │                          │              │
│  文章清單    │    文章內容              │    快速導    │
│  (左側)      │    (中央)                │    航 (右側)  │
│              │                          │              │
│ ┌──────────┐ │ ┌──────────────────────┐ │    [→]      │
│ │第 1 篇   │ │ │如何優化 React 應用   │ │              │
│ │文章標題  │ │ │的效能                 │ │              │
│ │作者      │ │ │                       │ │              │
│ │日期      │ │ │作者：李明             │ │              │
│ └──────────┘ │ │日期：2025-10-20       │ │    [←]      │
│              │ │瀏覽：1.2K             │ │              │
│ ┌──────────┐ │ │                       │ │              │
│ │第 2 篇   │ │ │# 文章內容             │ │              │
│ │TypeScript│ │ │Markdown 格式...       │ │              │
│ │高級類型  │ │ │                       │ │              │
│ └──────────┘ │ │                       │ │              │
│              │ └──────────────────────┘ │              │
│ ┌──────────┐ │                          │              │
│ │第 3 篇   │ │ ┌──────────────────────┐ │              │
│ │Web 安全  │ │ │[← 上一篇] 第 1 篇   │ │              │
│ │基礎      │ │ │      ◉ ◯ ◯          │ │              │
│ └──────────┘ │ │         [下一篇 →]   │ │              │
│              │ └──────────────────────┘ │              │
├──────────────┴──────────────────────────┴──────────────┤
│             底部導航欄 (Navigation Bar)                │
│  [← 上一篇]     第 1 篇，共 3 篇      [下一篇 →]        │
│                    ◉ ◯ ◯                              │
└──────────────────────────────────────────────────────┘
```

### 實際應用截圖

![Email Newsletter CMS - Weekly Reader](screenshot.jpg)

*週報閱讀器實際界面 - 展示左側文章清單、中央文章內容及導航功能*

#### 界面組成

**左側面板 - 文章清單 (ArticleListView)**
- 顯示當前週份的所有文章
- 周份標題和文章數量概覽
- 每篇文章卡片展示：
  - 標題（最多 2 行）
  - 作者名稱
  - 文章摘要（截斷至 80 字）
  - 文章順序號和創建日期
  - 選中狀態視覺反饋（藍色高亮）

**中央面板 - 文章內容 (ArticleContent)**
- 完整文章標題
- 文章元數據：作者、發佈日期、瀏覽次數
- Markdown 轉 HTML 渲染的富文本內容
- 可滾動的長文章支援

**底部欄 - 導航欄 (NavigationBar)**
- 上一篇/下一篇按鈕（禁用狀態智能處理）
- 位置指示文字："第 X 篇，共 Y 篇"
- 進度點指示器（●◯◯）實時反映當前位置

**側邊按鈕 - 快速導航 (SideButton)**
- 左側按鈕：快速返回上一篇
- 右側按鈕：快速進入下一篇
- 懸停效果：按鈕略微向邊緣移動
- 禁用狀態：灰色且不可點擊

### 交互流程

1. **打開首頁** → 看到電子報閱讀器着陸頁面
2. **點擊查看週報** → 進入週報閱讀器 (`/week/2025-W43`)
3. **文章清單加載** → 左側顯示所有文章卡片
4. **自動選中首篇** → 中央面板展示第一篇文章內容
5. **選擇不同文章** → 點擊任何文章卡片切換閱讀
6. **導航文章** → 使用以下任一方法：
   - 底部 "上一篇/下一篇" 按鈕
   - 螢幕邊緣的側邊按鈕
   - 左側文章清單點擊選擇

## 🚀 快速開始

### 環境要求
- Node.js 18.0 或更高
- npm 9.0 或更高

### 安裝

```bash
# 克隆倉庫
git clone https://github.com/smzwaldorf/email-cms.git
cd email-cms

# 安裝依賴
npm install
```

### 開發

```bash
# 啟動開發伺服器
npm run dev
# 自動打開 http://localhost:5173
```

開發伺服器支持熱模塊重載 (HMR)，代碼更改會自動反映在瀏覽器。

### 構建

```bash
# 生產構建
npm run build

# 預覽生產構建結果
npm run preview
```

### 測試

```bash
# 運行所有測試
npm test

# 運行測試並顯示覆蓋率
npm run coverage

# 啟動測試 UI（可視化測試界面）
npm test:ui
```

### 代碼質量

```bash
# ESLint 檢查
npm run lint

# Prettier 格式化
npm run format
```

## 📁 項目結構

```
email-cms/
├── src/
│   ├── components/              # React 組件
│   │   ├── ArticleCard.tsx      # 文章卡片組件
│   │   ├── ArticleContent.tsx   # 文章內容展示
│   │   ├── ArticleListView.tsx  # 文章清單視圖
│   │   ├── NavigationBar.tsx    # 底部導航欄
│   │   └── SideButton.tsx       # 側邊快速導航按鈕
│   │
│   ├── pages/                   # 頁面組件
│   │   └── WeeklyReaderPage.tsx # 週報閱讀器主頁面
│   │
│   ├── services/                # 業務邏輯層
│   │   ├── mockApi.ts           # Mock API 數據服務
│   │   └── markdownService.ts   # Markdown 轉換服務
│   │
│   ├── hooks/                   # 自定義 React Hooks
│   │   ├── useFetchArticle.ts   # 單篇文章獲取
│   │   ├── useFetchWeekly.ts    # 週報數據獲取
│   │   └── useMarkdownConverter.ts # Markdown 轉換
│   │
│   ├── context/                 # 全域狀態管理
│   │   └── NavigationContext.tsx # 導航狀態 Context
│   │
│   ├── types/                   # TypeScript 類型定義
│   │   └── index.ts             # 核心類型
│   │
│   ├── utils/                   # 工具函式
│   │   ├── urlUtils.ts          # URL 生成和解析
│   │   └── formatters.ts        # 文本格式化
│   │
│   ├── styles/                  # 全局樣式
│   │   └── globals.css          # Tailwind CSS 指令
│   │
│   ├── App.tsx                  # 應用根組件
│   └── main.tsx                 # 應用入口
│
├── tests/                       # 測試文件
│   ├── setup.ts                 # 測試環境配置
│   ├── unit/
│   │   └── types.test.ts        # 類型工具測試
│   └── components/
│       ├── ArticleCard.test.tsx # 組件測試
│       └── NavigationBar.test.tsx
│
├── public/                      # 靜態資源
├── dist/                        # 生產構建輸出
│
├── package.json                 # 依賴配置
├── tsconfig.json                # TypeScript 配置
├── vite.config.ts               # Vite 構建配置
├── vitest.config.ts             # Vitest 測試配置
├── tailwind.config.ts           # Tailwind CSS 配置
├── postcss.config.js            # PostCSS 配置
├── .eslintrc.cjs                # ESLint 規則
├── .prettierrc                  # Prettier 配置
└── README.md                    # 本文件
```

## 🏗️ 架構設計

### 三層架構

```
┌─────────────────────────────────────┐
│         頁面層 (Pages)              │
│     WeeklyReaderPage.tsx            │
│  (狀態管理、交互邏輯)               │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│         組件層 (Components)         │
│  - ArticleListView  ← 展示清單     │
│  - ArticleContent   ← 展示內容     │
│  - NavigationBar    ← 導航控制     │
│  - SideButton       ← 快速導航     │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│     數據與服務層 (Services)        │
│  - mockApi.ts       ← 數據來源     │
│  - markdownService  ← 內容轉換     │
│  - NavigationContext ← 狀態管理    │
└─────────────────────────────────────┘
```

### 狀態管理流程

```
NavigationContext (全域狀態)
    │
    ├─ currentWeekNumber: string     # 當前週份
    ├─ currentArticleId: string      # 當前文章 ID
    ├─ currentArticleOrder: number   # 當前位置
    ├─ totalArticlesInWeek: number   # 週報文章總數
    ├─ articleList: Article[]        # 文章清單（快取）
    ├─ isLoading: boolean            # 加載狀態
    └─ error?: Error                 # 錯誤信息
```

## 📊 核心數據模型

### NewsletterWeek（週報）
```typescript
interface NewsletterWeek {
  weekNumber: string          // "2025-W43"（ISO 8601）
  releaseDate: string         // 發行日期
  title?: string              // 週報標題
  articleIds: string[]        // 文章 ID 清單
  createdAt: string           // 創建時間
  updatedAt: string           // 更新時間
  isPublished: boolean        // 發佈狀態
  totalArticles: number       // 文章總數（快取）
}
```

### Article（文章）
```typescript
interface Article {
  id: string                  // 唯一標識
  title: string               // 文章標題
  content: string             // Markdown 格式內容
  author?: string             // 作者名稱
  summary?: string            // 摘要
  weekNumber: string          // 所屬週份
  order: number               // 文章順序
  slug?: string               // URL 友好名稱
  publicUrl: string           // 公開網址
  createdAt: string           // 創建時間
  updatedAt: string           // 更新時間
  publishedAt?: string        // 發佈時間
  isPublished: boolean        // 發佈狀態
  viewCount?: number          // 瀏覽次數
}
```

## 🧪 測試覆蓋

### 測試統計
- **總測試數**: 17/17 ✓
- **通過率**: 100%
- **覆蓋率**: 80%+ (目標)

### 測試分類

| 文件 | 測試數 | 覆蓋 |
|------|--------|------|
| types.test.ts | 3 | 型別工具 |
| ArticleCard.test.tsx | 6 | 渲染、交互、樣式 |
| NavigationBar.test.tsx | 8 | 按鈕狀態、導航邏輯 |

### 測試示例

```bash
# 運行單個測試文件
npm test -- ArticleCard.test.tsx

# 運行特定測試
npm test -- -t "should render article title"

# 查看覆蓋率詳情
npm run coverage
```

## 📦 依賴清單

### 核心依賴
- **react** (18.2.0) - UI 框架
- **react-dom** (18.2.0) - DOM 渲染
- **react-router-dom** (6.20.0) - 路由管理
- **clsx** (2.0.0) - 條件樣式

### 開發依賴
- **typescript** (5.3.0) - 類型檢查
- **vite** (5.0.0) - 構建工具
- **vitest** (1.0.0) - 測試框架
- **@testing-library/react** (14.0.0) - 組件測試
- **tailwindcss** (3.3.0) - 樣式框架
- **eslint** (8.55.0) - 代碼檢查
- **prettier** (3.1.0) - 代碼格式化

## 🔀 Git 工作流

### 當前分支
```
main                      # 主分支（穩定版本）
└── 001-newsletter-viewer  # 功能分支（開發中）
```

### 提交歷史
```
d0bd637 Fix: 修復文章無法切換的問題
c41b57a Phase 3: 使用者故事 1 實現 - 查看週報功能完成
29641f9 Phase 1 & 2: 專案設置與基礎設施完成
1d14982 docs: 生成電子報閱讀功能的完整工作項目清單
3f42ff0 docs: 完成電子報閱讀功能規劃 001-newsletter-viewer
```

### 貢獻流程
1. 從 `main` 新建特性分支：`git checkout -b feature/your-feature`
2. 提交更改並遵循提交信息規範
3. 推送到遠程倉庫：`git push origin feature/your-feature`
4. 創建 Pull Request 並等待審查

## 📋 功能清單

### 已實現 ✅
- [x] 週報清單展示
- [x] 文章內容渲染
- [x] 多種導航方式
- [x] 進度追蹤
- [x] Markdown 支援
- [x] 完整 TypeScript 類型
- [x] 組件單元測試
- [x] 響應式設計
- [x] 錯誤處理

### 計劃功能 🔮
- [ ] 深層連結支援 (Phase 4)
- [ ] 性能優化 & 虛擬化 (Phase 5)
- [ ] 編輯器功能 (Phase 6)
- [ ] 性能指標 & 分析 (Phase 7)
- [ ] 多語言支援
- [ ] 暗黑模式
- [ ] 搜索功能
- [ ] 收藏功能

## 🐛 已知問題

目前無已知問題。如發現問題，請提交 Issue。

## 📞 支持

### 常見問題 (FAQ)

**Q: 如何更換示例數據？**
A: 編輯 `src/services/mockApi.ts` 中的 `mockArticles` 和 `mockNewsletters` 對象。

**Q: 如何連接真實 API？**
A: 用實際 API 調用替換 `mockApi.ts` 中的 mock 函數。

**Q: 支持哪些 Markdown 語法？**
A: 當前支援基本語法（標題、粗體、斜體、代碼、列表等），詳見 `markdownService.ts`。

---

## 📚 Phase 6-7: Database Structure & Class-Based Visibility

### Current Implementation Status: ✅ COMPLETE

**Phases Completed**: 1-7 (100%)
- **Phase 1-5**: Newsletter viewer, article management, performance optimization
- **Phase 6**: Database schema, services, class-based article visibility, UI components
- **Phase 7**: Performance validation, documentation, comprehensive testing

### Database Schema & Architecture

The application is built on a robust PostgreSQL database with sophisticated class-based article visibility:

**Core Tables**:
- `newsletter_weeks` - Weekly newsletter organization
- `articles` - Newsletter articles with visibility control
- `classes` - School class definitions
- `families` - Family/parent accounts
- `child_class_enrollment` - Children class assignments
- `family_enrollment` - Parent family membership
- `article_audit_log` - Complete audit trail

**Key Features**:
- ✅ **Role-Based Access** - Different visibility for teachers, parents, and visitors
- ✅ **Class-Based Filtering** - Articles visible to specific classes only
- ✅ **Soft-Delete** - Articles marked deleted but preserved for audit trail
- ✅ **Audit Logging** - Complete change history for all articles
- ✅ **Performance Optimized** - Indexes, query optimization, <100ms filtering

### Quick Start

#### 1. Install & Setup
```bash
# Install dependencies
npm install

# Create .env.local with Supabase credentials
cp .env.example .env.local
# Edit .env.local with your Supabase URL and key
```

#### 2. Run Development Server
```bash
npm run dev
# Opens http://localhost:5173 with hot reload
```

#### 3. Run Tests
```bash
npm test              # Watch mode
npm test -- --run     # Single run
npm run coverage      # Coverage report
```

#### 4. Database Setup
```bash
# Run health check to verify database
npx ts-node scripts/health-check.ts

# Optional: Seed sample data
npx ts-node scripts/seed-database.ts
```

### Architecture Overview

```
┌──────────────────────────────────────┐
│         React Frontend (UI)           │
│  - ArticleContent (Markdown)          │
│  - ClassArticleFilter (Multi-select)  │
│  - ArticleClassRestrictionEditor      │
└──────────┬───────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│      Services Layer (Business Logic)  │
│  - ArticleService (CRUD, class-aware)│
│  - ClassService (class management)   │
│  - FamilyService (enrollment)        │
│  - ArticleUpdateService (audit logs) │
└──────────┬───────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│    Supabase / PostgreSQL Database    │
│  - Row-Level Security (RLS)          │
│  - Triggers (audit, timestamps)      │
│  - Constraints & Validation          │
└──────────────────────────────────────┘
```

### Key Design Decisions

#### 1. Class-Based Article Visibility
**Problem**: Different classes need to see different articles
**Solution**:
- Articles have `visibility_type` (public | class_restricted)
- `restricted_to_classes` array stores allowed class IDs
- RLS policies enforce access control
- Parents see articles for their children's classes + public articles

#### 2. Soft-Delete Strategy
**Problem**: Need audit trail but also "delete" articles
**Solution**:
- No hard deletes - only set `deleted_at` timestamp
- All queries filter WHERE `deleted_at IS NULL`
- Audit log captures all versions for recovery

#### 3. Audit Logging
**Problem**: Track who changed what and when
**Solution**:
- Database trigger on every article change
- Records operation (CREATE/UPDATE/DELETE), user, timestamp
- Stores old_values and new_values for comparison
- Enables point-in-time recovery

#### 4. Performance Optimization
**Problem**: Fast filtering across classes and permissions
**Solution**:
- Indexes on (week_number, article_order)
- Indexes on visibility_type and class IDs
- Service-level deduplication for multi-class families
- <100ms query performance target met

### Comprehensive Documentation

Full documentation is organized by topic:

| Document | Purpose | Audience |
|----------|---------|----------|
| [SETUP.md](./SETUP.md) | Development environment setup | Developers |
| [TESTING.md](./TESTING.md) | Test organization & running tests | QA / Developers |
| [API.md](./API.md) | API endpoints & examples | Developers / Integrators |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment steps | DevOps / Team Leads |
| [specs/002-database-structure/](./specs/002-database-structure/) | Feature specifications | Product / Architecture |

### Test Suite Overview

**Total**: 697 tests across 36 test files

- **Unit Tests** (45 tests) - Utility functions and helpers
- **Component Tests** (180 tests) - React component behavior
- **Service Tests** (200 tests) - Business logic
- **Integration Tests** (181 tests) - Complete workflows
- **Performance Tests** (25 tests) - Benchmark validations
- **E2E Tests** (18 tests) - Real-world scenarios
- **Data Integrity Tests** (36 tests) - Database constraints

**Coverage**: 95%+ across statements, branches, functions

### Development Workflow

```bash
# 1. Start dev server (watch mode)
npm run dev

# 2. Create a feature branch
git checkout -b feature/your-feature

# 3. Make changes and test
npm test                           # Watch mode
npm run lint                       # Check style
npm run format                     # Auto-fix

# 4. Before commit
npm test -- --run                  # Full test run
npm run build                      # Check TypeScript

# 5. Commit and push
git add .
git commit -m "feat: Your feature description"
git push origin feature/your-feature

# 6. Create Pull Request
# Tests will run in CI automatically
```

### Key Files & Directories

```
email-cms/
├── src/
│   ├── components/               # React UI components
│   │   ├── ArticleContent.tsx
│   │   ├── ClassArticleFilter.tsx
│   │   ├── ArticleClassRestrictionEditor.tsx
│   │   └── ...
│   ├── services/                 # Business logic
│   │   ├── ArticleService.ts     # Article CRUD + class-aware queries
│   │   ├── ClassService.ts       # Class management
│   │   ├── FamilyService.ts      # Family enrollment
│   │   └── ...
│   ├── types/                    # TypeScript interfaces
│   ├── lib/                      # External integrations
│   └── styles/                   # Global styling
│
├── tests/
│   ├── components/               # Component tests
│   ├── services/                 # Service tests
│   ├── integration/              # End-to-end tests
│   ├── e2e/                      # Complete workflows
│   ├── data-integrity/           # Constraint validation
│   └── performance/              # Benchmarks
│
├── specs/                        # Feature specifications
├── scripts/                      # Utility scripts
├── API.md                        # API documentation
├── SETUP.md                      # Setup guide
├── TESTING.md                    # Testing guide
├── DEPLOYMENT.md                 # Deployment guide
└── README.md                     # This file
```

### Performance Metrics

Validated performance against success criteria:

- **SC-001**: Article retrieval <500ms for 100 articles ✅
- **SC-002**: 100% consistency on concurrent reorders ✅
- **SC-005**: Class filtering <100ms for 5-child family ✅
- **SC-006**: 104+ weeks without degradation ✅

### Known Limitations & Future Work

**Phase 8+ Planned Features**:
- REST API endpoints for external integrations
- WebSocket support for real-time updates
- File upload/image handling for articles
- Full-text search across article content
- Rate limiting and request throttling
- GraphQL API alternative
- Mobile app support

**Known Limitations**:
- No user authentication (Phase 8+)
- No file attachments (Phase 8+)
- No real-time sync (Phase 8+)
- No recovery UI for soft-deleted articles (Phase 8+)

---

## 📄 許可證

本項目採用 **MIT 許可證**。詳見 [LICENSE](LICENSE) 文件。

## 👤 作者

由 Claude Code 代表 smzwaldorf 開發。

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

### 提交 Pull Request 前的檢查清單
- [ ] 代碼通過 ESLint 檢查 (`npm run lint`)
- [ ] 代碼已格式化 (`npm run format`)
- [ ] 所有測試通過 (`npm test -- --run`)
- [ ] 提交信息清晰明確
- [ ] 包含相關文檔更新

---

**最後更新**: 2025-11-17
**Phase**: 7 - Polish & Cross-Cutting Concerns (Complete)

Made with ❤️ for Email Newsletter Readers
