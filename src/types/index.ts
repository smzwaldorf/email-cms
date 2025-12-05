/**
 * 核心類型定義 - 電子報閱讀 CMS Web App
 * 對應 data-model.md 中的實體設計
 */

// ============ 電子報周份 (NewsletterWeek) ============

export interface NewsletterWeek {
  // 唯一識別
  weekNumber: string; // 格式: "2025-W42" (ISO 8601)

  // 基本資訊
  releaseDate: string; // ISO 日期字符串
  title?: string; // 週報標題（可選）

  // 時間戳
  createdAt: string;
  updatedAt: string;

  // 文章清單
  articleIds: string[]; // 文章 ID 清單，按序

  // 元數據
  isPublished: boolean; // 是否已發行
  totalArticles: number; // 快取：文章總數
}

// ============ 文章 (Article) ============

export interface Article {
  // 唯一識別
  id: string; // UUID 或遞增整數
  shortId: string; // 短網址 ID


  // 內容
  title: string; // 文章標題，必填
  content: string; // HTML 格式內容（TipTap 直接輸出）
  author?: string; // 作者名稱（可選）
  summary?: string; // 摘要（可選）

  // 分類與排序
  weekNumber: string; // 所屬週份 (ISO 8601 格式)
  order: number; // 該週內的排序序號（1, 2, 3...）

  // 連結與訪問
  slug?: string; // URL 友好名稱
  publicUrl: string; // 公開可訪問的 URL

  // 時間戳
  createdAt: string;
  updatedAt: string;
  publishedAt?: string; // 發行時間（可選）

  // 元數據
  isPublished: boolean; // 該文章是否可讀
  viewCount?: number; // 瀏覽次數
}

// ============ 導航狀態 (NavigationState) ============

export interface NavigationState {
  // 當前位置
  currentWeekNumber: string; // 當前週份
  currentArticleId: string; // 當前文章 ID
  currentArticleOrder: number; // 當前文章在週內的序號

  // 快取資訊
  totalArticlesInWeek: number; // 該週的文章總數
  articleList: Article[]; // 該週的文章清單（快取）

  // 導航狀態
  isLoading: boolean; // 是否正在載入
  error?: {
    code: string; // 錯誤碼 (e.g., "WEEK_NOT_FOUND", "ARTICLE_DELETED")
    message: string; // 使用者友善的錯誤信息
  };

  // 上下文
  previousArticleId?: string; // 快速存取上一篇
  nextArticleId?: string; // 快速存取下一篇
}

// ============ 計算屬性函式 ============

/**
 * 計算位置指示器文字
 */
export function getPositionText(nav: NavigationState): string {
  return `第 ${nav.currentArticleOrder} 篇，共 ${nav.totalArticlesInWeek} 篇`;
}

/**
 * 判斷是否可導航至下一篇
 */
export function hasNext(nav: NavigationState): boolean {
  return nav.currentArticleOrder < nav.totalArticlesInWeek;
}

/**
 * 判斷是否可導航至上一篇
 */
export function hasPrevious(nav: NavigationState): boolean {
  return nav.currentArticleOrder > 1;
}

// ============ API 響應類型 ============

export interface ApiResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
}

// ============ 組件 Props 類型 ============

export interface ArticleContentProps {
  title: string;
  author?: string;
  content: string; // HTML 內容
  isLoading?: boolean;
}

export interface NavigationBarProps {
  currentPosition: number;
  totalArticles: number;
  onPrevious: () => void;
  onNext: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PositionIndicatorProps {
  currentPosition: number;
  totalArticles: number;
}

export interface SideButtonProps {
  direction: 'left' | 'right';
  onClick: () => void;
  disabled?: boolean;
}

export interface ArticleListProps {
  articles: Article[];
  currentArticleId: string;
  onSelectArticle: (articleId: string) => void;
}

// ============ 資料庫類型定義 ============
// Re-export all database types from database.ts
export * from './database';

// ============ 管理員儀表板類型定義 ============
// Re-export all admin types from admin.ts
export * from './admin';
