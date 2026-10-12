import { useEffect, useRef, useState } from 'react'
import { pdfArticleApi } from '@/services/pdfArticleApi'

interface Props {
  newsletterId: string
  onCreated: (articleId: string) => void
}
const fieldClass =
  'w-full rounded-lg border border-waldorf-cream-300 bg-white px-3 py-2 text-sm'
export function PdfArticleImport({ newsletterId, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [articleId, setArticleId] = useState<string | null>(null)
  const requestId = useRef(crypto.randomUUID())
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const count = Array.from(text).length

  async function extract() {
    if (!file || running.current) return
    running.current = true
    setBusy(true)
    setError('')
    setProgress('正在擷取 PDF 文字…')
    try {
      const result = await pdfArticleApi.extract(file)
      setTitle(result.title)
      setText(result.text)
      setProgress('文字已擷取，請確認內容後產生語音。')
    } catch (error) {
      setError(error instanceof Error ? error.message : '擷取失敗')
      setProgress('')
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  async function generate() {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      setProgress('正在建立草稿…')
      const currentId =
        articleId ??
        (
          await pdfArticleApi.create({
            newsletterId,
            requestId: requestId.current,
            title,
            text,
          })
        ).articleId
      setArticleId(currentId)
      const { parts } = await pdfArticleApi.manifest(currentId)
      for (const [index, part] of parts.entries()) {
        if (!mounted.current) return
        setProgress(`正在產生語音 ${index + 1} / ${parts.length}…`)
        if (!part.ready)
          await pdfArticleApi.generate(currentId, part.part_index)
      }
      setProgress('草稿與語音已完成。')
      if (mounted.current) onCreated(currentId)
    } catch (error) {
      setError(error instanceof Error ? error.message : '產生語音失敗')
      setProgress('')
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-waldorf-cream-200 bg-white p-5">
      <button
        type="button"
        className="font-semibold text-waldorf-sage-700"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        從 PDF 建立有聲文章
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-waldorf-clay-600">
            上傳 PDF → 確認文字 → 產生語音與草稿。PDF 和文字會交由 OpenAI
            處理；讀者會看到 AI 生成語音標示。
          </p>
          <p className="text-xs text-waldorf-clay-500">
            PDF 上限 10 MB，文字上限 12,000
            字。長文會分段朗讀，完成後可在編輯器調整文章。
          </p>
          {!articleId && (
            <>
              <label className="block text-sm">
                PDF 檔案
                <input
                  aria-label="PDF 檔案"
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={busy}
                  className="mt-1 block"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setText('')
                    setTitle('')
                    setError('')
                    setProgress('')
                    requestId.current = crypto.randomUUID()
                  }}
                />
              </label>
              <button
                type="button"
                disabled={!file || busy}
                onClick={() => void extract()}
                className="rounded-lg border px-4 py-2 disabled:opacity-50"
              >
                擷取文字
              </button>
            </>
          )}
          {(text || articleId) && (
            <>
              <label className="block text-sm">
                文章標題
                <input
                  aria-label="文章標題"
                  className={fieldClass}
                  value={title}
                  maxLength={200}
                  disabled={busy || !!articleId}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                確認擷取文字
                <textarea
                  aria-label="確認擷取文字"
                  rows={12}
                  className={fieldClass}
                  value={text}
                  disabled={busy || !!articleId}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
              <p className="text-xs">
                {count.toLocaleString()} / 12,000
                字。語音依這份確認後的文字產生，之後編輯文章不會自動更新語音。
              </p>
              <button
                type="button"
                disabled={
                  busy || !title.trim() || !text.trim() || count > 12000
                }
                onClick={() => void generate()}
                className="rounded-lg bg-waldorf-sage-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {articleId ? '重試未完成的語音' : '產生語音並建立草稿'}
              </button>
            </>
          )}
          {progress && (
            <p role="status" className="text-sm">
              {progress}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
              {articleId &&
                ' 文字草稿已保存；可重試，或稍後在文章播放器繼續產生語音。'}
            </p>
          )}
          {busy && (
            <p className="text-xs">處理可能需要幾分鐘，請保持此頁開啟。</p>
          )}
        </div>
      )}
    </section>
  )
}
