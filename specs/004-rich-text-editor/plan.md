# 實作計畫：富文本編輯器與多媒體支援

**分支**: `004-rich-text-editor` | **日期**: 2025-11-30 | **規格**: [spec.md](./spec.md)
**輸入**: 功能規格來自 `/specs/004-rich-text-editor/spec.md`

**注意**: 本範本由 `/speckit.plan` 命令填寫。執行工作流程請參閱 `.specify/templates/commands/plan.md`。

## 摘要

為電子報 CMS 系統增強富文本編輯能力，實作所見即所得編輯器以支援視覺化內容建立、多媒體整合（圖片、影片、音訊）、可切換的儲存後端（Supabase Storage/AWS S3），以及與現有 @uiw/react-md-editor 的雙向相容性。採用逐步遷移策略，保留現有 Markdown 編輯器作為備用選項，新編輯器作為主要介面，確保向後相容性並支援編輯器之間的無縫切換。

## 技術背景

**語言/版本**: TypeScript 5.3, React 18.2
**主要依賴**:
- 前端: Vite 5.0, React Router 6.20, Tailwind CSS 3.3
- 編輯器: @uiw/react-md-editor 4.0.8（現有）, WYSIWYG 編輯器待選（TipTap/Lexical/ProseMirror）
- 後端: Supabase 2.83.0（認證、資料庫、Storage）
- Markdown 處理: remark 15.0, remark-html 15.0, rehype-sanitize 5.0

**儲存**:
- PostgreSQL（Supabase 託管）- 文章內容與元資料
- Supabase Storage（預設）/ AWS S3（可選）- 媒體檔案儲存
- 儲存抽象層需實作以支援提供者切換

**測試**: Vitest 1.0, @testing-library/react 14.0, jsdom 23.0
**目標平台**: 現代網頁瀏覽器（Chrome、Firefox、Safari、Edge - 最新 2 個版本），回應式設計支援桌面、平板、行動裝置

**專案類型**: Web 應用程式（單頁應用 SPA）

**效能目標**:
- 圖片上傳與最佳化：5MB 以下檔案 <5 秒
- 編輯器輸入延遲：<100ms
- 頁面載入時間：<2 秒
- 編輯器切換時間：<2 秒
- 媒體庫搜尋回應：<1 秒（1000+ 檔案）

**限制**:
- 檔案大小限制：圖片 10MB，音訊 50MB
- 安全性：零 XSS 漏洞（需實作 HTML 清理）
- 儲存提供者切換：<1 小時配置變更時間
- 向後相容性：必須保留現有 Markdown 內容與 @uiw/react-md-editor 功能

**規模/範圍**:
- 支援 100+ 篇文章而不降低效能
- 媒體庫管理 1000+ 媒體檔案
- 多使用者編輯（非即時協作）
- 5 個使用者故事（3 個 P1, 2 個 P2, 1 個 P3）
- 23 個功能需求
- 預估 3-4 週開發時間

## 憲法檢查

*GATE: 必須在 Phase 0 研究前通過。Phase 1 設計後重新檢查。*

### I. 高品質第一 ✅
- **遵從**: 所有功能需求包含完整測試場景（5 個使用者故事，每個 4+ 驗收情境）
- **遵從**: 規格要求 80%+ 測試覆蓋率（SC-007: 零 XSS 漏洞，SC-008: 100% 自動儲存可靠性）
- **行動**: Phase 1 將設計測試策略，包含單元、整合、E2E 測試

### II. 可測試性設計 ✅
- **遵從**: 所有驗收標準使用 Given-When-Then 格式
- **遵從**: 儲存抽象層設計（FR-008）確保外部依賴可注入與模擬
- **行動**: Phase 1 將定義儲存介面、編輯器適配器模式以支援測試隔離

### III. MVP 優先，拒絕過度設計 ✅
- **遵從**: 使用者故事按優先級分級（P1: 文字編輯+圖片, P2: 影片+音訊, P3: Markdown 雙向轉換）
- **遵從**: 每個使用者故事獨立可測試與部署
- **遵從**: 逐步遷移策略避免「大爆炸」式重寫
- **遵從**: 超出範圍明確定義（OS-001 到 OS-009）避免功能蔓延
- **行動**: Phase 2 任務分解將遵循優先級順序，確保 P1 功能先行

### IV. 中文優先，清晰溝通 ✅
- **遵從**: 所有規格、計畫文件使用繁體中文
- **遵從**: 現有程式碼註釋已使用中文（參考 ArticleEditor.tsx）
- **行動**: 新程式碼將延續中文註釋慣例

