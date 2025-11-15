# Email Newsletter CMS - 未來開發計畫詳細說明

**最後更新**: 2025-11-15

> 📋 **進度追蹤**：請參閱 [`FUTURE-PLANS.md`](./FUTURE-PLANS.md)

---

## 目錄

- [快速概覽](#快速概覽)
- [核心功能開發清單](#核心功能開發清單)
- [建議的 SpecKit 展開項目](#建議的-speckit-展開項目)
- [關鍵技術決策](#關鍵技術決策)
- [資料模型重點](#資料模型重點)
- [下一步行動](#下一步行動)

---

## 快速概覽

本文件概述 Email Newsletter CMS 從基本閱讀器擴展為完整內容管理與電子報發送系統的規劃。

**現況**: 基本週報閱讀器（唯讀）
**目標**: 具個人化郵件發送功能的完整 CMS

---

## 核心功能開發清單

### 📧 電子報功能

| 功能 | 優先級 | 是否需要 SpecKit 展開 |
|------|--------|----------------------|
| **班級對應內容區塊** | P1 | ✅ 是 - 需獨立功能規格 |
| **每週複製模板** | P2 | ✅ 是 - 需編輯工作流規格 |
| **開信率與點擊率統計** | P2 | ✅ 是 - 需分析整合規格 |
| **多子女郵件合併** | P1 | ✅ 是 - 需複雜個人化規格 |
| **統一品牌與動態內容** | P2 | ⚠️ 屬於個人化規格的一部分 |

### 🎨 CMS 功能

| 功能 | 優先級 | 是否需要 SpecKit 展開 |
|------|--------|----------------------|
| **按週顯示文章含善話** | P1 | ⏭️ 略過 - 已實作 |
| **新增/編輯文章** | P1 | ✅ 是 - 需編輯器功能規格 |
| **文章排序** | P2 | ⚠️ 屬於編輯器規格的一部分 |
| **班級權限控制** | P1 | ✅ 是 - 需驗證與權限規格 |
| **文章獨立 URL** | P1 | ⏭️ 略過 - 已實作 |
| **週報系列 URL** | P1 | ⏭️ 略過 - 已實作 |
| **多班級家長檢視** | P1 | ✅ 是 - 需個人化規格 |
| **文章導航** | P2 | ⏭️ 略過 - 已實作 |
| **圖文編輯器** | P1 | ✅ 是 - 需富文本編輯器規格 |
| **多媒體支援（影音）** | P2 | ⚠️ 屬於富文本編輯器規格的一部分 |
| **老師編輯權限** | P2 | ⚠️ 屬於權限規格的一部分 |
| **整合統計儀表板** | P3 | ⚠️ 屬於分析規格的一部分 |

---

## 建議的 SpecKit 展開項目

### 1. 驗證與權限系統 (P1)

**功能範圍**：
- **用戶角色**：管理員、老師、家長
- **班級訪問控制**：基於班級的內容訪問權限
- **老師編輯權限**：老師只能編輯所屬班級的內容
- **家長關聯**：家長可與多個孩子關聯，查看所有相關班級內容

**技術考量**：
- 角色權限設計（RBAC - Role-Based Access Control）
- 班級與用戶的多對多關係
- 權限中間件（Middleware）實作
- 會話管理與 Token 驗證

**SpecKit 工作流**：
1. 使用 `/speckit.specify` 創建詳細功能規格
2. 使用 `/speckit.plan` 設計技術架構
3. 使用 `/speckit.tasks` 生成實作任務清單

---

### 2. 富文本內容編輯器 (P1)

**功能範圍**：
- **所見即所得編輯器**：整合 TipTap 或類似編輯器
- **圖片上傳**：支援拖拽上傳、自動壓縮、生成縮圖
- **圖片優化**：WebP 轉換、Lazy loading、CDN 整合
- **YouTube 嵌入**：自動解析 URL 並嵌入播放器
- **音訊支援**：上傳 MP3/WAV，自動轉換為優化格式
- **文章排序**：拖拽重新排列文章順序

**技術考量**：
- 編輯器選擇：TipTap（推薦）vs. Quill vs. Markdown
- 媒體儲存：Cloudinary 或 AWS S3
- 檔案上傳限制：大小、格式驗證
- 安全性：防止 XSS 攻擊，內容淨化（Sanitization）

**SpecKit 工作流**：
1. 使用 `/speckit.specify` 定義編輯器功能與 UI/UX
2. 使用 `/speckit.plan` 設計媒體處理流程
3. 使用 `/speckit.tasks` 分解為可實作任務

---

### 3. 個人化郵件系統 (P1)

**功能範圍**：
- **班級內容區塊**：每個班級有獨立的內容區塊
- **多子女合併**：一個家長有多個孩子時，只收到一封郵件
- **動態內容生成**：根據家長的孩子班級動態組合郵件內容
- **唯一追蹤 URL**：每封郵件包含唯一 token 用於追蹤和身份識別
- **模板系統**：可重複使用的郵件模板（HTML + 動態變數）

**技術考量**：
- 郵件服務商：SendGrid（推薦）、Mailchimp、AWS SES
- 模板引擎：Handlebars、EJS
- 批量發送邏輯：避免重複查詢，優化資料庫效能
- 追蹤機制：開信追蹤（Tracking Pixel）、點擊追蹤（Redirect URL）

**SpecKit 工作流**：
1. 使用 `/speckit.specify` 定義郵件生成邏輯與個人化規則
2. 使用 `/speckit.plan` 設計資料庫查詢優化與模板架構
3. 使用 `/speckit.tasks` 創建發送流程任務

---

### 4. 分析與報表 (P2)

**功能範圍**：
- **開信率追蹤**：追蹤每封郵件的開信數量與比例
- **點擊率追蹤**：追蹤文章內連結的點擊次數
- **視覺化儀表板**：圖表呈現統計數據（折線圖、長條圖、圓餅圖）
- **報表匯出**：支援 CSV、Excel 格式下載
- **分班統計**：按班級分組查看數據對比

**技術考量**：
- 整合郵件服務商 API（SendGrid Webhooks、Mailchimp Reports API）
- 圖表庫：Chart.js、Recharts、Apache ECharts
- 資料聚合：定時同步第三方數據到本地資料庫
- 隱私合規：匿名化處理，符合 GDPR/CCPA

**SpecKit 工作流**：
1. 使用 `/speckit.specify` 定義統計指標與儀表板 UI
2. 使用 `/speckit.plan` 設計數據同步與聚合架構
3. 使用 `/speckit.tasks` 分解為 API 整合、前端圖表等任務

---

### 5. 模板管理 (P2)

**功能範圍**：
- **週報模板**：可保存為模板的週報結構
- **複製工作流**：從上週或特定模板複製內容
- **固定區域**：「每週一句善話」等固定內容自動填入
- **模板版本**：支援多個模板版本（如節日特別版）

**技術考量**：
- 深拷貝機制：確保複製後的內容獨立
- 模板變數：定義可替換的變數（如週數、日期）
- 版本控制：追蹤模板修改歷史（可選）

**SpecKit 工作流**：
1. 使用 `/speckit.specify` 定義模板系統功能與用戶操作流程
2. 使用 `/speckit.plan` 設計模板資料結構
3. 使用 `/speckit.tasks` 創建複製邏輯與 UI 任務

---

## 關鍵技術決策

### 編輯器類型：所見即所得（TipTap）

**理由**：
- 老師和行政人員可能不熟悉 Markdown 語法
- 圖片、影片嵌入在視覺化編輯器中更直觀
- TipTap 基於 ProseMirror，擴展性強，支援客製化

**替代方案**：
- Quill：輕量但擴展性較弱
- Markdown 編輯器：適合技術用戶，但學習曲線高

---

### 郵件服務：SendGrid / Mailchimp

**理由**：
- 內建追蹤功能（開信率、點擊率）
- 提供模板管理與 WYSIWYG 編輯器
- 高送達率（Deliverability）與信譽管理
- 豐富的 API 與 Webhook 支援

**替代方案**：
- AWS SES：成本更低，但需自建追蹤系統
- Postmark：適合交易型郵件，行銷功能較弱

---

### 資料庫：PostgreSQL

**理由**：
- 複雜的關聯式資料（用戶、學生、班級、文章多對多關係）
- 支援 JSON 欄位（靈活儲存文章內容）
- 強大的查詢優化與索引功能
- 開源且社群活躍

**替代方案**：
- MongoDB：適合非結構化資料，但關聯查詢較弱
- MySQL：功能類似，但 PostgreSQL 在複雜查詢上更優

---

### 身份驗證：Firebase Authentication / Auth0

**理由**：
- 快速整合，減少開發時間
- 支援多種登入方式（Email/Password、Google、Magic Link）
- 內建會話管理與 Token 刷新
- 安全性由專業團隊維護

**替代方案**：
- 自建驗證系統：完全控制但開發與維護成本高
- Supabase Auth：開源替代方案，功能相似

---

### 媒體儲存：Cloudinary / AWS S3

**理由**：
- Cloudinary：自動圖片優化、格式轉換、CDN 整合
- AWS S3：成本較低，適合大量檔案儲存
- 兩者皆支援 CDN 加速，提升全球訪問速度

**建議**：
- 圖片使用 Cloudinary（自動優化）
- 音訊/影片使用 S3（成本考量）

---

## 資料模型重點

### 核心實體關係

```
User（用戶：管理員/老師/家長）
  ↓ 1:N
Child（學生）
  ↓ N:1
Class（班級：小熊班、小兔班...）
  ↓ 1:N
Newsletter（週報）
  ↓ 1:N
Article（文章含權限控制）
  ↓ 1:N
MediaAttachment（媒體附件：圖片/音訊/影片）
```

### User（用戶）

```typescript
interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'teacher' | 'parent'
  children?: Child[]        // 家長關聯的孩子
  managedClasses?: Class[]  // 老師負責的班級
  createdAt: Date
  updatedAt: Date
}
```

### Child（學生）

```typescript
interface Child {
  id: string
  name: string
  classId: string
  parentIds: string[]  // 支援多位家長（父母）
  enrolledAt: Date
  isActive: boolean
}
```

### Class（班級）

```typescript
interface Class {
  id: string
  name: string          // 如「小熊班」
  grade: string         // 如「大班」
  teachers: string[]    // 教師 ID 列表
  isActive: boolean
  academicYear: string  // 如「2024-2025」
}
```

### Newsletter（週報）

```typescript
interface Newsletter {
  id: string
  weekId: string        // 如 '2025-W46'
  publishDate: Date
  weeklyQuote: string   // 每週一句善話
  articles: Article[]
  status: 'draft' | 'published'
  createdAt: Date
  updatedAt: Date
}
```

### Article（文章）

```typescript
interface Article {
  id: string
  newsletterId: string
  title: string
  content: string       // HTML 或 Markdown
  order: number         // 排序序號
  visibility: 'public' | 'class_specific'
  classIds: string[]    // 可見的班級 ID（如設為 class_specific）
  author: string        // 作者 ID
  createdAt: Date
  updatedAt: Date
  mediaAttachments?: MediaAttachment[]
}
```

### MediaAttachment（多媒體附件）

```typescript
interface MediaAttachment {
  id: string
  type: 'image' | 'audio' | 'video'
  url: string
  thumbnailUrl?: string
  fileSize: number
  metadata?: {
    duration?: number   // 音訊/影片長度（秒）
    dimensions?: {      // 圖片尺寸
      width: number
      height: number
    }
  }
  uploadedAt: Date
}
```

### EmailCampaign（郵件發送記錄）

```typescript
interface EmailCampaign {
  id: string
  newsletterId: string
  sentAt: Date
  totalRecipients: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  recipientGroups: {
    classId: string
    recipientCount: number
  }[]
}
```

### Analytics（統計數據）

```typescript
interface Analytics {
  articleId: string
  views: number
  uniqueVisitors: number
  clicks: number           // 文章內連結點擊次數
  avgReadTime: number      // 平均閱讀時間（秒）
  clicksByLink: {
    url: string
    clicks: number
  }[]
  lastUpdated: Date
}
```

---

## 下一步行動

### 1. 選擇優先功能
決定要先開發哪些 P1 功能：
- ✅ 驗證與權限系統（必要基礎）
- ✅ 富文本內容編輯器（內容創作核心）
- ✅ 個人化郵件系統（核心價值主張）

### 2. 使用 SpecKit 展開
對每個主要功能使用 `/speckit.specify`：
```bash
/speckit.specify 驗證與權限系統
/speckit.specify 富文本內容編輯器
/speckit.specify 個人化郵件系統
```

### 3. 設計階段
使用 `/speckit.plan` 進行技術架構設計：
- 資料庫 Schema 設計
- API 端點規劃
- 前端組件結構
- 第三方服務整合方案

### 4. 實作階段
使用 `/speckit.tasks` + `/speckit.implement`：
- 生成詳細的實作任務清單
- 按優先級執行任務
- 持續測試與迭代

---

**完整 User Stories**：請參閱 [`email-newsletter-cms-future-plans.md`](./email-newsletter-cms-future-plans.md)
