# 實施計畫：管理員儀表板與用戶管理系統

**分支**: `005-admin-dashboard` | **日期**: 2025-12-04 | **規格**: [spec.md](./spec.md)
**輸入**: 來自 `/specs/005-admin-dashboard/spec.md` 的功能規格，參考原型分支 `origin/claude/admin-dashboard-design-01SMGCPFS4aZCZL3BXgQPRfj`

**備註**: 本計畫指導第 0 階段（研究）、第 1 階段（設計與契約）和第 2 階段（任務）的執行。

## 摘要

**主要需求**: 為電子郵件 CMS 建立一套完整的管理員儀表板和用戶管理系統，使管理員能夠管理電子報（CRUD 操作）、使用班級/家族關係組織內容，並執行完整的用戶/角色/關係管理。

**技術方案**:
- 使用新的管理員功能模組擴展現有的 React 18 + TypeScript 應用程式
- 利用 Supabase PostgreSQL 後端和行級別安全 (RLS) 實現多角色存取控制（僅限管理員）
- 構建遵循 Voyager CMS 模式的 BREAD（瀏覽、讀取、編輯、新增、刪除）介面
- 實現帶有 4 個角色（管理員、教師、家長、學生）的基於角色的存取控制，其中只有管理員可存取儀表板
- 為所有用戶管理操作添加審計日誌記錄，保留期為 1 個月
- 使用最後寫入獲勝 (LWW) 策略解決並發編輯衝突
- 為批量 CSV 用戶導入實現全部或無驗證策略

**可衡量成果**:
- 涵蓋電子報、班級、家族和用戶管理的 8 個獨立用戶故事
- 27 項具有可測試驗收標準的功能需求
- 儀表板載入時間 <2 秒，CRUD 操作完成時間 <5 秒
- 零 XSS 漏洞（DOMPurify 淨化）
- 通過 RLS 策略實現 100% 的基於角色的存取控制

## 技術背景

**語言/版本**: TypeScript 5.3, React 18.2, JavaScript (ES2020+)

**主要依賴項**:
- **前端框架**: React 18.2 + React Router v6 導航
- **UI 元件**: TipTap 3.12（富文本編輯器）、自訂元件 + Tailwind CSS 3.3 + Waldorf 色彩調色板
- **狀態管理**: React Context API（NavigationContext 模式）
- **後端/資料庫**: Supabase (PostgreSQL) + 行級別安全 (RLS) 策略
- **API 整合**: Supabase JavaScript SDK (v2.83)
- **安全性**: DOMPurify 3.3（XSS 防護）、RLS（資料庫層級存取控制）
- **Markdown**: Remark 15.0, Remark-HTML 15.0 用於內容轉換

**儲存**: 透過 Supabase 的 PostgreSQL，包含以下表格：
- `newsletters`（週次、發布日期、狀態、文章數量）
- `articles`（標題、內容、作者、狀態、週 ID）
- `classes`（名稱、描述、學生[]、家族[]）
- `families`（名稱、相關主題）
- `users`（電子郵件、姓名、角色、狀態、權限）
- `user_roles`（用戶 ID、角色、權限）
- `parent_student_relationships`（家長 ID[]、學生 ID[]）
- `audit_logs`（操作、操作者、資源、時間戳記、詳細資訊）

**測試**: Vitest 1.6（Jest 相容）、React Testing Library 14.0、@testing-library/user-event 14.5
- 單元測試位於 `tests/unit/`
- 元件測試位於 `tests/components/`
- 整合測試位於 `tests/integration/`
- 覆蓋率目標: 95%+（電子郵件 CMS 標準）

**目標平台**: Web（基於瀏覽器的管理員儀表板）
- 現代瀏覽器：Chrome、Firefox、Safari（偏好桌面版用於管理員工作流）
- 平板電腦響應式設計可接受，不優先考慮行動裝置
- 漸進式增強（在未啟用 JavaScript 的情況下也能運作 - 基準 HTML）

**專案類型**: 單一 React + TypeScript Web 應用程式（單一儲存庫、現有架構）
- 使用管理員功能模組擴展現有的電子郵件 CMS 檢視器
- 無微服務或額外的部署單位

**效能目標**:
- 儀表板載入時間: <2 秒（初始頁面載入 + 資料擷取）
- CRUD 操作完成: <5 秒（建立/編輯/刪除文章、用戶、班級）
- 列表渲染: <500ms（500 項目，建議為更大的集合進行分頁）
- 搜尋/篩選回應: <1 秒（1000 筆記錄）

