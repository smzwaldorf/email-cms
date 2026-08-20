export interface RelationSpec {
  table: string
  from: string
  to: string
  type: 'one' | 'many'
}

/** Known PostgREST embeds used by the current backend services. */
export const RELATIONS: Record<string, Record<string, RelationSpec>> = {
  newsletter_articles: {
    articles: { table: 'articles', from: 'article_id', to: 'id', type: 'one' },
    newsletters: { table: 'newsletters', from: 'newsletter_id', to: 'id', type: 'one' },
  },
  family_enrollment: {
    families: { table: 'families', from: 'family_id', to: 'id', type: 'one' },
  },
  student_class_enrollment: {
    students: { table: 'students', from: 'student_id', to: 'id', type: 'one' },
    classes: { table: 'classes', from: 'class_id', to: 'id', type: 'one' },
    families: { table: 'families', from: 'family_id', to: 'id', type: 'one' },
  },
  teacher_class_assignment: {
    classes: { table: 'classes', from: 'class_id', to: 'id', type: 'one' },
    teacher_profiles: { table: 'teacher_profiles', from: 'teacher_id', to: 'id', type: 'one' },
  },
}
