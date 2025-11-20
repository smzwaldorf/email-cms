# Implementation Plan: 增強型無密碼認證系統

**分支**: `003-passwordless-auth` | **日期**: 2025-11-20 | **規格**: [spec.md](./spec.md)
**輸入**: 功能規格來自 `/specs/003-passwordless-auth/spec.md`

**附註**: 此計畫由 `/speckit.plan` 命令填寫。詳見 `.specify/templates/commands/plan.md` 執行工作流程。

## 摘要

本功能實施 Google OAuth 2.0 和魔法連結（Magic Link）無密碼認證系統，搭配多裝置工作階段管理、角色型存取控制 (RBAC) 和完整的稽核日誌。技術方案採用 Supabase 作為認證後端，JWT 權杖（15 分鐘存取 / 30 天重新整理），PostgreSQL 資料庫，以及電子郵件服務用於魔法連結傳遞。前端採用 React 18 + TypeScript，後端採用 TypeScript + Node.js（假設現有）。MVP 聚焦於 P1 優先級使用者故事（Google OAuth、魔法連結、RBAC、工作階段管理、稽核日誌），P2 項目（帳號連結、電子郵件變更）在後續迭代中實施。

## Technical Context

**前端語言/版本**: React 18, TypeScript 5, Vite 5
**前端主要依賴**: Supabase Client, React Router v6, TailwindCSS 3
**後端語言/版本**: TypeScript, Node.js 18+ (假設現有)
**後端主要依賴**: Supabase (Auth + PostgreSQL), Express.js 或類似 (假設現有)
**存儲**: PostgreSQL (via Supabase) + Redis 用於工作階段快取（選項）
**測試框架**: Vitest (前端), Jest 或 Mocha (後端 - 假設現有)
**目標平台**: Web 應用（React 瀏覽器），API 伺服器 (Node.js)
**專案類型**: Web 應用 (前端 + 後端)
**效能目標**: 登入完成 <2 分鐘，魔法連結傳遞 <2 分鐘（95%），頁面載入 <3 秒（4G），1000 並行請求無錯誤
**約束條件**: 稽核日誌延遲 <10 秒，99.9% OAuth 成功率，零個未授權存取事件，速率限制生效（每電子郵件每小時 5 個、每 IP 每小時 10 個失敗）
**規模/範圍**: 5000+ 活躍使用者，42 個功能需求，7 個關鍵實體，15 個成功標準

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### 原則 I: 高品質第一 (Quality First) ✅
- **檢查**: 規格包含 42 個功能需求、15 個成功標準、20+ 驗收情景、8 個邊界情況
- **檢查**: 計畫包含數據模型、API 契約、快速開始指南
- **檢查**: 測試框架已定義（Vitest 前端、後端測試框架待確認）
- **狀態**: **通過** - 專案設計以測試覆蓋為目標

### 原則 II: 可測試性設計 (Testability by Design) ✅
- **檢查**: 所有 7 個使用者故事包含驗收情景（Given-When-Then 格式）
- **檢查**: 功能需求清晰且可驗證（42 個具體需求）
- **檢查**: 外部依賴清晰（Google OAuth、Supabase、電子郵件服務）
- **狀態**: **通過** - 設計允許獨立單元測試、整合測試和端對端測試

### 原則 III: MVP 優先，拒絕過度設計 (MVP-First) ✅
- **檢查**: P1 優先級：5 個使用者故事（Google OAuth、魔法連結、RBAC、工作階段管理、稽核日誌）
- **檢查**: P2 優先級：2 個使用者故事（帳號連結、電子郵件變更 - 延後實施）
- **檢查**: 核心價值明確：無密碼認證 + 多裝置工作階段 + 安全稽核
- **狀態**: **通過** - MVP 邊界清晰，P2 項目明確延後

### 原則 IV: 中文優先 (Chinese First) ✅
- **檢查**: 規格全文使用正體中文
- **檢查**: 計畫文件使用中文（此文件）
- **檢查**: Git 提交訊息使用中文
- **狀態**: **通過** - 所有文件和溝通使用正體中文

### 原則 V: 簡潔和務實 (Simplicity & Pragmatism) ✅
- **檢查**: 核心概念：「無密碼認證 + JWT 工作階段 + RBAC」
- **檢查**: 依賴最小化：使用 Supabase 作為整合認證 + 資料庫後端
- **檢查**: 無預先過度設計：實施計畫聚焦於 P1 功能
- **狀態**: **通過** - 技術方案簡潔，所有決策有明確理由

### 最終憲法檢查: ✅ **全部通過 - 可以進行 Phase 0 研究**

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

此專案採用 **Web 應用架構**（前端 + 後端分離）。以下是認證功能的源碼組織：

