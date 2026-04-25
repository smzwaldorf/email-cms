import { DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES } from '@/services/emailTemplateService'
import type { FileEmailTemplateRenderContext } from '@/types/fileEmailTemplate'

export function createDefaultFileEmailTemplateRenderContext(): FileEmailTemplateRenderContext {
  return {
    templateContext: {
      guardian: { id: 'preview-guardian', email: 'guardian@example.com' },
      family: { id: 'preview-family' },
      newsletter: { id: 'preview-newsletter', revisionId: 'preview-revision' },
      classes: { ids: ['A1'] },
    },
    sharedArticles: DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES.sharedArticles,
    classes: DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES.classes,
    weeklyItems: DEFAULT_EMAIL_TEMPLATE_PREVIEW_SAMPLES.weeklyItems,
    injectedHtml: {
      communityAnnouncement:
        '<p style="margin:0;">This is sample injected HTML for file-template preview and sync.</p>',
      bodySlot: '<p style="margin:0;">This is sample injected HTML for file-template preview and sync.</p>',
    },
  }
}
