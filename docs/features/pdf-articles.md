# PDF articles with narration

In **文章管理**, select a newsletter and expand **從 PDF 建立有聲文章**.
Choose a PDF (up to 10 MB), extract and review the text (up to 12,000 Unicode
characters), then generate narration. The resulting draft contains a player above
the text. Publication remains the normal editorial action.

## Configuration

Apply `db/migrations/20260928_article_narration.sql`, followed by
`db/migrations/20260928_expand_narration_audio.sql`, then
`db/migrations/20261012_narration_r2.sql`, using the normal reviewed
migration process. Set `OPENAI_API_KEY` in the backend environment (`.env.local`
for Node). For Cloudflare, set it as a Worker secret separately for each environment:

```sh
npx wrangler secret put OPENAI_API_KEY --config apps/backend/wrangler.jsonc
```

The command above targets the default Worker in that config. Use the matching deployment config/environment; never put this key in frontend/VITE
variables. `OPENAI_PDF_MODEL` optionally overrides `gpt-4.1-mini` with a
Responses-compatible vision model. Speech uses `gpt-4o-mini-tts`, voice `coral`.
The API key needs access to both models and funded API usage.

PDFs are sent inline to OpenAI's Responses API with `store: false`; the original
PDF is not retained by the CMS. Model transcription can misread text, especially
scans and complex tables, so the review step is deliberate. Empty, incomplete,
refused, and oversized extraction results are rejected without creating an article.

## Persistence and recovery

Draft creation and narration transcripts are committed together. A client request
UUID makes retries of draft creation idempotent. Each speech request processes one
bounded section (at most 600 Unicode characters) and uploads its MP3 to the private
R2 `MEDIA_BUCKET` binding. PostgreSQL stores the transcript and object reference;
new audio bytes are never saved in PostgreSQL. Keys use
`<environment>/narrations/<article-id>/<part-index>/<lease-id>.mp3`.
Development and staging use `smz-cms-media-dev-staging` with separate prefixes;
production uses `smz-cms-media-production`. Node development uses the existing
Wrangler remote binding proxy configured in `config/r2-development.jsonc`.
Follow `docs/MEDIA-STORAGE.md` for local R2 configuration and authentication.
Missing R2 configuration fails generation before calling OpenAI.

A section becomes ready only after the R2 upload and lease-checked database update
succeed. A lost lease removes that attempt's unique object. An ambiguous database
failure can leave an unreferenced object; cleanup must reconcile keys with stored
references before deleting anything. Permanent article deletion removes database
references but currently leaves R2 objects for that same reconciliation process.
Existing database-backed sections remain playable; this migration does not move
or regenerate historical audio. Each generated section remains bounded to 8 MiB.

Completed sections are reused on retry. A three-minute lease prevents concurrent
requests from generating the same section; failed requests release their leases.
If the browser closes, reopen the saved draft in the rich-text editor and use
**繼續產生未完成的語音** in the player. The player advances between sections and
allows section selection. It fetches audio with the current session and revokes
local blob URLs when switching/unmounting. No publicly reusable audio URLs are issued.

Only CMS managers may extract/create/generate. Playback uses current article
reader permissions (including publication/class restrictions); managers may preview
drafts. Deleting an article permanently cascades to its narration database records. Soft-deleted
articles cannot serve audio. Audio is excluded from generic data/query access.

Narration is a snapshot of the reviewed text. Later text edits do not regenerate
speech; the import UI states this. Readers see an explicit AI-generated voice label.

API routes:

- `POST /api/admin/pdf-articles/extract`: `{ filename, data }` (base64 PDF).
- `POST /api/admin/pdf-articles`: `{ newsletterId, requestId, title, text }`.
- `POST /api/admin/pdf-articles/:articleId/parts/:index`: generate/retry one part.
- `GET /api/narrations/:articleId`: ordered readiness manifest.
- `GET /api/narrations/:articleId/:index`: authenticated MP3 bytes.

References: [PDF inputs](https://developers.openai.com/api/docs/guides/file-inputs),
[Speech generation](https://developers.openai.com/api/docs/guides/text-to-speech).
