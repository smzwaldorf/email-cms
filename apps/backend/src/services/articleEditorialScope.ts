import type { ArticleRow } from '#/types/database'

export interface ArticlePlacement {
  article_id: string
  targeting_mode?: string
  target_class_ids?: string[] | null
}
export type EditorialArticle = ArticleRow & { teacher_edit_class_ids: string[] }

/** Content edits affect all placements; one class placement cannot authorize a shared article. */
export function withArticleEditorialScope(article: ArticleRow, placements: ArticlePlacement[]): EditorialArticle {
  const ownPlacements = placements.filter(row => row.article_id === article.id)
  const targeted = ownPlacements.flatMap(row => row.targeting_mode === 'targeted' ? row.target_class_ids ?? [] : [])
  let classes: string[] = []
  if (article.visibility_type === 'class_restricted') {
    const restricted = article.restricted_to_classes ?? []
    if (restricted.length) classes = [...restricted, ...targeted]
  } else if (article.status === 'draft' && article.visibility_type === 'public' && ownPlacements.length > 0
    && ownPlacements.every(row => row.targeting_mode === 'targeted' && (row.target_class_ids?.length ?? 0) > 0)) {
    classes = targeted
  }
  return { ...article, teacher_edit_class_ids: [...new Set(classes)] }
}
