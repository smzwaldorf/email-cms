/**
 * Default HTML strings for the parent newsletter sections.
 *
 * Historically this module owned the hard-coded layout that the personalized
 * email composer assembled around each guardian's content blocks. With the
 * block-based template model, the source of truth for the layout lives on
 * each `email_template_revisions.blocks` row, and these defaults are exposed
 * only as the seed `bodyHtml` for newly-created template blocks.
 *
 * Keep this file as the public re-export surface so callers that imported
 * default block bodies continue to work without depending on the registry
 * implementation directly.
 */
export {
  createDefaultBlock as createDefaultNewsletterBlock,
  createStarterEmailBlocks as createStarterNewsletterEmailBlocks,
  getEmailBlockTypeDefinition as getNewsletterBlockDefinition,
  listEmailBlockTypeDefinitions as listNewsletterBlockDefinitions,
} from '@/services/emailTemplateBlocks'
