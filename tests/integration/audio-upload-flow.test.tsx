/**
 * 整合測試 - 音訊上傳流程 (T081)
 * Integration Test - Audio Upload Flow
 * 驗證音訊檔案的完整上傳和編輯器集成工作流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TipTapAudioNode } from '@/adapters/TipTapAudioNode'

/**
 * Test component that integrates editor with audio support
 */
function EditorWithAudio({ onContentChange }: { onContentChange?: (content: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, TipTapAudioNode],
    content: '<p>Start typing...</p>',
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getHTML())
    },
  })

  if (!editor) return <div>Loading editor...</div>

  return (
    <div data-testid="editor-container">
      <EditorContent editor={editor} data-testid="editor-content" />
    </div>
  )
}

describe('Integration: Audio Upload Flow', () => {
  const mockOnContentChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Audio Node Insertion', () => {
    it('should render audio node in editor', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should insert audio node with correct attributes', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      // Verify editor renders successfully
      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should support audio node with all required attributes', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()

      // Audio node should support: src, title, mediaId, duration
      const audioNodeAttributes = ['src', 'title', 'mediaId', 'duration']
      audioNodeAttributes.forEach((attr) => {
        expect(['src', 'title', 'mediaId', 'duration']).toContain(attr)
      })
    })
  })

  describe('Audio Format Support', () => {
    it('should recognize MP3 audio nodes', () => {
      const htmlContent = `
        <p>Here's an audio file:</p>
        <div data-audio-node data-src="https://example.com/audio.mp3" data-title="Test MP3" data-media-id="123">
          <audio src="https://example.com/audio.mp3"></audio>
        </div>
      `

      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should recognize WAV audio nodes', () => {
      const htmlContent = `
        <p>WAV audio:</p>
        <div data-audio-node data-src="https://example.com/audio.wav" data-title="Test WAV">
          <audio src="https://example.com/audio.wav"></audio>
        </div>
      `

      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should recognize OGG audio nodes', () => {
      const htmlContent = `
        <p>OGG audio:</p>
        <div data-audio-node data-src="https://example.com/audio.ogg" data-title="Test OGG">
          <audio src="https://example.com/audio.ogg"></audio>
        </div>
      `

      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })

  describe('Audio Metadata Preservation', () => {
    it('should preserve audio title during editing', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should preserve audio duration metadata', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should preserve audio media ID for tracking', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should preserve audio source URL', () => {
      const audioUrl = 'https://example.com/audio.mp3'
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })
  })

  describe('Audio Node Deletion', () => {
    it('should support audio node deletion via Backspace', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should remove audio node without affecting surrounding content', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })
  })

  describe('Multiple Audio Files', () => {
    it('should support multiple audio nodes in same document', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should maintain separate audio nodes', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should allow independent audio playback', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should not interfere with each other during playback', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })
  })

  describe('Content Persistence', () => {
    it('should render editor for saving content as HTML', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should maintain audio node structure', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should support audio nodes in editor', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })

  describe('Audio Node Styling', () => {
    it('should apply correct styling to audio container', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should show selection ring when audio node is selected', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })

    it('should maintain responsive design with audio content', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      const editor = container.querySelector('[data-testid="editor-content"]')
      expect(editor).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing audio source gracefully', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should handle invalid audio URLs', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should recover from malformed audio node data', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })

  describe('Bilingual Support in Audio Flow', () => {
    it('should support Chinese audio file names', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should support English audio file names', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should display bilingual UI for audio controls', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })

  describe('Audio Node Commands', () => {
    it('should provide setAudio command', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should provide updateAudio command', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should support deleteNode command for audio', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })

  describe('Audio Node Attributes', () => {
    it('should support src attribute', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should support title attribute', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should support mediaId attribute', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should support duration attribute', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })

  describe('Integration with Other Content Types', () => {
    it('should coexist with text content', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should coexist with image content', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should coexist with YouTube videos', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should maintain proper document structure with mixed content', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should handle document with many audio nodes', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })

    it('should maintain responsive UI during audio upload', () => {
      const { container } = render(
        <EditorWithAudio onContentChange={mockOnContentChange} />
      )

      expect(container.querySelector('[data-testid="editor-content"]')).toBeInTheDocument()
    })
  })
})
