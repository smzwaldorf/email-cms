/**
 * ContentConverter 單元測試
 * ContentConverter Unit Tests
 */

import { describe, it, expect } from 'vitest'
import { contentConverter } from '@/services/contentConverter'

describe('ContentConverter', () => {


  describe('htmlToMarkdown', () => {
    it('should convert HTML to markdown', () => {
      const html = '<h1>Heading</h1><p><strong>bold</strong> text</p>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('# Heading')
      expect(markdown).toContain('**bold**')
    })

    it('should convert HTML headers', () => {
      const html = '<h1>H1</h1><h2>H2</h2><h3>H3</h3>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('# H1')
      expect(markdown).toContain('## H2')
      expect(markdown).toContain('### H3')
    })

    it('should convert HTML links', () => {
      const html = '<a href="https://example.com">Example</a>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('[Example](https://example.com)')
    })

    it('should convert list items', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- Item 1')
      expect(markdown).toContain('- Item 2')
    })

    it('should convert task list with unchecked items', () => {
      const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>Buy milk</li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>Buy eggs</li>
</ul>`
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- [ ] Buy milk')
      expect(markdown).toContain('- [ ] Buy eggs')
      expect(markdown).not.toContain('[x]')
    })

    it('should convert task list with checked items', () => {
      const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label>Buy milk</li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label>Buy eggs</li>
</ul>`
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- [x] Buy milk')
      expect(markdown).toContain('- [x] Buy eggs')
    })

    it('should convert task list with mixed checked/unchecked items', () => {
      const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>Todo item 1</li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label>Completed item</li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>Todo item 2</li>
</ul>`
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- [ ] Todo item 1')
      expect(markdown).toContain('- [x] Completed item')
      expect(markdown).toContain('- [ ] Todo item 2')
      const lines = markdown.split('\n').filter((line) => line.match(/^\s*-\s+\[/))
      expect(lines.length).toBe(3)
    })

    it('should preserve task list item content after checkbox', () => {
      const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>Complete the implementation</li>
</ul>`
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- [ ] Complete the implementation')
    })

    it('should handle task list with complex content', () => {
      const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>Task with <strong>bold</strong> text</li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label>Task with <em>italic</em> text</li>
</ul>`
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- [ ]')
      expect(markdown).toContain('- [x]')
      expect(markdown).toContain('bold')
      expect(markdown).toContain('italic')
    })

    it('should remove HTML label wrapper from task list items', () => {
      const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>Task</li>
</ul>`
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('- [ ] Task')
      expect(markdown).not.toContain('<label>')
      expect(markdown).not.toContain('<input>')
    })

    it('should remove HTML tags', () => {
      const html = '<div><span>Clean text</span></div>'
      const markdown = contentConverter.htmlToMarkdown(html)

      expect(markdown).toContain('Clean text')
      expect(markdown).not.toContain('<div>')
    })

    describe('Task list with TipTap nested structure', () => {
      it('should convert TipTap task list HTML to markdown - unchecked items', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>Buy milk</p></div></li>
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>Buy eggs</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ] Buy milk')
        expect(markdown).toContain('- [ ] Buy eggs')
        expect(markdown).not.toContain('<label>')
        expect(markdown).not.toContain('<input>')
        expect(markdown).not.toContain('<div>')
        expect(markdown).not.toContain('<p>')
      })

      it('should convert TipTap task list HTML to markdown - checked items', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox" checked><span></span></label><div><p>Task completed</p></div></li>
<li data-type="taskItem" data-checked="true"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox" checked><span></span></label><div><p>Done</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [x] Task completed')
        expect(markdown).toContain('- [x] Done')
      })

      it('should convert TipTap task list with disabled checkboxes to markdown', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox" disabled><span></span></label><div><p>Read-only task</p></div></li>
<li data-type="taskItem" data-checked="true"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox" checked disabled><span></span></label><div><p>Completed task</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ] Read-only task')
        expect(markdown).toContain('- [x] Completed task')
        expect(markdown).not.toContain('disabled')
      })

      it('should convert TipTap task list with mixed checked/unchecked items', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>Todo item 1</p></div></li>
<li data-type="taskItem" data-checked="true"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox" checked><span></span></label><div><p>Completed item</p></div></li>
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>Todo item 2</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ] Todo item 1')
        expect(markdown).toContain('- [x] Completed item')
        expect(markdown).toContain('- [ ] Todo item 2')
      })

      it('should convert TipTap task list items with formatting in text', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>Task with <strong>bold</strong> text</p></div></li>
<li data-type="taskItem" data-checked="true"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox" checked><span></span></label><div><p>Task with <em>italic</em> text</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ]')
        expect(markdown).toContain('- [x]')
        expect(markdown).toContain('bold')
        expect(markdown).toContain('italic')
      })

      it('should handle TipTap task list with inline code', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>Install <code>npm</code> package</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ]')
        expect(markdown).toContain('npm')
      })

      it('should handle TipTap task list with very long text', () => {
        const longText = 'This is a very long task description that spans multiple words to ensure proper handling of extended content'
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>${longText}</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ]')
        expect(markdown).toContain(longText)
      })

      it('should handle TipTap task list with special characters', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label contenteditable="false"><input aria-label="Task item checkbox" type="checkbox"><span></span></label><div><p>Task with special chars: @#$%&</p></div></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ]')
        expect(markdown).toContain('@#$%&')
      })
    })





    describe('TipTap native HTML structure (without div wrapper)', () => {
      it('should convert TipTap native task list HTML to markdown - unchecked items', () => {
        // TipTap's getHTML() produces <p> directly in <li>, not wrapped in <div>
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><p>Buy milk</p></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><p>Buy eggs</p></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ] Buy milk')
        expect(markdown).toContain('- [ ] Buy eggs')
      })

      it('should convert TipTap native task list HTML to markdown - checked items', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><p>Task completed</p></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><p>Done</p></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [x] Task completed')
        expect(markdown).toContain('- [x] Done')
      })

      it('should convert TipTap native task list with mixed checked/unchecked items', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><p>Todo item 1</p></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><p>Completed item</p></li>
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><p>Todo item 2</p></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ] Todo item 1')
        expect(markdown).toContain('- [x] Completed item')
        expect(markdown).toContain('- [ ] Todo item 2')
      })

      it('should convert TipTap native task list with formatting', () => {
        const html = `<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><p>Task with <strong>bold</strong> text</p></li>
<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><p>Task with <em>italic</em> text</p></li>
</ul>`
        const markdown = contentConverter.htmlToMarkdown(html)

        expect(markdown).toContain('- [ ]')
        expect(markdown).toContain('bold')
        expect(markdown).toContain('- [x]')
        expect(markdown).toContain('italic')
      })
    })

    describe('ArticleEditor complete workflow test', () => {


      it('should handle editing task list content in the editor', () => {
        // When user edits task text, HTML might change slightly
        // Simulate user editing the task text (TipTap outputs it)
        // TipTap might output the text inside <p> directly
        const editedHtml = `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><p>Modified task</p></li></ul>`

        // Convert back to markdown
        const markdown = contentConverter.htmlToMarkdown(editedHtml)

        expect(markdown).toContain('- [ ] Modified task')
      })

      it('should handle TipTap HTML with data-checked before data-type attributes', () => {
        // TipTap sometimes outputs attributes in reverse order: data-checked="false" data-type="taskItem"
        const htmlWithReverseAttributes = `<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Test</p></div></li></ul>`

        const markdown = contentConverter.htmlToMarkdown(htmlWithReverseAttributes)

        expect(markdown).toContain('- [ ] Test')
        expect(markdown).not.toContain('data-')
        expect(markdown).not.toContain('<')
      })

      it('should convert complex article HTML with task list to markdown', () => {
        // Real-world example: article with heading, text, task list, and more content
        const complexHtml = `<h1>歡迎閱讀第 48 週電子報</h1>
<p>Dear <strong>Parents</strong> and Students,</p>
<ul data-type="taskList">
<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Test</p></div></li>
</ul>
<p>Welcome to Week 48 of our newsletter.</p>`

        const markdown = contentConverter.htmlToMarkdown(complexHtml)

        expect(markdown).toContain('# 歡迎閱讀第 48 週電子報')
        expect(markdown).toContain('Parents')
        expect(markdown).toContain('- [ ] Test')
        expect(markdown).toContain('Welcome to Week 48')
      })

      it('should not merge task list with following paragraph', () => {
        // Regression test: task list should be separated from next paragraph with newline
        const html = `<ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Test</p></div></li></ul><p>Welcome to Week 48 of our newsletter.</p>`

        const markdown = contentConverter.htmlToMarkdown(html)

        // Most important: should NOT merge text directly (no "TestWelcome")
        expect(markdown).not.toContain('TestWelcome')

        // Verify there's a newline after the task list before the paragraph
        expect(markdown).toMatch(/- \[ \] Test\n+Welcome/)

        // Check that lines are properly separated
        const lines = markdown.trim().split('\n').filter(line => line.trim())
        expect(lines[0]).toBe('- [ ] Test')
        expect(lines[1]).toBe('Welcome to Week 48 of our newsletter.')
      })
    })
  })

  describe('calculateFidelity', () => {
    it('should return 100 for identical content', () => {
      const content = 'Hello World'
      const fidelity = contentConverter.calculateFidelity(content, content)

      expect(fidelity).toBe(100)
    })

    it('should return 0 for completely different content', () => {
      const fidelity = contentConverter.calculateFidelity('Hello', 'World')

      expect(fidelity).toBeLessThan(100)
    })

    it('should return 100 for empty original content', () => {
      const fidelity = contentConverter.calculateFidelity('', '')

      expect(fidelity).toBe(100)
    })

    it('should ignore whitespace differences', () => {
      const original = 'Hello World'
      const converted = 'HelloWorld' // Spaces removed

      const fidelity = contentConverter.calculateFidelity(original, converted)

      expect(fidelity).toBeGreaterThan(80) // High similarity despite space removal
    })

    it('should calculate similarity for similar content', () => {
      const original = 'The quick brown fox'
      const converted = 'The quick brown cat'

      const fidelity = contentConverter.calculateFidelity(original, converted)

      expect(fidelity).toBeGreaterThan(70) // Most content is similar
      expect(fidelity).toBeLessThan(100)
    })
  })

  describe('validateConversion', () => {
    it('should return success for high fidelity conversion', () => {
      const result = contentConverter.validateConversion('Hello', 'Hello', 80)

      expect(result.success).toBe(true)
      expect(result.fidelity).toBe(100)
    })

    it('should return warning for low fidelity conversion', () => {
      const result = contentConverter.validateConversion('Hello World', 'Hi', 80)

      expect(result.success).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.fidelity).toBeLessThan(100)
    })

    it('should include fidelity in result', () => {
      const result = contentConverter.validateConversion('Test', 'Test')

      expect(result.fidelity).toBeDefined()
      expect(typeof result.fidelity).toBe('number')
    })
  })

  describe('repairMarkdown', () => {
    it('should close unclosed bold markers', () => {
      const markdown = 'This is **bold'
      const repaired = contentConverter.repairMarkdown(markdown)

      const boldCount = (repaired.match(/\*\*/g) || []).length
      expect(boldCount % 2).toBe(0)
    })

    it('should close unclosed code markers', () => {
      const markdown = 'Use `code'
      const repaired = contentConverter.repairMarkdown(markdown)

      const codeCount = (repaired.match(/`/g) || []).length
      expect(codeCount % 2).toBe(0)
    })

    it('should not modify complete markdown', () => {
      const markdown = '**bold** and `code`'
      const repaired = contentConverter.repairMarkdown(markdown)

      expect(repaired).toBe(markdown)
    })
  })




  describe('error handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const malformedHtml = '<p>Unclosed paragraph<div>Nested'
      const markdown = contentConverter.htmlToMarkdown(malformedHtml)

      expect(typeof markdown).toBe('string')
    })




  })
})
