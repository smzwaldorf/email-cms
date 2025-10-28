# 快速入門指南：電子報閱讀 Web App

**功能**: 001-newsletter-viewer
**日期**: 2025-10-28

## 目標

此指南幫助開發者在 5 分鐘內設置開發環境，並運行基本的「查看週報」功能。

---

## 先決條件

- Node.js 18+ 和 npm 9+
- Git
- 編輯器（VS Code 推薦）

---

## 步驟 1：專案初始化

### 1.1 建立 Vite React 項目

```bash
npm create vite@latest newsletter-viewer -- --template react-ts
cd newsletter-viewer
```

### 1.2 安裝依賴

```bash
npm install

# 核心依賴（已由 Vite 模板包含）
# - react@18
# - react-dom@18
# - typescript

# 安裝額外依賴
npm install react-router-dom@6
npm install remark remark-html rehype-sanitize
npm install --save-dev tailwindcss postcss autoprefixer
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

### 1.3 配置 Tailwind CSS

```bash
npx tailwindcss init -p
```

編輯 `tailwind.config.ts`:
```typescript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

編輯 `src/styles/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 步驟 2：建立基本結構

### 2.1 建立目錄結構

```bash
mkdir -p src/{pages,components,services,hooks,types,utils,styles}
mkdir -p tests/{unit,components,integration}
```

### 2.2 定義核心類型

創建 `src/types/index.ts`:
```typescript
// 文章類型
export interface Article {
  id: string;
  title: string;
  content: string;
  author?: string;
  weekNumber: string;
  order: number;
  publicUrl: string;
}

// 週報類型
export interface NewsletterWeek {
  weekNumber: string;
  releaseDate: string;
  title?: string;
  articles: Article[];
  totalArticles: number;
}

// 導航狀態
export interface NavigationState {
  currentWeekNumber: string;
  currentArticleId: string;
  currentArticleOrder: number;
  totalArticlesInWeek: number;
  isLoading: boolean;
  error?: { code: string; message: string };
}
```

---

## 步驟 3：實現核心元件

### 3.1 建立文章內容元件

創建 `src/components/ArticleContent.tsx`:
```typescript
import React from 'react';

interface ArticleContentProps {
  title: string;
  author?: string;
  content: string; // Markdown 內容
  isLoading?: boolean;
}

export const ArticleContent: React.FC<ArticleContentProps> = ({
  title,
  author,
  content,
  isLoading,
}) => {
  if (isLoading) {
    return <div className="p-8 text-center">載入中...</div>;
  }

  return (
    <article className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      {author && <p className="text-gray-600 mb-4">作者：{author}</p>}
      <div className="prose max-w-none">
        {/* 此處應渲染 Markdown 轉 HTML */}
        {content}
      </div>
    </article>
  );
};
```

### 3.2 建立導航按鈕

創建 `src/components/NavigationBar.tsx`:
```typescript
import React from 'react';

interface NavigationBarProps {
  currentPosition: number;
  totalArticles: number;
  onPrevious: () => void;
  onNext: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  currentPosition,
  totalArticles,
  onPrevious,
  onNext,
  hasNext,
  hasPrevious,
}) => {
  return (
    <div className="flex justify-between items-center p-4 bg-gray-100 border-b">
      <button
        onClick={onPrevious}
        disabled={!hasPrevious}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
      >
        上一篇
      </button>

      <span className="text-center">
        第 {currentPosition} 篇，共 {totalArticles} 篇
      </span>

      <button
        onClick={onNext}
        disabled={!hasNext}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
      >
        下一篇
      </button>
    </div>
  );
};
```

### 3.3 建立讀者頁面

創建 `src/pages/ReaderPage.tsx`:
```typescript
import React, { useState } from 'react';
import { NavigationBar } from '../components/NavigationBar';
import { ArticleContent } from '../components/ArticleContent';
import type { NavigationState, Article } from '../types';

