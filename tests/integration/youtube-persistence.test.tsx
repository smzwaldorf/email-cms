/**
 * 整合測試 - YouTube 影片持久化 (資料庫加載)
 * Integration Test - YouTube Video Persistence (Database Loading)
 * 驗證 YouTube 影片可以從資料庫正確加載和顯示
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TipTapYoutubeNode } from '@/adapters/TipTapYoutubeNode'

/**
 * Test component that loads HTML content with YouTube video
 */
function EditorWithPersistentVideo({ htmlContent }: { htmlContent: string }) {
  const editor = useEditor({
    extensions: [StarterKit, TipTapYoutubeNode],
    content: htmlContent,
  })

  if (!editor) return <div>Loading...</div>

  return (
    <div data-testid="editor-container">
      <EditorContent editor={editor} data-testid="editor-content" />
    </div>
  )
}

describe('Integration: YouTube Video Persistence - Database Loading', () => {
  describe('Loading YouTube Videos from HTML Content', () => {
    it('should load YouTube video from wrapped div structure', async () => {
      const htmlContent = `
        <p>Watch this tutorial:</p>
        <div data-youtube-video class="youtube-video-wrapper">
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
            class="youtube-iframe"
            frameborder="0"
            allowfullscreen="true"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
        <p>Thanks for watching!</p>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      // Check that the video wrapper exists
      await waitFor(() => {
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThan(0)
      })
    })

    it('should load YouTube video from plain iframe element', async () => {
      const htmlContent = `
        <p>Check out this video:</p>
        <iframe src="https://www.youtube.com/embed/9bZkp7q19f0?rel=0&modestbranding=1"
          frameborder="0"
          allowfullscreen="true"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
        <p>Subscribe for more content!</p>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        // Check that the iframe exists
        const iframes = container.querySelectorAll('iframe')
        expect(iframes.length).toBeGreaterThan(0)

        // Verify the iframe has the correct src
        const iframe = iframes[0]
        const src = iframe.getAttribute('src') || ''
        expect(src).toContain('youtube.com/embed/9bZkp7q19f0')
      })
    })

    it('should preserve paragraph content around video', async () => {
      const htmlContent = `
        <p>Before video</p>
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
            frameborder="0" allowfullscreen="true">
          </iframe>
        </div>
        <p>After video</p>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        // Check text content
        const textContent = container.textContent || ''
        expect(textContent).toContain('Before video')
        expect(textContent).toContain('After video')
      })
    })

    it('should handle multiple videos in same content', async () => {
      const htmlContent = `
        <p>First video:</p>
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
            frameborder="0" allowfullscreen="true">
          </iframe>
        </div>
        <p>Second video:</p>
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/9bZkp7q19f0?rel=0&modestbranding=1"
            frameborder="0" allowfullscreen="true">
          </iframe>
        </div>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        // Should have multiple video wrappers
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('should handle video with start time parameter', async () => {
      const htmlContent = `
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=120"
            frameborder="0" allowfullscreen="true">
          </iframe>
        </div>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        const iframes = container.querySelectorAll('iframe')
        expect(iframes.length).toBeGreaterThan(0)

        const src = iframes[0].getAttribute('src') || ''
        expect(src).toContain('start=120')
      })
    })

    it('should handle video with autoplay parameter', async () => {
      const htmlContent = `
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&autoplay=1"
            frameborder="0" allowfullscreen="true">
          </iframe>
        </div>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        const iframes = container.querySelectorAll('iframe')
        const src = iframes[0].getAttribute('src') || ''
        expect(src).toContain('autoplay=1')
      })
    })
  })

  describe('Persistence Round-Trip (Save and Load)', () => {
    it('should correctly identify video in loaded HTML', async () => {
      // Simulate saving and reloading from database
      const originalVideoUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
      const htmlContent = `
        <p>Tutorial content</p>
        <div data-youtube-video class="youtube-video-wrapper">
          <iframe src="${originalVideoUrl}"
            class="youtube-iframe"
            frameborder="0"
            allowfullscreen="true"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        // Verify the URL is preserved
        const iframes = container.querySelectorAll('iframe')
        expect(iframes.length).toBeGreaterThan(0)

        const loadedUrl = iframes[0].getAttribute('src')
        expect(loadedUrl).toBe(originalVideoUrl)
      })
    })

    it('should handle complex content with videos, text, and formatting', async () => {
      const htmlContent = `
        <h2>Tutorial Series</h2>
        <p>In this lesson, we'll learn:</p>
        <ul>
          <li>Video basics</li>
          <li>Embedding techniques</li>
        </ul>
        <h3>Main Tutorial</h3>
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
            frameborder="0" allowfullscreen="true">
          </iframe>
        </div>
        <p>As you can see in the video above, the process is straightforward.</p>
        <h3>Practice Exercise</h3>
        <p>Try embedding your own video below:</p>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        // All content should be preserved
        const textContent = container.textContent || ''
        expect(textContent).toContain('Tutorial Series')
        expect(textContent).toContain('Video basics')
        expect(textContent).toContain('Practice Exercise')

        // Video should still be present
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Recovery and Edge Cases', () => {
    it('should handle iframe without src attribute gracefully', async () => {
      const htmlContent = `
        <p>Content before</p>
        <div data-youtube-video>
          <iframe frameborder="0" allowfullscreen="true">
            Video not available
          </iframe>
        </div>
        <p>Content after</p>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        // Should still render without crashing
        const textContent = container.textContent || ''
        expect(textContent).toContain('Content before')
        expect(textContent).toContain('Content after')
      })
    })

    it('should handle mixed iframe formats', async () => {
      const htmlContent = `
        <p>First format:</p>
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
            frameborder="0" allowfullscreen="true">
          </iframe>
        </div>
        <p>Second format (plain iframe):</p>
        <iframe src="https://www.youtube.com/embed/9bZkp7q19f0?rel=0&modestbranding=1"
          frameborder="0" allowfullscreen="true">
        </iframe>
        <p>End of content</p>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        // Both formats should coexist
        const allIframes = container.querySelectorAll('iframe')
        expect(allIframes.length).toBeGreaterThanOrEqual(2)

        // Verify both URLs are present
        const urls = Array.from(allIframes)
          .map((iframe) => iframe.getAttribute('src'))
          .filter((src) => src)

        expect(urls.some((url) => url?.includes('dQw4w9WgXcQ'))).toBe(true)
        expect(urls.some((url) => url?.includes('9bZkp7q19f0'))).toBe(true)
      })
    })
  })

  describe('Database Content Scenarios', () => {
    it('should load content saved from ArticleEditor', async () => {
      // Simulate content structure saved by ArticleEditor
      const savedContent = `
        <p>Introduction to React</p>
        <div data-youtube-video class="youtube-video-wrapper">
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1" class="youtube-iframe" frameborder="0" allowfullscreen="true" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
        </div>
        <p>This video covers the basics of React hooks.</p>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={savedContent} />)

      await waitFor(() => {
        // Should display correctly
        expect(container.querySelectorAll('[data-youtube-video]').length).toBeGreaterThan(0)
        expect(container.textContent).toContain('Introduction to React')
        expect(container.textContent).toContain('React hooks')
      })
    })

    it('should preserve iframe allow attributes', async () => {
      const htmlContent = `
        <div data-youtube-video>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
            frameborder="0" allowfullscreen="true"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
      `

      const { container } = render(<EditorWithPersistentVideo htmlContent={htmlContent} />)

      await waitFor(() => {
        const iframe = container.querySelector('iframe')
        expect(iframe).toBeInTheDocument()
        expect(iframe?.getAttribute('allow')).toContain('autoplay')
        expect(iframe?.getAttribute('allow')).toContain('encrypted-media')
      })
    })
  })
})
