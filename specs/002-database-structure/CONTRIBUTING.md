# 貢獻指南

感謝您對電子報閱讀 CMS 項目的興趣！本文檔提供了關於如何貢獻代碼、報告問題和提交拉取請求的指導。

## 📋 目錄

- [行為準則](#行為準則)
- [開發設置](#開發設置)
- [提交流程](#提交流程)
- [代碼風格](#代碼風格)
- [測試指南](#測試指南)
- [提交 Pull Request](#提交-pull-request)
- [性能指南](#性能指南)

## 行為準則

我們致力於提供一個熱情、包容的開發環境。請閱讀並遵守我們的[行為準則](./CODE_OF_CONDUCT.md)。

## 開發設置

### 前置需求

- Node.js 18+
- npm 9+ 或 yarn 3+
- Git

### 安裝

1. Fork 項目倉庫
2. Clone 您的 Fork：
   ```bash
   git clone https://github.com/YOUR_USERNAME/email-cms.git
   cd email-cms
   ```
3. 安裝依賴：
   ```bash
   npm install
   ```
4. 啟動開發服務器：
   ```bash
   npm run dev
   ```
   應用將在 http://localhost:5173 上運行

## 提交流程

### 分支命名規範

```
feature/description       # 新功能
bugfix/description        # 問題修復
refactor/description      # 代碼重構
docs/description          # 文檔更新
test/description          # 測試新增
perf/description          # 性能優化
```

### 提交消息格式

遵循約定式提交（Conventional Commits）：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**類型列表：**
- `feat`: 新功能
- `fix`: 修復問題
- `refactor`: 代碼重構
- `test`: 新增測試
- `docs`: 文檔更新
- `perf`: 性能優化
- `style`: 代碼格式化
- `chore`: 依賴更新等

**示例：**
```
feat(article-editor): Add article reordering with drag-and-drop

Implement drag-and-drop functionality for article reordering in the editor.
- Added DragDropArticle component
- Integrated with ArticleOrderManager
- Added performance tests for 50 article reordering

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 代碼風格

### TypeScript

- 使用嚴格的 TypeScript 配置（`strict: true`）
- 不要使用 `any` 類型
- 對所有函數返回類型進行標注
- 使用正體中文編寫註釋

### 命名規範

```typescript
// 常量：全大寫，蛇形命名
const MAX_ARTICLE_COUNT = 100
const DEFAULT_WEEK_FORMAT = '2025-W43'

// 類型/接口：帕斯卡命名法
interface ArticleData {
  id: string
  title: string
}

// 函數/變數：駝峰命名法
function fetchArticleContent(articleId: string): Promise<string> {
  let articleData = null
  return articleData
}

// React 組件：帕斯卡命名法
function ArticleCard({ article }: ArticleCardProps) {
  return <div>{article.title}</div>
}
```

### 代碼質量工具

項目使用 ESLint 和 Prettier 保持代碼質量。運行：

```bash
# 檢查代碼風格
npm run lint

# 自動格式化代碼
npm run format

# 檢查類型錯誤
npm run build
```

## 測試指南

### 測試結構

```
tests/
├── components/        # 組件單元測試
├── integration/       # 整合測試
├── performance/       # 性能測試
└── unit/             # 工具函數單元測試
```

### 編寫測試

遵循 TDD（測試驅動開發）原則：

1. **先寫失敗的測試** (紅色階段)
2. **實現最小化代碼使測試通過** (綠色階段)
3. **重構代碼** (重構階段)

**測試示例：**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArticleCard } from '@/components/ArticleCard'

describe('ArticleCard', () => {
  it('should render article title', () => {
    const mockArticle = {
      id: 'article-001',
      title: 'Test Article',
      author: 'Test Author',
      // ... 其他必需字段
    }

    render(<ArticleCard article={mockArticle} />)

    expect(screen.getByText('Test Article')).toBeDefined()
  })

  it('should call onSelect when clicked', () => {
    const mockOnSelect = vi.fn()
    const mockArticle = { /* ... */ }

    render(<ArticleCard article={mockArticle} onSelect={mockOnSelect} />)

    screen.getByText('Test Article').click()
    expect(mockOnSelect).toHaveBeenCalledWith(mockArticle.id)
  })
})
```

### 運行測試

```bash
# 監視模式運行所有測試
npm test

# 運行一次所有測試
npm test -- --run

# 運行特定文件的測試
npm test -- ArticleCard.test.tsx

# 運行匹配模式的測試
npm test -- -t "should render"

# 查看測試覆蓋率
npm run coverage
```

### 測試覆蓋目標

- 整體覆蓋率：80%+
- 組件測試覆蓋率：85%+
- 整合測試覆蓋率：75%+

## 提交 Pull Request

### 提交前檢查清單

- [ ] 代碼遵循項目風格指南
- [ ] 本地運行 `npm run lint` 沒有錯誤
- [ ] 本地運行 `npm run build` 成功
- [ ] 新增/修改了相應的測試
- [ ] 所有測試通過 (`npm test -- --run`)
- [ ] 更新了相關文檔
- [ ] 提交消息遵循約定式提交格式

### 創建 Pull Request

1. 推送您的分支：
   ```bash
   git push origin feature/your-feature
   ```

2. 在 GitHub 上創建 Pull Request
3. 填寫 PR 模板（自動生成）
4. 描述更改內容和原因
5. 鏈接相關的問題（如適用）

### PR 審查流程

- 最少需要 1 個維護者批准
- CI 檢查必須通過（測試、Lint、類型檢查）
- 代碼審查將關注：
  - 代碼質量和可維護性
  - 測試覆蓋率
  - 性能影響
  - 安全性

## 性能指南

### 性能目標

按照成功標準（Success Criteria）：

- **SC-001**: 首次內容繪製 < 2 秒
- **SC-002**: 直接連結 < 1 秒
- **US3**: 文章切換 < 1 秒
- **SC-004**: 編輯 50 篇文章 < 5 分鐘

### 性能檢查

```bash
# 運行性能測試
npm test -- tests/performance --run

# 分析組件性能
npm test -- tests/performance/ArticleSwitching.perf.test.tsx --run
```

### 性能最佳實踐

- 使用 `React.memo()` 包裝不常變化的組件
- 使用 `useCallback()` 穩定事件處理器
- 使用 `useMemo()` 優化昂貴計算
- 避免在渲染時創建新對象/陣列
- 使用虛擬列表處理大數據集

**優化示例：**
```typescript
// ❌ 不好 - 每次渲染都創建新對象
function ArticleList({ articles }) {
  const listProps = { style: { height: '100vh' } }
  return <div {...listProps}>{/* ... */}</div>
}

// ✅ 好 - 穩定的引用
const LIST_STYLE = { height: '100vh' } as const

function ArticleList({ articles }) {
  return <div style={LIST_STYLE}>{/* ... */}</div>
}

// ✅ 更好 - 使用 memo 避免不必要的重新渲染
const ArticleCard = React.memo(function ArticleCard({ article }) {
  return <div>{article.title}</div>
})
```

## 報告問題

### Bug 報告模板

```markdown
**描述 (Describe the bug)**
清晰簡潔的問題描述。

**重現步驟 (Steps to reproduce)**
1. 進入 '...'
2. 點擊 '....'
3. 滾動至 '....'
4. 看到錯誤

**預期行為 (Expected behavior)**
應該發生什麼。

**實際行為 (Actual behavior)**
實際發生了什麼。

**環境 (Environment)**
- OS: [e.g. macOS 12.1]
- Browser: [e.g. Chrome 97.0.4692.99]
- Node.js: [e.g. 18.13.0]

**額外上下文 (Additional context)**
任何其他相關信息。
```

## 許可證

通過貢獻，您同意您的貢獻根據 MIT 許可證授權。

## 詢問問題

有疑問？請：
- 檢查 [README.md](./README.md) 和文檔
- 搜索已有的 GitHub 問題
- 創建新的 GitHub Discussion
- 聯繫維護者

感謝您的貢獻！🙏
