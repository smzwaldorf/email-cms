/**
 * 自定義 Hook - Markdown 轉換
 */

import { useState, useEffect } from 'react'
import { convertMarkdownToHtml } from '@/services/markdownService'

interface UseMarkdownConverterResult {
  html: string
  isConverting: boolean
  error: Error | null
}

export function useMarkdownConverter(markdown: string): UseMarkdownConverterResult {
  const [html, setHtml] = useState('')
  const [isConverting, setIsConverting] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!markdown) {
      setHtml('')
      setIsConverting(false)
      return
    }

    setIsConverting(true)
    setError(null)

    convertMarkdownToHtml(markdown)
      .then((convertedHtml) => {
        setHtml(convertedHtml)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Conversion failed'))
      })
      .finally(() => {
        setIsConverting(false)
      })
  }, [markdown])

  return { html, isConverting, error }
}
