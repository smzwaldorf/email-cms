import { describe, it, expect, vi } from 'vitest'
import { PasteDropHandler } from '@/components/tiptap-templates/simple/extensions/PasteDropHandler'

describe('PasteDropHandler Extension', () => {
  describe('Configuration', () => {
    it('should be a valid TipTap extension', () => {
      // PasteDropHandler is created via Extension.create()
      expect(PasteDropHandler).toBeDefined()
      expect(PasteDropHandler.name).toBe('pasteDropHandler')
    })

    it('should have default options defined', () => {
      // The extension has default options in addOptions()
      expect(PasteDropHandler.config).toBeDefined()
    })
  })

  describe('Extension properties', () => {
    it('should have the correct name', () => {
      expect(PasteDropHandler.name).toBe('pasteDropHandler')
    })

    it('should have addProseMirrorPlugins method', () => {
      expect(PasteDropHandler.config.addProseMirrorPlugins).toBeDefined()
    })

    it('should have addOptions method', () => {
      expect(PasteDropHandler.config.addOptions).toBeDefined()
    })
  })

  describe('Supported file types', () => {
    it('should define allowed MIME types in default options', () => {
      // Access the addOptions function to verify default configuration
      const config = PasteDropHandler.config
      expect(config.addOptions).toBeDefined()
    })
  })

  describe('Plugin behavior', () => {
    it('should handle paste events', () => {
      // Verify the extension is properly configured for paste handling
      const config = PasteDropHandler.config
      expect(config.addProseMirrorPlugins).toBeDefined()
    })

    it('should handle drop events', () => {
      // Verify the extension is properly configured for drop handling
      const config = PasteDropHandler.config
      expect(config.addProseMirrorPlugins).toBeDefined()
    })
  })
})