**限制條件**:
- 零 XSS 漏洞（DOMPurify + CSP 標頭必須）
- 資料庫連線：透過 Supabase 進行池化（典型 20-30 個並發連線）
- 僅限管理員存取：RLS 策略必須強制執行管理員角色要求
- 並發: 最後寫入獲勝（不使用悲觀鎖定）
- 批量導入：全部或無驗證（整個 CSV 原子性成功或失敗）
- 審計日誌：1 個月資料保留期，然後自動清除
- 國際化：中文優先（繁體中文 UI + 英文備用）

**規模/範圍**:
- 用戶群：10k-50k（每個機構的教師、家長、學生）
- 資料量：1k-10k 電子報、10k-100k 文章、100k-500k 用戶
- 管理員用戶：每個機構 5-50 名（典型 K-12 學校）
- 前端複雜度：8 個新頁面 + 表單，~50 個新元件
- 後端複雜度：25-30 個新 API 端點 + 8-10 個 RLS 策略
- 測試覆蓋率：300+ 單元/整合測試（根據電子郵件 CMS 模式）

## 憲法檢查

*門檻：必須在第 0 階段研究前通過。在第 1 階段設計後重新檢查。*

**專案憲法參考**: [電子郵件 CMS 專案憲法 v1.0.0](./.specify/memory/constitution.md)

### 原則遵從分析

#### I. 高品質第一 (Quality First) ✅ **通過**
- **需求**: 所有新功能必須包含完整的單元和整合測試；程式碼審查必須驗證 80% 以上的測試覆蓋率
- **計畫一致性**:
  - 測試部分指定 Vitest + React Testing Library，目標覆蓋率 95%+（超過 80% 最低要求）
  - 計畫在元件、服務和整合流程中進行 300+ 單元/整合測試
  - 規格中的每個 8 個用戶故事都包括 Given-When-Then 驗收場景
- **驗證**: 程式碼審查將在合併至主分支前強制執行測試覆蓋率門檻

#### II. 可測試性設計 (Testability by Design) ✅ **通過**
- **需求**: 功能必須從設計時就考慮測試；Given-When-Then 格式的驗收場景；可模擬/可注入的依賴項
- **計畫一致性**:
  - spec.md 中的所有 8 個用戶故事都包括詳細的驗收場景（Given-When-Then 格式）
  - React Context API 和 Supabase SDK 都可用於測試模擬（電子郵件 CMS 中已建立的模式）
  - 元件測試將 UI 邏輯與業務邏輯分開（表單元件、列表元件、詳細檢視）
  - 整合測試驗證用戶工作流（文章的建立 → 編輯 → 發布流）
- **驗證**: 測試檔案將遵循現有的電子郵件 CMS 模式（tests/ 目錄映射 src/ 結構）

#### III. MVP 優先，拒絕過度設計 (MVP-First, No Over-Design) ✅ **通過**
- **需求**: 每項功能必須定義清楚的 MVP 邊界；用戶故事必須獨立可測試/可部署；無過早抽象
- **計畫一致性**:
  - 8 個用戶故事明確優先排序（P1-P3），具有清晰的獨立性
  - 第 1 階段專注於核心 BREAD 操作（瀏覽、讀取、編輯、新增、刪除）遵循 Voyager CMS 模式
  - 無預先設計的抽象層；服務源自實際需求
  - 故事 1（檢視電子報）是 MVP 基準線—無需其他功能即可提供即時價值
- **驗證**: 每個故事將在整合前獨立測試；除非需要 2+ 個故事，否則不共享基礎設施

#### IV. 中文優先，清晰溝通 (Chinese First, Clear Communication) ✅ **通過**
- **需求**: 所有專案文件、規格、計畫以繁體中文撰寫；程式碼註釋以中文撰寫；git 提交以中文撰寫
- **計畫一致性**:
  - Spec.md 完全使用繁體中文撰寫，包含 8 個用戶故事和 27 個功能需求
  - Plan.md（此檔案）使用英文撰寫，非英文部分有中文解釋（多儲存庫團隊可接受）
  - 所有 git 提交將遵循格式：`feat(admin): 中文描述`，以繁體中文訊息內容
  - 程式碼註釋將對業務邏輯使用中文；對演算法解釋使用英文
