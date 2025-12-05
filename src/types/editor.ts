/**
 * 編輯器相關型別定義
 * Editor related type definitions
 */

/**
 * 編輯器模式
 * Editor modes
 */
export enum EditorMode {
  RICH_TEXT = 'rich_text',
  MARKDOWN = 'markdown',
}

/**
 * 編輯器狀態
 * Editor state
 */
export interface EditorState {
  mode: EditorMode; // 目前編輯模式 Current editor mode
  content: string; // 內容（HTML 或 Markdown）Content (HTML or Markdown)
  isDirty: boolean; // 是否有未儲存變更 Has unsaved changes
  isSaving: boolean; // 是否正在儲存 Currently saving
  lastSavedAt?: string; // 最後儲存時間 ISO 8601
  autoSaveEnabled: boolean; // 自動儲存是否啟用 Autosave enabled
}

/**
 * 編輯器配置
 * Editor configuration
 */
export interface EditorConfig {
  mode: EditorMode;
  enableAutoSave: boolean;
  autoSaveInterval?: number; // 毫秒 Milliseconds
  enableImageUpload: boolean;
  enableAudioUpload: boolean;
  enableYoutubeEmbed: boolean;
  maxImageSize?: number; // 位元組 Bytes
  maxAudioSize?: number; // 位元組 Bytes
  placeholder?: string;
  readonly?: boolean;
}

/**
 * 編輯器事件回呼
 * Editor event callbacks
 */
export interface EditorCallbacks {
  onChange?: (content: string) => void; // 內容變更
  onSave?: (content: string) => Promise<void>; // 儲存
  onError?: (error: Error) => void; // 錯誤發生
  onModeChange?: (mode: EditorMode) => void; // 模式切換
}

/**
 * 富文本編輯器適配器
 * Rich text editor adapter
 */
export interface RichTextEditorAdapter {
  getContent(): string;
  setContent(content: string): void;
  getHTML(): string;
  getJSON(): object;
  getMarkdown(): string;
  setMarkdown(markdown: string): void;
  isEmpty(): boolean;
  focus(): void;
  blur(): void;
  disable(): void;
  enable(): void;
  destroy(): void;
}

/**
 * 編輯器切換選項
 * Editor switching options
 */
export interface EditorSwitchOptions {
  preserveFormatting?: boolean; // 保留格式 Preserve formatting
  showWarning?: boolean; // 顯示格式損失警告 Show fidelity warning
  targetMode: EditorMode; // 目標模式 Target mode
}

/**
 * 內容轉換結果
 * Content conversion result
 */
export interface ConversionResult {
  success: boolean;
  content: string; // 轉換後的內容 Converted content
  warnings: string[]; // 警告訊息 Warning messages
  errors: string[]; // 錯誤訊息 Error messages
  fidelity?: number; // 保真度 0-100 Fidelity 0-100
}

/**
 * TipTap 編輯器節點
 * TipTap editor nodes and marks
 */
export interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: Array<TipTapNode | TipTapMark>;
}

export interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

/**
 * TipTap 編輯器 JSON 格式
 * TipTap editor JSON format
 */
export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

/**
 * 編輯器切換警告
 * Editor switch warning
 */
export interface EditorSwitchWarning {
  message: string; // 警告訊息 Warning message
  severity: 'info' | 'warning' | 'error'; // 嚴重程度 Severity
  details?: string; // 詳細說明 Details
  formatsAffected?: string[]; // 受影響的格式 Affected formats
}

/**
 * 自動儲存狀態
 * Autosave state
 */
export interface AutoSaveState {
  enabled: boolean;
  interval: number; // 毫秒 Milliseconds
  lastSavedAt?: string; // ISO 8601
  pendingChanges: boolean;
  saveInProgress: boolean;
  lastError?: Error;
}

/**
 * 編輯歷史記錄項目
 * Edit history entry
 */
export interface HistoryEntry {
  id: string;
  timestamp: string; // ISO 8601
  action: 'insert' | 'delete' | 'format' | 'replace';
  before: string;
  after: string;
  description: string;
}

/**
 * 編輯器偏好設定
 * Editor preferences
 */
export interface EditorPreferences {
  preferredMode: EditorMode;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  rememberLastMode: boolean;
  showToolbar: boolean;
  showStatusBar: boolean;
}
