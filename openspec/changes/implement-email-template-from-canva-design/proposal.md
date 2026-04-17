## Why

Admins already have approved visual email layouts coming from Canva, but the current template workflow is centered on manual editing and does not clearly define which imported HTML is safe, preservable, and reliable for preview and delivery. This change is needed now so production newsletters can match the approved Canva design without introducing broken markup, unsupported assets, or mismatches between admin preview and sent output.

## What Changes

- Extend the email template workflow to support importing or pasting Canva-exported HTML into a reusable email template while preserving the accepted markup that will be used for preview and sending.
- Define compatibility rules for imported Canva HTML, including what markup is allowed, what content must be rejected or stripped, and how token placeholders can be inserted without breaking the design layout.
- Define preview and preparation behavior so the same saved template revision is rendered consistently in the admin editor, email-content preparation, and downstream delivery flows.
- Add clear validation and error reporting for unsupported Canva export content such as unsafe tags, unsupported embeds, or missing required structure/assets.

## Capabilities

### New Capabilities

- `canva-email-template-import`: Admin workflow and guardrails for importing Canva-authored email HTML, preserving supported markup, and surfacing compatibility issues before save.

### Modified Capabilities

- `email-template-management`: Template editing and preview requirements expand to cover imported HTML preservation mode, Canva compatibility validation, and revision-safe reuse of imported markup.
- `email-content-preparation`: Preparation requirements expand so imported template revisions are validated and rendered using the exact saved HTML that passed template import checks.

## Impact

- Affected specs: `canva-email-template-import`, `email-template-management`, `email-content-preparation`
- Affected code: `src/pages/AdminEmailTemplateEditorPage.tsx`, `src/services/emailTemplateService.ts`, `src/services/emailTemplateTokens.ts`, `src/services/emailContentPreparationService.ts`, `src/services/personalizedEmailComposer.ts`
- Affected tests: admin template editor tests, template service tests, and preparation/rendering regression coverage for imported HTML templates
