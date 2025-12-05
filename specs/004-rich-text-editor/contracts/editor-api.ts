/**
 * 編輯器 API 契約
 * 定義富文本編輯器、Markdown 編輯器的統一介面與內容轉換契約
 */

import type { JSONContent } from '@tiptap/core'

// ============================================================================
// 編輯器介面
// ============================================================================

/**
 * 編輯器類型
 */
export type EditorType = 'rich_text' | 'markdown'

/**
 * 編輯器模式
 */
export type EditorMode = 'edit' | 'preview' | 'split'

/**
 * 內容格式
 */
export type ContentFormat = 'markdown' | 'html' | 'tiptap_json'

/**
 * 編輯器狀態
 */
export interface EditorState {
  /**
   * 編輯器類型
   */
  type: EditorType

  /**
   * 編輯模式
   */
  mode: EditorMode

  /**
   * 內容格式
   */
  format: ContentFormat

  /**
   * 當前內容
   */
  content: string | JSONContent

  /**
   * 是否有未儲存的變更
   */
  isDirty: boolean

  /**
   * 是否為唯讀模式
   */
  isReadOnly: boolean

  /**
   * 字數統計
   */
  wordCount: number

  /**
   * 字元數統計
   */
  charCount: number
}

/**
 * 編輯器設定
 */
export interface EditorConfig {
  /**
   * 是否啟用自動儲存
   * @default true
   */
  autoSave?: boolean

  /**
   * 自動儲存間隔（毫秒）
   * @default 2000
   */
  autoSaveDelay?: number

  /**
   * 是否啟用拼字檢查
   * @default false
   */
  spellCheck?: boolean

  /**
   * 編輯器高度（CSS 值）
   * @default '500px'
   */
  height?: string | number

  /**
   * 是否顯示工具列
   * @default true
   */
  showToolbar?: boolean

  /**
   * 是否顯示字數統計
   * @default true
   */
  showWordCount?: boolean

  /**
   * Placeholder 文字
   */
  placeholder?: string

  /**
   * 是否唯讀
   * @default false
   */
  readOnly?: boolean

  /**
   * 初始編輯模式
   * @default 'edit'
   */
  initialMode?: EditorMode
}

// ============================================================================
// 工具列動作
// ============================================================================

/**
 * 文字格式化動作
 */
export enum TextFormatAction {
  BOLD = 'bold',
  ITALIC = 'italic',
  UNDERLINE = 'underline',
  STRIKETHROUGH = 'strikethrough',
  CODE = 'code',
  SUPERSCRIPT = 'superscript',
  SUBSCRIPT = 'subscript',
}

/**
 * 標題層級
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/**
 * 清單類型
 */
export enum ListType {
  BULLET = 'bullet',
  ORDERED = 'ordered',
  TASK = 'task',
}

/**
 * 對齊方式
 */
export enum AlignType {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
  JUSTIFY = 'justify',
}

/**
 * 編輯器命令
 */
export interface EditorCommands {
  // 文字格式化
  toggleBold(): void
  toggleItalic(): void
  toggleUnderline(): void
  toggleStrikethrough(): void
  toggleCode(): void

  // 標題
  setHeading(level: HeadingLevel): void
  setParagraph(): void

  // 清單
  toggleBulletList(): void
  toggleOrderedList(): void
  toggleTaskList(): void

  // 對齊
  setTextAlign(align: AlignType): void

  // 連結
  setLink(url: string, text?: string): void
  unsetLink(): void

  // 圖片
  insertImage(src: string, alt?: string, title?: string): void

  // 多媒體
  insertVideo(url: string): void
  insertAudio(url: string): void

  // 引用與程式碼區塊
  toggleBlockquote(): void
  insertCodeBlock(language?: string): void

  // 水平線
  insertHorizontalRule(): void

  // 復原/重做
  undo(): void
  redo(): void

  // 內容操作
  clearContent(): void
  setContent(content: string | JSONContent): void
  getContent(format?: ContentFormat): string | JSONContent
}

// ============================================================================
// 內容轉換器介面
// ============================================================================

/**
 * 內容轉換器
 * 負責不同格式之間的轉換
 */
export interface ContentConverter {
  /**
   * Markdown → TipTap JSON
   * @param markdown - Markdown 內容
   * @returns TipTap JSON 文檔
   * @throws ConversionError 當轉換失敗時
   */
  markdownToTiptap(markdown: string): Promise<JSONContent>

