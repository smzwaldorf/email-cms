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

  // 內容
  title: string; // 文章標題，必填
  content: string; // Markdown 格式內容
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
  content: string; // Markdown 內容
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

// ============ Authentication & User System ============

export enum UserRole {
  ADMIN = 'ADMIN',
  CLASS_TEACHER = 'CLASS_TEACHER',
  PARENT = 'PARENT',
  STUDENT = 'STUDENT',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  phoneNumber?: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface AuthSession {
  user: User | null;
  accessToken: string | null;
  expiresAt?: number;
}

// ============ Family & Relationships ============

export interface Family {
  id: string;
  familyName?: string;
  address?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export enum FamilyMemberRole {
  PARENT = 'PARENT',
  CHILD = 'CHILD',
}

export interface FamilyMember {
  id: string;
  familyId: string;
  family?: Family;
  userId?: string;
  user?: User;
  role: FamilyMemberRole;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  isStudent: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum RelationType {
  MOTHER = 'MOTHER',
  FATHER = 'FATHER',
  GUARDIAN = 'GUARDIAN',
  STEPMOTHER = 'STEPMOTHER',
  STEPFATHER = 'STEPFATHER',
  GRANDPARENT = 'GRANDPARENT',
  OTHER = 'OTHER',
}

export interface ParentChildRelationship {
  id: string;
  parentMemberId: string;
  parentMember?: FamilyMember;
  childMemberId: string;
  childMember?: FamilyMember;
  relationshipType: RelationType;
  isPrimaryGuardian: boolean;
  canReceiveUpdates: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Class System ============

export interface Class {
  id: string;
  name: string; // Chinese zodiac name (e.g., "甲辰", "辛丑甲")
  currentGrade: number; // Current grade: 0-12
  startYear: number; // Gregorian year when entered Grade 1
  description?: string;
  teacherId: string;
  teacher?: User;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  TRANSFERRED = 'TRANSFERRED',
  WITHDRAWN = 'WITHDRAWN',
  GRADUATED = 'GRADUATED',
}

export interface ClassMembership {
  id: string;
  studentId: string;
  student?: User;
  classId: string;
  class?: Class;
  joinedDate: string;
  leftDate?: string;
  status: MembershipStatus;
  transferReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Enhanced Article Types ============

export enum ArticleType {
  ALL_SCHOOL = 'ALL_SCHOOL',
  CLASS_NEWS = 'CLASS_NEWS',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  EVENT = 'EVENT',
}

// ============ Helper Functions ============

/**
 * Chinese Zodiac Year Name Generator
 * Maps Gregorian year to Chinese sexagenary cycle name
 */
export function getChineseZodiacName(year: number): string {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // Year 4 (甲子) is the reference point in the 60-year cycle
  const stemIndex = (year - 4) % 10;
  const branchIndex = (year - 4) % 12;

  return stems[stemIndex] + branches[branchIndex];
}

// ============ Event Registration System ============

export enum EventType {
  GENERAL = 'GENERAL',
  WORKSHOP = 'WORKSHOP',
  MEETING = 'MEETING',
  CELEBRATION = 'CELEBRATION',
  FIELD_TRIP = 'FIELD_TRIP',
  PERFORMANCE = 'PERFORMANCE',
  OTHER = 'OTHER',
}

export enum RegistrationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  WAITLIST = 'WAITLIST',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
  WAIVED = 'WAIVED',
}

export interface Event {
  id: string;

  // Basic Information
  title: string;
  description: string;
  eventType: EventType;

  // Date & Time
  eventDate: string; // ISO string
  eventEndDate?: string;
  registrationDeadline?: string;

  // Location
  location?: string;
  locationDetails?: string;
  isOnline: boolean;
  meetingUrl?: string;

  // Capacity
  maxParticipants?: number;
  currentParticipants: number;
  allowWaitlist: boolean;

  // Pricing
  hasFee: boolean;
  pricePerPerson: number;
  currency: string;

  // Food Options
  providesFood: boolean;
  foodOptions?: string[];

  // Registration Settings
  requiresApproval: boolean;
  allowPlusOnes: boolean;
  maxAttendeesPerRegistration: number;