### V. 簡潔和務實 ✅
- **遵從**: 儲存抽象層（FR-008）有明確業務理由（支援 Supabase/S3 切換）
- **遵從**: 保留現有 @uiw/react-md-editor 而非完全重寫（務實方案）
- **遵從**: WYSIWYG 編輯器選擇推遲到 Phase 0 研究（避免過早決策）
- **行動**: Phase 0 將評估編輯器函式庫時優先考慮簡潔性與整合複雜度

**憲法合規狀態**: ✅ **通過** - 無違規，所有原則已遵從

## 專案結構

### 文件（本功能）

```text
specs/004-rich-text-editor/
├── plan.md              # 本檔案 (/speckit.plan 命令輸出)
├── research.md          # Phase 0 輸出（技術決策與研究）
├── data-model.md        # Phase 1 輸出（資料模型設計）
├── quickstart.md        # Phase 1 輸出（開發快速入門）
├── contracts/           # Phase 1 輸出（API 契約定義）
│   ├── storage-api.ts       # 儲存抽象介面
│   ├── editor-api.ts        # 編輯器適配器介面
│   └── media-api.ts         # 媒體管理 API
|── docs/                # Phase 1 輸出（開發快速入門）
└── tasks.md             # Phase 2 輸出（由 /speckit.tasks 命令生成 - 非 /speckit.plan 建立）
```

### 原始碼（儲存庫根目錄）

```text
src/
├── components/
│   ├── ArticleEditor.tsx              # 現有 - 使用 @uiw/react-md-editor
│   ├── RichTextEditor.tsx             # 新增 - WYSIWYG 主編輯器
│   ├── MediaUploader.tsx              # 新增 - 圖片/音訊上傳元件
│   ├── MediaLibrary.tsx               # 新增 - 媒體庫瀏覽器
│   ├── VideoEmbed.tsx                 # 新增 - YouTube 影片嵌入
│   └── AudioPlayer.tsx                # 新增 - 音訊播放器元件
│
├── services/
│   ├── markdownService.ts             # 現有 - 基本 Markdown 轉換
│   ├── storageService.ts              # 新增 - 儲存抽象層
│   ├── mediaService.ts                # 新增 - 媒體管理服務
│   ├── contentConverter.ts            # 新增 - 富文本 ↔ Markdown 轉換
│   └── htmlSanitizer.ts               # 新增 - XSS 防護 HTML 清理
│
├── hooks/
│   ├── useMediaUpload.ts              # 新增 - 媒體上傳 hook
│   └── useAutoSave.ts                 # 新增 - 自動儲存 hook
│
├── adapters/                          # 新增 - 適配器層
│   ├── SupabaseStorageAdapter.ts     # Supabase Storage 實作
│   ├── S3StorageAdapter.ts            # AWS S3 實作（可選）
│   └── EditorAdapter.ts               # WYSIWYG 編輯器適配器
│
└── types/
    ├── index.ts                       # 現有 - 共享類型
    ├── media.ts                       # 新增 - 媒體相關類型
    ├── storage.ts                     # 新增 - 儲存介面類型
    └── editor.ts                      # 新增 - 編輯器類型定義

tests/
├── unit/
│   ├── services/
│   │   ├── contentConverter.test.ts
│   │   ├── htmlSanitizer.test.ts
│   │   └── storageService.test.ts
│   └── adapters/
│       └── SupabaseStorageAdapter.test.ts
│
├── components/
│   ├── RichTextEditor.test.tsx
│   ├── MediaUploader.test.tsx
│   └── MediaLibrary.test.tsx
│
└── integration/
    ├── media-upload-flow.test.tsx     # 媒體上傳流程測試
    └── content-preservation.test.tsx  # 內容保真度測試
```

**結構決策**:
- 採用 Web 應用單頁架構（現有專案結構）
- 新增 `adapters/` 目錄實作儲存抽象模式（符合憲法 V: 簡潔和務實）
- 保留現有 `ArticleEditor.tsx` 確保向後相容
- 測試結構鏡像原始碼結構（現有慣例）
- 媒體相關類型集中在 `types/media.ts`（新增）

## 複雜度追蹤

> **僅在憲法檢查發現違規且必須正當化時填寫**

本計畫無憲法違規，此表格保留為空。

| 違規 | 為何需要 | 為何拒絕更簡單的替代方案 |
|------|----------|-------------------------|
| N/A  | N/A      | N/A                     |
