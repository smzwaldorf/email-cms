/**
 * Mock data generators for admin dashboard
 */

import type { UserRoleRow, NewsletterWeekRow, ArticleRow, ClassRow, FamilyRow } from '@/types/database';

// Generate mock users
export function generateMockUsers(count: number = 20): UserRoleRow[] {
  const roles: Array<'admin' | 'teacher' | 'parent' | 'student'> = ['admin', 'teacher', 'parent', 'student'];
  const users: UserRoleRow[] = [];

  const names = [
    'Zhang Wei', 'Wang Fang', 'Li Ming', 'Liu Yang', 'Chen Jing',
    'Zhou Xin', 'Wu Lei', 'Xu Hui', 'Sun Tao', 'Ma Lin',
    'Zhao Qiang', 'Huang Mei', 'Guo Ping', 'Tang Yu', 'Luo Wen'
  ];

  for (let i = 0; i < count; i++) {
    const role = i === 0 ? 'admin' : roles[Math.floor(Math.random() * roles.length)];
    const name = names[i % names.length];
    const email = `${name.toLowerCase().replace(' ', '.')}${i > 0 ? i : ''}@example.com`;

    users.push({
      id: `user-${i + 1}`,
      email,
      role,
      created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return users;
}

// Generate mock newsletter weeks
export function generateMockWeeks(count: number = 12): NewsletterWeekRow[] {
  const weeks: NewsletterWeekRow[] = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const weekDate = new Date(today);
    weekDate.setDate(today.getDate() - (i * 7));

    const year = weekDate.getFullYear();
    const weekNum = 47 - i;

    weeks.push({
      week_number: `${year}-W${weekNum.toString().padStart(2, '0')}`,
      release_date: weekDate.toISOString().split('T')[0],
      is_published: i < 8, // First 8 weeks are published
      created_at: new Date(weekDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: weekDate.toISOString(),
    });
  }

  return weeks;
}

// Generate mock articles
export function generateMockArticles(count: number = 50): ArticleRow[] {
  const articles: ArticleRow[] = [];
  const weeks = generateMockWeeks(Math.ceil(count / 5)); // Generate enough weeks for all articles

  const titles = [
    '校園新聞快報', '家長須知', '數學課程更新', '科學實驗活動',
    '藝術創作展覽', '體育運動會', '圖書館新書', '社區服務',
    '環保教育', '安全提醒', '健康飲食', '節日慶祝',
    '學生作品分享', '教師培訓', '家長會議通知'
  ];

  const authors = ['Ms. Wang', 'Mr. Chen', 'Ms. Liu', 'Mr. Zhou', 'Ms. Yang'];

  for (let i = 0; i < count; i++) {
    const weekIndex = Math.floor(i / 5);
    const week = weeks[weekIndex];

    // Fallback to a default week number if week is undefined
    const weekNumber = week?.week_number || `2025-W${(50 - weekIndex).toString().padStart(2, '0')}`;
    const isPublished = week?.is_published ?? (weekIndex < Math.ceil(count / 10));

    const visibilityType = Math.random() > 0.6 ? 'class_restricted' : 'public';

    articles.push({
      id: `article-${i + 1}`,
      short_id: `a${(i + 1).toString().padStart(3, '0')}`,
      week_number: weekNumber,
      title: `${titles[i % titles.length]} ${Math.floor(i / titles.length) + 1}`,
      content: `# ${titles[i % titles.length]}\n\n這是文章的內容。包含重要的資訊和更新。\n\n- 重點一\n- 重點二\n- 重點三`,
      author: authors[i % authors.length],
      article_order: (i % 5) + 1,
      is_published: isPublished,
      visibility_type: visibilityType as 'public' | 'class_restricted',
      restricted_to_classes: visibilityType === 'class_restricted' ? ['A1', 'B1'] : null,
      created_by: `user-${(i % 5) + 2}`,
      created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      deleted_at: null,
    });
  }

  return articles;
}

// Generate mock classes
export function generateMockClasses(): ClassRow[] {
  const classes: ClassRow[] = [];
  const grades = [1, 2, 3, 4, 5, 6];
  const sections = ['A', 'B'];

  for (const grade of grades) {
    for (const section of sections) {
      classes.push({
        id: `${section}${grade}`,
        class_name: `Grade ${grade}${section}`,
        class_grade_year: grade,
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return classes;
}

// Generate mock families
export function generateMockFamilies(count: number = 15): FamilyRow[] {
  const families: FamilyRow[] = [];

  for (let i = 0; i < count; i++) {
    families.push({
      id: `family-${i + 1}`,
      family_code: `FAMILY${(i + 1).toString().padStart(3, '0')}`,
      created_at: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return families;
}

// Dashboard statistics
export interface MockDashboardStats {
  totalUsers: number;
  adminCount: number;
  teacherCount: number;
  parentCount: number;
  studentCount: number;
  totalWeeks: number;
  publishedWeeks: number;
  totalArticles: number;
  publishedArticles: number;
  totalClasses: number;
  totalFamilies: number;
}

export function generateMockStats(): MockDashboardStats {
  const users = generateMockUsers(156);
  const weeks = generateMockWeeks(24);
  const articles = generateMockArticles(312);
  const classes = generateMockClasses();
  const families = generateMockFamilies(42);

  return {
    totalUsers: users.length,
    adminCount: users.filter(u => u.role === 'admin').length,
    teacherCount: users.filter(u => u.role === 'teacher').length,
    parentCount: users.filter(u => u.role === 'parent').length,
    studentCount: users.filter(u => u.role === 'student').length,
    totalWeeks: weeks.length,
    publishedWeeks: weeks.filter(w => w.is_published).length,
    totalArticles: articles.length,
    publishedArticles: articles.filter(a => a.is_published).length,
    totalClasses: classes.length,
    totalFamilies: families.length,
  };
}

// Recent activity
export interface MockActivity {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  action: string;
  description: string;
  metadata?: Record<string, string | number>;
}

export function generateMockActivity(count: number = 10): MockActivity[] {
  const activities: MockActivity[] = [];
  const actions = ['create', 'update', 'publish', 'unpublish', 'delete'];
  const users = generateMockUsers(10);
  const articles = generateMockArticles(20);

  const names = [
    'Zhang Wei', 'Wang Fang', 'Li Ming', 'Liu Yang', 'Chen Jing',
    'Zhou Xin', 'Wu Lei', 'Xu Hui', 'Sun Tao', 'Ma Lin',
  ];

  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const article = articles[Math.floor(Math.random() * articles.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const userName = names[Math.floor(Math.random() * names.length)];

    activities.push({
      id: `activity-${i + 1}`,
      timestamp: new Date(Date.now() - i * 15 * 60 * 1000).toISOString(),
      userName,
      userEmail: user.email,
      action,
      description: `${action.charAt(0).toUpperCase() + action.slice(1)} article "${article.title}"`,
    });
  }

  return activities;
}