  /**
   * TipTap JSON → Markdown
   * @param doc - TipTap JSON 文檔
   * @returns Markdown 內容
   * @throws ConversionError 當轉換失敗時
   */
  tiptapToMarkdown(doc: JSONContent): string

  /**
   * HTML → TipTap JSON
   * @param html - HTML 內容
   * @returns TipTap JSON 文檔
   * @throws ConversionError 當轉換失敗時
   */
  htmlToTiptap(html: string): Promise<JSONContent>

  /**
   * TipTap JSON → HTML
   * @param doc - TipTap JSON 文檔
   * @returns HTML 內容
   * @throws ConversionError 當轉換失敗時
   */
  tiptapToHtml(doc: JSONContent): string


  /**
   * 驗證轉換保真度
   * 測試 A → B → A 是否保持內容一致
   * @param original - 原始內容
   * @param format - 內容格式
   * @returns 保真度測試結果
   */
  validateFidelity(original: string | JSONContent, format: ContentFormat): FidelityResult
}

/**
 * 轉換保真度結果
 */
export interface FidelityResult {
  /**
   * 是否保持 100% 保真度
   */
  isPerfect: boolean

  /**
   * 相似度分數（0-1）
   */
  similarity: number

  /**
   * 差異列表
   */
  differences: ContentDifference[]
}

/**
 * 內容差異
 */
export interface ContentDifference {
  /**
   * 差異類型
   */
  type: 'added' | 'removed' | 'modified'

  /**
   * 差異位置
   */
  path: string

  /**
   * 原始值
   */
  oldValue?: unknown

  /**
   * 新值
   */
  newValue?: unknown

  /**
   * 描述
   */
  description: string
}

/**
 * 轉換錯誤
 */
export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly format: ContentFormat,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'ConversionError'
  }
}

// ============================================================================
// 自訂節點定義
// ============================================================================

/**
 * YouTube 嵌入節點屬性
 */
export interface YouTubeNodeAttrs {
  /**
   * YouTube 影片 ID
   */
  videoId: string

  /**
   * 影片 URL
   */
  url: string

  /**
   * 寬度（可選）
   */
  width?: number

  /**
   * 高度（可選）
   */
  height?: number

  /**
   * 開始時間（秒）
   */
  start?: number

  /**
   * 是否自動播放
   * @default false
   */
  autoplay?: boolean
}

/**
 * 音訊播放器節點屬性
 */
export interface AudioPlayerNodeAttrs {
  /**
   * 音訊 URL
   */
  src: string

  /**
   * 標題
   */
  title?: string

  /**
   * 是否顯示控制項
   * @default true
   */
  controls?: boolean

  /**
   * 是否自動播放
   * @default false
   */
  autoplay?: boolean

  /**
   * 是否循環播放
   * @default false
   */
  loop?: boolean
}

/**
 * 圖片節點增強屬性
 */
export interface ImageNodeAttrs {
  /**
   * 圖片 URL
   */
  src: string

  /**
   * 替代文字
   */
  alt?: string

  /**
   * 標題
   */
  title?: string

  /**
   * 寬度
   */
  width?: number | string

  /**
   * 高度
   */
  height?: number | string

  /**
   * 對齊方式
   */
  align?: AlignType

  /**
   * 圖片標題（顯示在圖片下方）
   */
  caption?: string

  /**
   * 媒體 ID（關聯 media_files 表）
   */
  mediaId?: string
}

// ============================================================================
// 編輯器事件
// ============================================================================

/**
 * 編輯器事件類型
 */
export enum EditorEventType {
  /** 內容變更 */
  CONTENT_CHANGE = 'contentChange',

  /** 選取範圍變更 */
  SELECTION_CHANGE = 'selectionChange',

  /** 焦點進入 */
  FOCUS = 'focus',

  /** 焦點離開 */
  BLUR = 'blur',

  /** 儲存 */
  SAVE = 'save',

  /** 模式切換 */
  MODE_CHANGE = 'modeChange',

  /** 格式切換 */
  FORMAT_CHANGE = 'formatChange',

  /** 錯誤 */
  ERROR = 'error',
}

/**
 * 編輯器事件處理器
 */
export interface EditorEventHandlers {
  onContentChange?: (content: string | JSONContent) => void
  onSelectionChange?: (selection: EditorSelection) => void
  onFocus?: () => void
  onBlur?: () => void
  onSave?: (content: string | JSONContent) => Promise<void>
  onModeChange?: (mode: EditorMode) => void
  onFormatChange?: (format: ContentFormat) => void
  onError?: (error: Error) => void
}