export const ReaderPage: React.FC = () => {
  const [navState, setNavState] = useState<NavigationState>({
    currentWeekNumber: '2025-W42',
    currentArticleId: 'article-001',
    currentArticleOrder: 1,
    totalArticlesInWeek: 10,
    isLoading: false,
  });

  // 模擬數據
  const mockArticles: Article[] = [
    {
      id: 'article-001',
      title: 'AI 新聞速遞',
      content: '# AI 新聞速遞\n\n本週重要新聞...',
      author: '編輯部',
      weekNumber: '2025-W42',
      order: 1,
      publicUrl: '/newsletter/2025-w42/article/article-001',
    },
    // ... 更多文章
  ];

  const currentArticle = mockArticles.find(
    (a) => a.id === navState.currentArticleId
  );

  const handleNext = () => {
    if (navState.currentArticleOrder < navState.totalArticlesInWeek) {
      setNavState((prev) => ({
        ...prev,
        currentArticleOrder: prev.currentArticleOrder + 1,
        currentArticleId: mockArticles[prev.currentArticleOrder].id,
      }));
    }
  };

  const handlePrevious = () => {
    if (navState.currentArticleOrder > 1) {
      setNavState((prev) => ({
        ...prev,
        currentArticleOrder: prev.currentArticleOrder - 1,
        currentArticleId: mockArticles[prev.currentArticleOrder - 2].id,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <NavigationBar
        currentPosition={navState.currentArticleOrder}
        totalArticles={navState.totalArticlesInWeek}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasNext={navState.currentArticleOrder < navState.totalArticlesInWeek}
        hasPrevious={navState.currentArticleOrder > 1}
      />

      {currentArticle && (
        <ArticleContent
          title={currentArticle.title}
          author={currentArticle.author}
          content={currentArticle.content}
          isLoading={navState.isLoading}
        />
      )}
    </div>
  );
};
```

---

## 步驟 4：建立路由

編輯 `src/App.tsx`:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ReaderPage } from './pages/ReaderPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/newsletter/:weekNumber/:articleId" element={<ReaderPage />} />
        <Route path="/" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

## 步驟 5：運行開發伺服器

```bash
npm run dev
```

打開瀏覽器，訪問 `http://localhost:5173`

---

## 步驟 6：編寫測試

### 6.1 配置 Vitest

創建 `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

### 6.2 編寫元件測試

創建 `tests/components/NavigationBar.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationBar } from '../../src/components/NavigationBar';
import { describe, it, expect, vi } from 'vitest';

describe('NavigationBar', () => {
  it('應該顯示位置指示器', () => {
    render(
      <NavigationBar
        currentPosition={5}
        totalArticles={10}
        onPrevious={() => {}}
        onNext={() => {}}
        hasNext={true}
        hasPrevious={true}
      />
    );

    expect(screen.getByText('第 5 篇，共 10 篇')).toBeInTheDocument();
  });

  it('點擊下一篇按鈕應該呼叫 onNext', () => {
    const onNext = vi.fn();
    render(
      <NavigationBar
        currentPosition={1}
        totalArticles={10}
        onPrevious={() => {}}
        onNext={onNext}
        hasNext={true}
        hasPrevious={false}
      />
    );

    fireEvent.click(screen.getByText('下一篇'));
    expect(onNext).toHaveBeenCalled();
  });

  it('在最後一篇時應該禁用下一篇按鈕', () => {
    render(
      <NavigationBar
        currentPosition={10}
        totalArticles={10}
        onPrevious={() => {}}
        onNext={() => {}}
        hasNext={false}
        hasPrevious={true}
      />
    );

    expect(screen.getByText('下一篇')).toBeDisabled();
  });
});
```

### 6.3 運行測試

```bash
npm run test
```

---

## 步驟 7：與後端 API 整合（未來）

當後端 API 準備好時，更新 `src/services/newsApi.ts`:

```typescript
const API_BASE = 'https://api.example.com/api/v1';

export async function getNewsletter(weekNumber: string) {
  const response = await fetch(`${API_BASE}/newsletters/${weekNumber}`);
  if (!response.ok) throw new Error('Failed to load newsletter');
  return response.json();
}

export async function getArticle(articleId: string) {
  const response = await fetch(`${API_BASE}/articles/${articleId}`);
  if (!response.ok) throw new Error('Article not found');
  return response.json();
}
```

在 React Component 中使用：

```typescript
import { useEffect, useState } from 'react';
import { getNewsletter } from '../services/newsApi';

export const ReaderPage = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    getNewsletter('2025-W42').then(setData);
  }, []);

  // ... 渲染邏輯
};
```

---

## 檢查清單

完成此快速入門後，您應該有：

- ✅ Vite + React + TypeScript 開發環境
- ✅ 基本導航功能（上一篇/下一篇）
- ✅ 位置指示器（第 X 篇，共 Y 篇）
- ✅ Vitest 測試框架
- ✅ Tailwind CSS 樣式

---

## 常見問題

**Q: 如何新增 Markdown 渲染？**
A: 安裝 `react-markdown` 和 `remark-gfm`，在 ArticleContent 元件中使用。

**Q: 如何新增邊緣導航按鈕？**
A: 在 ReaderPage 中添加絕對定位按鈕，監聽鍵盤事件（左右箭頭）。

**Q: 如何處理深度連結？**
A: 使用 React Router 的 URL 參數，根據 weekNumber 和 articleId 初始化狀態。

---

## 後續步驟

1. **實現完整功能**: 按照 `tasks.md` 清單實現所有故事
2. **連接後端**: 整合真實 API
3. **測試覆蓋**: 達到 80%+ 測試覆蓋率
4. **效能優化**: 確保文章切換 < 1 秒
5. **部署**: 使用 Vite 構建並部署至生產環境

---

## 相關文件

- [功能規格](./spec.md) - 使用者故事和驗收標準
- [實現計畫](./plan.md) - 技術堆棧和架構
- [資料模型](./data-model.md) - 實體和關係
- [API 契約](./contracts/api-contract.md) - 後端端點規範

---

**快速入門完成！開始開發吧！** 🚀
