-- Avoid putting parent emails in the default SMZ weekly campaign subject.
-- Existing custom subjects are left unchanged.
UPDATE public.email_template_revisions AS revision
SET subject_template = 'SMZ Waldorf Weekly - {{newsletter.title}}'
FROM public.email_templates AS template
WHERE revision.template_id = template.id
  AND template.name = 'SMZ Waldorf Weekly'
  AND BTRIM(revision.subject_template) = 'Weekly newsletter {{newsletter.id}} for {{guardian.email}}';
