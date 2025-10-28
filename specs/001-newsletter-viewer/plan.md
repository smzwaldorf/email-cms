# 實現計畫：電子報閱讀 CMS Web App

**分支**: `001-newsletter-viewer` | **日期**: 2025-10-28 | **規格**: [spec.md](./spec.md)
**輸入**: 功能規格來自 `specs/001-newsletter-viewer/spec.md`

## 摘要

建立一個 Web 應用程式，用於查看和管理電子報內容。讀者可以按週瀏覽多篇文章，支援邊緣按鈕導航、工具列導航和直接連結訪問。編輯者可以管理週報內容順序和進行 CRUD 操作。

**核心價值**: 允許讀者輕鬆瀏覽週報內容，支援電子郵件深度連結分享。

## 技術背景

**語言/版本**: TypeScript (最新) + React 18+
**前端框架**: React + Vite (build tool)
**UI 庫**: shadcn/ui (基於 Radix UI + Tailwind CSS)
**樣式**: Tailwind CSS v3
**測試框架**: Vitest (單元測試) + React Testing Library (元件測試)
**目標平台**: 現代瀏覽器 (Chrome, Firefox, Safari, Edge)
**專案類型**: 單一 Web SPA (Single Page Application)
**效能目標**: 首次內容繪製 < 2 秒，文章切換 < 1 秒
**約束**: 無需後端（假設 API 由其他團隊提供或未來整合）
**規模**: 初期 100 篇文章/月，支援 1000 並行讀者

## 憲法檢查

*閘: 必須在第 0 階段研究前通過。第 1 階段設計後重新檢查。*

### 高品質第一 ✅
- **測試需求**: 所有元件和邏輯必須有單元測試（80%+ 覆蓋）
- **實施方案**: Vitest + React Testing Library
- **驗收**: 測試覆蓋率儀表板，PR 需 >80% 覆蓋

### 可測試性設計 ✅
- **需求**: 功能需求包含 Given-When-Then 場景，代碼可注入依賴
- **實施方案**: React hooks 支援依賴注入，易於模擬服務
- **驗收**: 每個使用者故事有對應的測試場景

### MVP 優先，拒絕過度設計 ✅
- **需求**: 無預先設計的抽象層，避免複雜狀態管理
- **實施方案**: 使用 React 內置 hooks (useState, useContext)，避免 Redux/Zustand
- **驗收**: 架構簡潔，易於理解和維護

### 中文優先，清晰溝通 ✅
- **需求**: 所有代碼註釋和文件使用正體中文
- **實施方案**: 代碼和 commit 訊息採用中文
- **驗收**: 代碼審查驗證中文文件品質

### 簡潔和務實 ✅
- **需求**: 選擇最簡單方案，避免複雜工具
- **實施方案**: Vite 代替 Webpack，Tailwind CSS 直接樣式，shadcn/ui 預構建元件
- **驗收**: 依賴數最少化，開發設置簡單

## 專案結構

### 文檔（此功能）

```text
specs/001-newsletter-viewer/
├── spec.md              # 功能規格
├── plan.md              # 此檔案（實現計畫）
├── research.md          # 第 0 階段產出（技術研究）
├── data-model.md        # 第 1 階段產出（資料模型）
├── quickstart.md        # 第 1 階段產出（快速入門）
├── contracts/           # 第 1 階段產出（API 契約）
└── checklists/          # 品質檢查清單
```

### 原始碼（儲存庫根目錄）

採用單一 Web SPA 結構：

```text
src/
├── pages/                    # 頁面元件
│   ├── ReaderPage.tsx        # 讀者閱讀頁面（核心）
│   ├── EditorPage.tsx        # 編輯者編輯頁面（P3）
│   └── ErrorPage.tsx         # 錯誤頁面
│
├── components/               # 可復用 UI 元件
│   ├── NewsletterViewer.tsx  # 閱讀容器
│   ├── ArticleContent.tsx    # 文章內容顯示
│   ├── NavigationBar.tsx     # 頂部工具列
│   ├── SideButton.tsx        # 邊緣導航按鈕
│   ├── ArticleList.tsx       # 文章清單
│   ├── PositionIndicator.tsx # 位置指示器（第 X 篇，共 Y 篇）
│   ├── LoadingSpinner.tsx    # 載入指示器
│   └── ErrorBoundary.tsx     # 錯誤邊界
│
├── services/                 # 業務邏輯與 API 調用
│   ├── newsApi.ts            # 週報 API 服務（假設外部 API）
│   ├── navigationService.ts  # 導航邏輯（上一篇、下一篇）
│   └── markdownService.ts    # Markdown 轉 HTML
│
├── hooks/                    # React 自訂 hooks
│   ├── useNewsletter.ts      # 週報資料管理
│   ├── useNavigation.ts      # 導航狀態管理
│   └── useArticleContent.ts  # 文章內容管理
│
├── types/                    # TypeScript 類型定義
│   └── index.ts              # 所有類型
│
├── utils/                    # 工具函式
│   ├── urlUtils.ts           # URL 生成與解析
│   └── formatters.ts         # 格式化函式
│
├── styles/                   # Tailwind CSS 設置
│   └── globals.css           # 全局樣式
│
├── App.tsx                   # 主應用程式
└── main.tsx                  # Vite 入口

tests/
├── unit/                     # 單元測試
│   ├── services/
│   ├── hooks/
│   └── utils/
│
├── components/               # 元件測試
│   ├── ArticleContent.test.tsx
│   ├── NavigationBar.test.tsx
│   └── ...
│
└── integration/              # 整合測試
    └── userJourneys.test.tsx # 使用者故事驗收測試

public/
├── index.html
└── assets/

package.json
tsconfig.json
vite.config.ts
vitest.config.ts
tailwind.config.ts
postcss.config.ts
```

**結構說明**: 採用 Option 1（單一 Web SPA）符合 MVP 原則。React 組件樹簡潔，易於測試和維護。Services 層抽象 API 調用和業務邏輯，便於模擬測試。

## 複雜度追蹤

無憲法違規。所有設計決策符合「高品質」、「可測試」、「拒絕過度設計」原則。