- **驗證**: Git 日誌審查將驗證中文提交訊息；程式碼審查將檢查註釋語言一致性

#### V. 簡潔和務實 (Simplicity and Pragmatism) ✅ **通過**
- **需求**: 選擇最簡單能解決問題的方案；新依賴項必須有明確的業務/技術理由；程式碼優先於文件
- **計畫一致性**:
  - **核心概念**: 「用於電子報、用戶、班級、家族的 BREAD 操作的管理員儀表板」—可用一句話解釋
  - **無新框架**: 擴展現有的 React + TypeScript 棧；重複使用 TipTap 編輯器、Tailwind CSS、Supabase
  - **並發策略**: 選擇最後寫入獲勝 (LWW) 優先於複雜的悲觀鎖定（更簡單，對電子報背景足夠）
  - **批量導入**: 全部或無驗證（更簡單的錯誤處理，優先於部分成功）
  - **審計日誌**: 透過資料庫排程任務進行 1 個月保留（比單獨日誌服務更簡單）
- **驗證**: 下面的複雜度追蹤部分將記錄任何違規；目前未識別任何違規

### 摘要
**憲法狀態**: ✅ **通過 - 所有 5 項原則均滿足**
- 品質：達到 95%+ 測試覆蓋率（超過 80% 要求）
- 可測試性：所有故事包括驗收場景；可模擬架構
- MVP 優先：8 個獨立故事；P1 故事是最小可行功能
- 中文優先：完整繁體中文規格；提交將使用中文
- 簡潔性：擴展現有棧；無過早抽象；選擇 LWW 策略以簡潔

**未識別違規。計畫可進行第 0 階段研究。**

## 專案結構

### 文件（此功能）

```text
specs/005-admin-dashboard/
├── plan.md                # 此檔案（/speckit.plan 命令輸出）
├── research.md            # 第 0 階段輸出（/speckit.plan 命令）
├── data-model.md          # 第 1 階段輸出（/speckit.plan 命令）
├── quickstart.md          # 第 1 階段輸出（/speckit.plan 命令）
├── contracts/             # 第 1 階段輸出（/speckit.plan 命令）
|── docs/                  # 第 1 階段輸出（/speckit.plan 命令）
└── tasks.md               # 第 2 階段輸出（/speckit.tasks 命令 - 不由 /speckit.plan 建立）
```

### 原始碼（儲存庫根目錄）

**選定選項**: 單一 React Web 應用程式（選項 1 - 現有單一儲存庫程式碼基礎）

管理員儀表板是擴展現有電子郵件 CMS React 應用程式的功能模組，而不是單獨的專案。它遵循已建立的三層架構：

