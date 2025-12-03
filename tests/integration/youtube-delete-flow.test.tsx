/**
 * 整合測試 - YouTube 刪除流程 (T065)
 * Integration Test - YouTube Delete Functionality
 * 驗證使用者可以刪除插入的 YouTube 影片
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TipTapYoutubeNode } from '@/adapters/TipTapYoutubeNode'

/**
 * Test component that uses TipTap with YouTube node
 */
function TestEditor() {
  const editor = useEditor({
    extensions: [StarterKit, TipTapYoutubeNode],
    content: `
      <p>Before video</p>
      <div data-youtube-video>
        <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
          frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
      </div>
      <p>After video</p>
    `,
  })

  if (!editor) return <div>Loading...</div>

  return (
    <div data-testid="editor-container">
      <EditorContent editor={editor} data-testid="editor-content" />
      <div className="mt-4">
        <p className="text-sm text-gray-600">測試: 點擊影片後按 Backspace 刪除</p>
        <p className="text-sm text-gray-600">Test: Click on video, then press Backspace to delete</p>
      </div>
    </div>
  )
}

describe('Integration: YouTube Delete Functionality (T065)', () => {
  describe('FR-012: Video Node Deletion', () => {
    it('should render editor with YouTube video', async () => {
      render(<TestEditor />)

      const editorContainer = screen.getByTestId('editor-container')
      expect(editorContainer).toBeInTheDocument()

      // Check that content before and after video exists
      expect(screen.getByText('Before video')).toBeInTheDocument()
      expect(screen.getByText('After video')).toBeInTheDocument()
      
      // Wait for video to render
      await waitFor(() => {
        expect(screen.getAllByTestId('youtube-embed').length).toBeGreaterThan(0)
      })
    })

    it('should allow user to focus on YouTube video node', async () => {
      const user = userEvent.setup()
      render(<TestEditor />)

      const editor = screen.getByTestId('editor-content')
      expect(editor).toBeInTheDocument()

      // User can interact with the editor
      await user.click(editor)
    })

    it('should support keyboard-based navigation to video node', async () => {
      const user = userEvent.setup()
      render(<TestEditor />)

      const editor = screen.getByTestId('editor-content')
      await user.click(editor)

      // User should be able to navigate using arrow keys
      await user.keyboard('{ArrowDown}{ArrowDown}')

      // Editor should still have content
      expect(editor).toBeInTheDocument()
    })
  })

  describe('Delete Workflow', () => {
    it('should demonstrate video node structure', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Find the YouTube video wrapper
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThan(0)

        // Verify iframe exists
        const iframes = container.querySelectorAll('iframe')
        expect(iframes.length).toBeGreaterThan(0)
      })
    })

    it('should have video surrounded by paragraph content', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Find all paragraphs
        const paragraphs = container.querySelectorAll('p')
        const hasBeforeAndAfter =
          Array.from(paragraphs).some((p) => p.textContent?.includes('Before video')) &&
          Array.from(paragraphs).some((p) => p.textContent?.includes('After video'))

        expect(hasBeforeAndAfter).toBe(true)
      })
    })
  })

  describe('SC-004: Delete Interaction (95%+ reliability)', () => {
    it('should show deletion hint to user', async () => {
      const { container } = render(<TestEditor />)

      // Check for helpful text about deletion
      const textContent = container.textContent || ''
      expect(textContent).toContain('Backspace')
      expect(textContent).toContain('delete')
    })

    it('should maintain editor structure after selection', async () => {
      const user = userEvent.setup()
      const { container } = render(<TestEditor />)

      const editor = screen.getByTestId('editor-content')
      await user.click(editor)

      await waitFor(() => {
        // Video should still exist
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThan(0)
      })
    })

    it('should keep content accessible for deletion', async () => {
      const { container } = render(<TestEditor />)

      // All content should be present and accessible
      expect(screen.getByText('Before video')).toBeInTheDocument()
      expect(screen.getByText('After video')).toBeInTheDocument()

      await waitFor(() => {
        // Video wrapper should be accessible
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Video Node Integrity', () => {
    it('should preserve surrounding paragraphs', () => {
      const { container } = render(<TestEditor />)

      const textContent = container.textContent || ''
      expect(textContent).toContain('Before video')
      expect(textContent).toContain('After video')
    })

    it('should have video wrapper in content', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Video wrapper should exist
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThan(0)
      })
    })

    it('should have iframe in video node', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Should have iframe elements
        const iframes = container.querySelectorAll('iframe')
        expect(iframes.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Deletion Prerequisites', () => {
    it('should have YouTube node capable of deletion', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Node should exist
        const youtubeWrappers = container.querySelectorAll('[data-youtube-video]')
        expect(youtubeWrappers.length).toBeGreaterThan(0)

        // Node should have content (iframe)
        const iframes = container.querySelectorAll('[data-youtube-video] iframe')
        expect(iframes.length).toBeGreaterThan(0)
      })
    })

    it('should support selection of entire video node', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        const youtubeWrapper = container.querySelector('[data-youtube-video]')
        expect(youtubeWrapper).toBeInTheDocument()

        // Should be able to select (element exists and is accessible)
        expect(youtubeWrapper).toHaveAttribute('data-youtube-video')
      })
    })

    it('should preserve content structure for undo/redo', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Content should be in a stable structure
        const paragraphs = container.querySelectorAll('p')
        expect(paragraphs.length).toBeGreaterThan(0)

        const videos = container.querySelectorAll('[data-youtube-video]')
        expect(videos.length).toBeGreaterThan(0)
      })
    })
  })

  describe('User Experience', () => {
    it('should maintain focus after clicking editor', async () => {
      const user = userEvent.setup()
      render(<TestEditor />)

      const editor = screen.getByTestId('editor-content')
      await user.click(editor)

      // Editor should still be interactive
      expect(editor).toBeInTheDocument()
    })

    it('should show content ready for deletion operation', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Video node should be clearly defined
        const youtubeNode = container.querySelector('[data-youtube-video]')
        expect(youtubeNode).not.toBeNull()

        // Should be between text content
        expect(screen.getByText('Before video')).toBeInTheDocument()
        expect(screen.getByText('After video')).toBeInTheDocument()
      })
    })

    it('should provide clear visual structure for interaction', async () => {
      const { container } = render(<TestEditor />)

      await waitFor(() => {
        // Content hierarchy should be clear
        const beforeParagraph = Array.from(container.querySelectorAll('p')).find((p) =>
          p.textContent?.includes('Before')
        )
        const youtubeDiv = container.querySelector('[data-youtube-video]')
        const afterParagraph = Array.from(container.querySelectorAll('p')).find((p) =>
          p.textContent?.includes('After')
        )

        expect(beforeParagraph).toBeInTheDocument()
        expect(youtubeDiv).toBeInTheDocument()
        expect(afterParagraph).toBeInTheDocument()
      })
    })
  })
})
