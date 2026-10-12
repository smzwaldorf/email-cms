import { useEffect, useRef, useState } from 'react'
import { pdfArticleApi, type NarrationManifest } from '@/services/pdfArticleApi'

export function NarrationPlayer({
  articleId,
  editable,
}: {
  articleId: string
  editable: boolean
}) {
  const [parts, setParts] = useState<NarrationManifest['parts']>([])
  const [index, setIndex] = useState(0)
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)
  const continuePlaying = useRef(false)
  useEffect(() => {
    let active = true
    setParts([])
    setError('')
    setIndex(0)
    pdfArticleApi
      .manifest(articleId)
      .then((result) => {
        if (active) setParts(result.parts)
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [articleId, retry])
  useEffect(() => {
    const controller = new AbortController()
    let url: string | undefined
    setSrc('')
    if (parts[index]?.ready) {
      pdfArticleApi
        .audio(articleId, parts[index].part_index, controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return
          url = URL.createObjectURL(blob)
          setSrc(url)
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(error.message)
        })
    }
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [articleId, index, parts])
  const missing = parts.some((part) => !part.ready)
  async function resume() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      for (const part of parts)
        if (!part.ready)
          await pdfArticleApi.generate(articleId, part.part_index)
      setRetry((value) => value + 1)
    } catch (error) {
      setError(error instanceof Error ? error.message : '語音產生失敗')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="space-y-2 rounded-lg border bg-gray-50 p-4"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <p className="text-sm font-medium">文章朗讀 · AI 生成語音</p>
      {parts.length > 1 && (
        <label className="text-sm">
          朗讀段落{' '}
          <select
            aria-label="朗讀段落"
            value={index}
            onChange={(event) => {
              continuePlaying.current = false
              setIndex(Number(event.target.value))
            }}
          >
            {parts.map((part, position) => (
              <option key={part.part_index} value={position}>
                第 {position + 1} / {parts.length} 段
                {part.ready ? '' : '（尚未產生）'}
              </option>
            ))}
          </select>
        </label>
      )}
      {src ? (
        <audio
          ref={audio}
          controls
          preload="metadata"
          src={src}
          className="w-full"
          onError={() => setError('語音無法播放，請重新載入。')}
          onCanPlay={() => {
            if (continuePlaying.current) {
              continuePlaying.current = false
              void audio.current
                ?.play()
                .catch(() => setError('請按播放繼續下一段。'))
            }
          }}
          onEnded={() => {
            if (index + 1 < parts.length) {
              continuePlaying.current = true
              setIndex((value) => value + 1)
            }
          }}
        />
      ) : (
        <p className="text-sm">
          {parts[index] && !parts[index].ready
            ? '此段語音尚未產生。'
            : '正在載入語音…'}
        </p>
      )}
      {missing && editable && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void resume()}
          className="text-sm text-blue-700"
        >
          {busy ? '正在產生語音…' : '繼續產生未完成的語音'}
        </button>
      )}
      {error && (
        <div role="alert" className="text-sm text-red-700">
          {error}{' '}
          <button
            type="button"
            onClick={() => {
              setError('')
              setRetry((value) => value + 1)
            }}
          >
            重新載入
          </button>
        </div>
      )}
    </div>
  )
}