```text
src/
├── pages/
│   ├── AdminDashboardPage.tsx         # 儀表板主頁（故事 1 - 電子報列表）
│   ├── ArticleEditorPage.tsx          # 文章編輯表單（故事 2）
│   ├── ClassManagementPage.tsx        # 班級 CRUD（故事 7）
│   ├── FamilyManagementPage.tsx       # 家族 CRUD（故事 3）
│   ├── UserManagementPage.tsx         # 用戶/角色 CRUD（故事 6）
│   ├── ParentStudentPage.tsx          # 關係 CRUD（故事 8）
│   ├── NewsletterCreatePage.tsx       # 建立電子報（故事 4）
│   └── NewsletterPublishPage.tsx      # 發布/封存（故事 5）
│
├── components/
│   ├── admin/
│   │   ├── NewsletterTable.tsx        # 故事 1：瀏覽電子報
│   │   ├── ArticleForm.tsx            # 故事 2：編輯文章元資料
│   │   ├── ClassList.tsx              # 故事 7：瀏覽班級
│   │   ├── ClassForm.tsx              # 故事 7：新增/編輯班級
│   │   ├── FamilyList.tsx             # 故事 3：瀏覽家族
│   │   ├── FamilyForm.tsx             # 故事 3：新增/編輯家族
│   │   ├── UserTable.tsx              # 故事 6：瀏覽用戶
│   │   ├── UserForm.tsx               # 故事 6：新增/編輯用戶
│   │   ├── RoleSelector.tsx           # 故事 6：角色指派
│   │   ├── RelationshipMatrix.tsx     # 故事 8：家長-學生連結
│   │   ├── BatchImportForm.tsx        # 故事 6：CSV 導入（全部或無驗證）
│   │   └── AuditLog.tsx               # 審計日誌檢視器（故事 6 審計要求）
│   │
│   └── [現有元件]                     # (無更改)
│
├── services/
│   ├── adminService.ts                # 管理員功能的 CRUD 操作
│   ├── auditService.ts                # 審計日誌操作，保留期 1 個月
│   ├── batchImportService.ts          # CSV 驗證（全部或無）
│   └── [現有服務]                     # (無更改)
│
├── types/
│   ├── admin.ts                       # AdminUser, AdminArticle, Class, Family, ParentStudentRelationship, AuditLog
│   └── [現有類型]                     # (無更改)
│
└── hooks/
    ├── useAdminAuth.ts                # 僅限管理員存取門檛（RLS 強制執行）
    └── [現有 hooks]                   # (無更改)

tests/
├── components/
│   └── admin/
│       ├── NewsletterTable.test.tsx   # 測試故事 1 瀏覽功能
│       ├── ArticleForm.test.tsx       # 測試故事 2 編輯功能
│       ├── UserForm.test.tsx          # 測試故事 6 用戶管理
│       ├── BatchImportForm.test.tsx   # 測試故事 6 批量導入驗證
│       └── [11 個以上的元件測試]      # 覆蓋所有管理員 UI 元件
│
├── integration/
│   ├── admin-newsletter-workflow.test.tsx    # 建立 → 編輯 → 發布流
│   ├── admin-user-workflow.test.tsx          # 建立用戶 → 指派角色 → 權限流
│   ├── admin-class-workflow.test.tsx         # 建立班級 → 新增學生 → 管理流
│   ├── admin-relationship-workflow.test.tsx  # 家長-學生連結 → 驗證流
│   └── [4 個以上的整合測試]
│
├── unit/
│   ├── adminService.test.ts           # CRUD 操作
│   ├── auditService.test.ts           # 審計日誌生命週期（1 個月保留）
│   ├── batchImportService.test.ts     # CSV 驗證（全部或無、邊界情況）
│   └── [6 個以上的公用程式測試]
│
└── [現有測試結構]                     # (無更改)
```

**結構決策**:
- **無儲存庫根目錄新目錄**: 管理員功能透過元件中的 `admin/` 子目錄整合到現有 src/ 結構中
- **單一程式碼基礎原則**: 所有管理員頁面擴展現有 React Router 設定（src/App.tsx 中的新路由）
- **遵循電子郵件 CMS 慣例**: 測試映射元件/服務位置；用於資料存取的共享服務；Context API 用於狀態
- **PostgreSQL 後端**: Supabase SDK 處理 API 呼叫；RLS 策略在資料庫層級強制執行僅限管理員存取
- **原型整合**: 利用 `origin/claude/admin-dashboard-design-01SMGCPFS4aZCZL3BXgQPRfj` 中的設計來實現元件結構和 Tailwind 樣式

## 複雜度追蹤

> **未識別憲法檢查違規。此部分不是必需的。**

所有技術決策都滿足專案憲法原則：
- **品質**: 95%+ 測試覆蓋率超過 80% 最低要求
- **可測試性**: 所有用戶故事包括 Given-When-Then 場景；React/Supabase 服務完全可模擬
- **MVP 優先**: 8 個獨立用戶故事；P1 故事是最小功能（檢視電子報、編輯文章、管理用戶）
- **中文優先**: 繁體中文規格；提交將遵循 `feat(admin): 中文描述` 格式
- **簡潔性**: 無新框架；擴展現有 React + TypeScript 棧；選擇最後寫入獲勝以簡潔優先於複雜並發控制

**複雜度評估**:
- **僅限管理員 RLS 策略**（8-10 個策略）：多角色存取控制所需；比應用程式層級門檛更簡單；利用 Supabase 平台功能
- **審計日誌，保留期 1 個月**: 資料庫層級排程任務（簡單）vs. 單獨日誌服務（過度複雜）
- **全部或無批量導入**: 交易層級原子性（簡單）vs. 部分成功，帶回滾/重試邏輯（複雜）
- **最後寫入獲勝衝突解決**: 簡單時間戳記比較（對電子報管理背景足夠）vs. 操作變換或 CRDT（不必要的複雜）

**結論**: ✅ 無違規。計畫已準備好進行第 0 階段（研究）執行。