```text
src/  (前端 - React)
├── components/
│   ├── LoginPage.tsx               # 登入頁面（Google OAuth + 魔法連結）
│   ├── OAuthFlow.tsx               # Google OAuth 流程
│   ├── MagicLinkForm.tsx           # 魔法連結輸入表單
│   ├── SessionManager.tsx          # 工作階段管理（使用者側）
│   ├── AccountSettings.tsx         # 帳號設定（電子郵件變更、工作階段列表）
│   └── auth/
│       ├── ProtectedRoute.tsx      # RBAC 路由保護
│       └── AuthProvider.tsx        # 認證上下文提供者
├── context/
│   ├── AuthContext.tsx             # 使用者認證狀態
│   └── SessionContext.tsx          # 工作階段狀態
├── services/
│   ├── authService.ts             # 前端認證邏輯（OAuth、魔法連結）
│   ├── supabaseClient.ts          # Supabase 客戶端配置
│   └── tokenManager.ts            # JWT 權杖管理（存取 + 重新整理）
├── hooks/
│   ├── useAuth.ts                 # 認證 hook
│   └── useSession.ts              # 工作階段 hook
└── types/
    └── auth.ts                    # 認證相關類型定義

tests/
├── components/
│   ├── LoginPage.test.tsx         # 登入頁面測試
│   └── SessionManager.test.tsx    # 工作階段管理測試
├── integration/
│   ├── oauth-flow.test.ts         # OAuth 完整流程測試
│   ├── magic-link-flow.test.ts    # 魔法連結流程測試
│   └── rbac.test.ts               # RBAC 授權測試
└── unit/
    ├── tokenManager.test.ts       # 權杖管理測試
    └── authService.test.ts        # 認證服務單元測試

backend/  (後端 - 假設現有)
├── src/
│   ├── auth/
│   │   ├── oauth.ts               # Google OAuth 驗證邏輯
│   │   ├── magic-link.ts          # 魔法連結生成 + 驗證
│   │   ├── token.ts               # JWT 簽發和驗證
│   │   └── rbac.ts                # 角色型存取控制中間件
│   ├── models/
│   │   ├── User.ts
│   │   ├── AuthMethod.ts
│   │   ├── Session.ts
│   │   ├── MagicLinkToken.ts
│   │   ├── AuthEvent.ts           # 稽核日誌
│   │   └── UserRole.ts
│   ├── services/
│   │   ├── authService.ts         # OAuth、魔法連結 + 帳號邏輯
│   │   ├── sessionService.ts      # 工作階段管理
│   │   ├── auditService.ts        # 稽核日誌
│   │   ├── emailService.ts        # 魔法連結電子郵件發送
│   │   └── rateLimit.ts           # 速率限制中間件
│   ├── api/
│   │   ├── auth.routes.ts         # 認證端點
│   │   ├── session.routes.ts      # 工作階段端點
│   │   ├── user.routes.ts         # 使用者帳號端點
│   │   ├── admin.routes.ts        # 管理員工作階段管理端點
│   │   └── audit.routes.ts        # 稽核日誌端點
│   └── middleware/
│       ├── auth.ts                # 認證中間件
│       └── rbac.ts                # RBAC 授權中間件
└── tests/
    ├── oauth.test.ts
    ├── magic-link.test.ts
    ├── session-management.test.ts
    ├── rbac.test.ts
    └── audit-logging.test.ts

database/
├── migrations/
│   ├── 001_create_users.sql       # 使用者表
│   ├── 002_create_auth_methods.sql
│   ├── 003_create_sessions.sql
│   ├── 004_create_magic_link_tokens.sql
│   ├── 005_create_auth_events.sql # 稽核日誌表
│   └── 006_create_user_roles.sql
└── seeds/
    └── initial-roles.sql          # 4 個角色初始化
```

**架構決策**: 採用 **Web 應用架構**（React 前端 + Node.js 後端），使用 Supabase 作為認證和資料庫整合層。前端負責 OAuth 流程和魔法連結驗證 UI，後端負責權杖簽發、工作階段管理和稽核日誌。認證中間件強制執行 RBAC 和速率限制。

## Complexity Tracking

**沒有憲法違規** - 所有決策都符合專案憲法的五項核心原則。此計畫無需複雜度辯護。

---

## Phase 0: 研究 (Research)

**狀態**: 準備開始 ✅

### 待研究的不確定因素

基於 Technical Context，以下是需要解決的研究任務：

1. **Supabase Auth 最佳實踐** - Google OAuth 與魔法連結整合在 Supabase 中的推薦模式
2. **JWT 權杖管理策略** - 前端權杖存儲（localStorage vs sessionStorage vs memory）和自動重新整理機制
3. **RLS (Row-Level Security) 策略** - PostgreSQL RLS 政策用於 RBAC 實施
4. **電子郵件傳遞可靠性** - 選擇魔法連結電子郵件服務和重試機制
5. **工作階段快取** - Redis 或 Supabase 實時資料庫用於多裝置工作階段同步
6. **稽核日誌設計** - 事件架構用於高效的稽核追蹤和查詢
7. **速率限制實施** - Supabase 函數、Express 中間件或專用服務的速率限制

### 研究產出

所有研究結果將在 `research.md` 文件中記錄，格式如下：
- **決策**: 選擇了什麼
- **理由**: 為什麼選擇
- **考慮的替代方案**: 評估了什麼

---

## Phase 1: 設計 & 契約 (Design & Contracts)

**狀態**: 待 Phase 0 完成 (等待 research.md)

### 產出物

- `data-model.md` - 7 個關鍵實體、欄位、關係和驗證規則
- `contracts/` - API 端點 OpenAPI 規格 (認證、工作階段、使用者、管理員、稽核日誌)
- `quickstart.md` - 開發者快速開始指南（環境設定、Supabase 設定、本地測試）
- Agent 上下文更新 - 新增認證相關技術堆棧

---

## Phase 2: 實施任務 (Implementation Tasks)

**狀態**: 待 Phase 1 完成 (由 `/speckit.tasks` 命令執行)

任務生成將由 `/speckit.tasks` 命令執行，輸出 `tasks.md`，包含：
- 分解為 2 週衝刺的實施任務
- P1 優先級故事的任務依賴圖
- 每個任務的測試標準
- 風險和緩解策略