/**
 * 編輯器選取範圍
 */
export interface EditorSelection {
  /**
   * 起始位置
   */
  from: number

  /**
   * 結束位置
   */
  to: number

  /**
   * 是否為空選取（游標）
   */
  empty: boolean

  /**
   * 選取的文字
   */
  text?: string
}

// ============================================================================
// 驗證器
// ============================================================================

/**
 * 內容驗證器
 */
export interface ContentValidator {
  /**
   * 驗證 TipTap JSON 文檔結構
   * @param doc - TipTap JSON 文檔
   * @returns 驗證結果
   */
  validateTiptapDocument(doc: unknown): ValidationResult

  /**
   * 驗證 Markdown 內容
   * @param markdown - Markdown 內容
   * @returns 驗證結果
   */
  validateMarkdown(markdown: string): ValidationResult

  /**
   * 驗證 HTML 內容（安全性檢查）
   * @param html - HTML 內容
   * @returns 驗證結果
   */
  validateHtml(html: string): ValidationResult

  /**
   * 清理 HTML（XSS 防護）
   * @param html - HTML 內容
   * @returns 清理後的 HTML
   */
  sanitizeHtml(html: string): string
}

/**
 * 驗證結果
 */
export interface ValidationResult {
  /**
   * 是否有效
   */
  valid: boolean

  /**
   * 錯誤訊息（如果無效）
   */
  errors?: string[]

  /**
   * 警告訊息
   */
  warnings?: string[]
}

// ============================================================================
// 編輯器工廠
// ============================================================================

/**
 * 建立富文本編輯器實例
 * @param element - DOM 元素
 * @param config - 編輯器設定
 * @param eventHandlers - 事件處理器
 * @returns 編輯器實例
 */
export function createRichTextEditor(
  element: HTMLElement,
  config?: EditorConfig,
  eventHandlers?: EditorEventHandlers
): EditorInstance {
  // 實作將在 src/components/RichTextEditor.tsx 中提供
  throw new Error('Not implemented - use RichTextEditor component')
}

/**
 * 編輯器實例
 */
export interface EditorInstance {
  /**
   * 取得編輯器狀態
   */
  getState(): EditorState

  /**
   * 取得編輯器命令
   */
  getCommands(): EditorCommands

  /**
   * 設定內容
   */
  setContent(content: string | JSONContent, format?: ContentFormat): void

  /**
   * 取得內容
   */
  getContent(format?: ContentFormat): string | JSONContent

  /**
   * 銷毀編輯器
   */
  destroy(): void

  /**
   * 設定焦點
   */
  focus(position?: 'start' | 'end' | number): void

  /**
   * 是否可復原
   */
  canUndo(): boolean

  /**
   * 是否可重做
   */
  canRedo(): boolean
}

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 從 YouTube URL 提取影片 ID
 * @param url - YouTube URL
 * @returns 影片 ID 或 null
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * 檢查 URL 是否為 YouTube URL
 * @param url - URL
 * @returns 是否為 YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

/**
 * 檢查檔案是否為音訊檔案
 * @param url - 檔案 URL
 * @returns 是否為音訊檔案
 */
export function isAudioFile(url: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a']
  return audioExtensions.some(ext => url.toLowerCase().endsWith(ext))
}

/**
 * 正規化 Markdown（用於測試比較）
 * @param markdown - Markdown 內容
 * @returns 正規化後的 Markdown
 */
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .trim()
    .replace(/\r\n/g, '\n')  // 統一換行符
    .replace(/\n{3,}/g, '\n\n')  // 移除多餘空行
    .replace(/\s+$/gm, '')  // 移除行尾空白
}

/**
 * 計算字數
 * @param text - 文字內容
 * @returns 字數
 */
export function countWords(text: string): number {
  // 移除 HTML 標籤和 Markdown 語法
  const plainText = text
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_~`\[\]()]/g, '')
    .trim()

  if (!plainText) return 0

  // 中文字元計為獨立字
  const chineseChars = plainText.match(/[\u4e00-\u9fa5]/g)?.length || 0

  // 英文單字計數
  const englishWords = plainText
    .replace(/[\u4e00-\u9fa5]/g, '')
    .match(/\b\w+\b/g)?.length || 0

  return chineseChars + englishWords
}
