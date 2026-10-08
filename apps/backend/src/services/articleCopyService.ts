import { canPerformCmsAction } from '@email-cms/shared'
import { HttpError, type AuthenticatedViewer } from '#/auth'
import { withTransaction } from '#/lib/db'
import type { ArticleRow } from '#/types/database'

/** Copies share media assets, but own their usage and editorial lifecycle. */
export async function copyArticle(sourceId: string, fromTemplate: boolean, viewer: AuthenticatedViewer): Promise<ArticleRow> {
  if (!canPerformCmsAction(viewer, 'cms:manage')) throw new HttpError(403, 'CMS management permission required')
  if (!/^[0-9a-f-]{36}$/i.test(sourceId)) throw new HttpError(400, 'Invalid article ID')
  return withTransaction(async client => {
    const source = await client.query<ArticleRow & { class_ids: string[] }>('SELECT * FROM articles WHERE id = $1 AND deleted_at IS NULL FOR SHARE', [sourceId])
    if (!source.rows[0]) throw new HttpError(404, 'Active source article not found')
    const placements = await client.query<{ is_template: boolean; targeting_mode: string; target_class_ids: string[] }>(
      `SELECT n.is_template, na.targeting_mode, na.target_class_ids FROM newsletter_articles na
       JOIN newsletters n ON n.id = na.newsletter_id WHERE na.article_id = $1 FOR SHARE OF na, n`, [sourceId])
    if (fromTemplate && !placements.rows.some(row => row.is_template)) throw new HttpError(400, 'Source article must belong to a template')
    // Standalone drafts have no newsletter placement. Carry placement restrictions onto the article.
    const restrictions = [...new Set([...(source.rows[0].restricted_to_classes ?? []),
      ...placements.rows.filter(row => row.targeting_mode === 'targeted').flatMap(row => row.target_class_ids ?? [])])]
    const classes = [...new Set([...(source.rows[0].class_ids ?? []), ...restrictions])]
    const { rows } = await client.query<ArticleRow>(
      `INSERT INTO articles (title, content, author_id, author, summary, status, visibility_type,
        restricted_to_classes, class_ids, family_ids, created_by)
       SELECT title, content, author_id, author, summary, 'draft', CASE WHEN cardinality($4::text[]) > 0 THEN 'class_restricted' ELSE visibility_type END,
        CASE WHEN cardinality($4::text[]) > 0 THEN to_jsonb($4::text[]) ELSE restricted_to_classes END, $2::text[], family_ids, $3 FROM articles WHERE id = $1 RETURNING *`,
      [sourceId, classes, viewer.id, restrictions])
    const copy = rows[0]
    await client.query(`INSERT INTO article_media_references (article_id, media_id, reference_type, position)
      SELECT $2, media_id, reference_type, position FROM article_media_references WHERE article_id = $1 ON CONFLICT (article_id, media_id) DO UPDATE
      SET reference_type = EXCLUDED.reference_type, position = EXCLUDED.position`, [sourceId, copy.id])
    await client.query(`INSERT INTO media_usage (media_id, target_type, target_id, context_key, active, created_by)
      SELECT media_id, 'article', $2, context_key, true, $3 FROM media_usage
      WHERE target_type = 'article' AND target_id = $1 AND active
      ON CONFLICT (media_id, target_type, target_id, context_key) DO UPDATE SET active = true, deactivated_at = NULL`, [sourceId, copy.id, viewer.id])
    await client.query(`INSERT INTO article_category_assignments (article_id, category_id)
      SELECT $2, category_id FROM article_category_assignments WHERE article_id = $1`, [sourceId, copy.id])
    await client.query(`INSERT INTO article_tag_assignments (article_id, tag_id)
      SELECT $2, tag_id FROM article_tag_assignments WHERE article_id = $1`, [sourceId, copy.id])
    return copy
  })
}