  // Visibility
  targetAudience: string[];
  isPublished: boolean;
  isFeatured: boolean;

  // Media
  coverImageUrl?: string;
  attachments?: string[];

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;

  // Additional
  tags?: string[];
  customFields?: Record<string, any>;

  // Populated fields (from joins)
  creator?: User;
  registrationCount?: number;
  userRegistration?: EventRegistration; // Current user's registration
}

export interface EventRegistration {
  id: string;

  // References
  eventId: string;
  userId: string;
  familyId?: string;

  // Registration Details
  numAttendees: number;
  attendeeNames?: string[];
  attendeeAges?: number[];

  // Food Preferences
  foodPreferences?: Record<number, string>; // {attendeeIndex: foodOption}
  dietaryRestrictions?: string;
  specialRequirements?: string;

  // Payment
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: string;

  // Status
  registrationStatus: RegistrationStatus;

  // Attendance
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  actualAttendees?: number;

  // Metadata
  registeredAt: string;
  cancelledAt?: string;
  cancellationReason?: string;

  // Contact Info
  contactEmail?: string;
  contactPhone?: string;

  // Notes
  notes?: string;
  adminNotes?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Populated fields
  event?: Event;
  user?: User;
  family?: Family;
}

export interface EventAttendance {
  id: string;
  registrationId: string;
  eventId: string;
  attendeeName?: string;
  attendeeIndex?: number;
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  attended: boolean;
  noShow: boolean;
  feedback?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventComment {
  id: string;
  eventId: string;
  userId: string;
  parentCommentId?: string;
  content: string;
  isOrganizer: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;

  // Populated fields
  user?: User;
  replies?: EventComment[];
}

// Helper types for creating/updating events
export interface CreateEventInput {
  title: string;
  description: string;
  eventType: EventType;
  eventDate: string;
  eventEndDate?: string;
  registrationDeadline?: string;
  location?: string;
  locationDetails?: string;
  isOnline?: boolean;
  meetingUrl?: string;
  maxParticipants?: number;
  allowWaitlist?: boolean;
  hasFee?: boolean;
  pricePerPerson?: number;
  currency?: string;
  providesFood?: boolean;
  foodOptions?: string[];
  requiresApproval?: boolean;
  allowPlusOnes?: boolean;
  maxAttendeesPerRegistration?: number;
  targetAudience?: string[];
  isPublished?: boolean;
  isFeatured?: boolean;
  coverImageUrl?: string;
  attachments?: string[];
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  id: string;
}

export interface CreateRegistrationInput {
  eventId: string;
  numAttendees: number;
  attendeeNames?: string[];
  attendeeAges?: number[];
  foodPreferences?: Record<number, string>;
  dietaryRestrictions?: string;
  specialRequirements?: string;
  notes?: string;
}

export interface UpdateRegistrationInput extends Partial<CreateRegistrationInput> {
  id: string;
  registrationStatus?: RegistrationStatus;
  paymentStatus?: PaymentStatus;
  adminNotes?: string;
}

// Helper function to get event type display name
export function getEventTypeDisplayName(type: EventType): string {
  const names: Record<EventType, string> = {
    [EventType.GENERAL]: '一般活動',
    [EventType.WORKSHOP]: '工作坊',
    [EventType.MEETING]: '會議',
    [EventType.CELEBRATION]: '慶典',
    [EventType.FIELD_TRIP]: '校外教學',
    [EventType.PERFORMANCE]: '演出',
    [EventType.OTHER]: '其他',
  };
  return names[type] || type;
}

// Helper function to check if event is full
export function isEventFull(event: Event): boolean {
  if (!event.maxParticipants) return false;
  return event.currentParticipants >= event.maxParticipants;
}

// Helper function to check if registration is open
export function isRegistrationOpen(event: Event): boolean {
  const now = new Date();
  const eventDate = new Date(event.eventDate);
  const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : eventDate;

  return now < deadline && event.isPublished;
}

// Helper function to calculate total price
export function calculateTotalPrice(event: Event, numAttendees: number): number {
  if (!event.hasFee) return 0;
  return event.pricePerPerson * numAttendees;
}
