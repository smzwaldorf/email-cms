import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { expect, it } from 'vitest'
import { TipTapAudioNode } from '@/adapters/TipTapAudioNode'
it('preserves narration before article text across editor saves', () => {
  const src = 'narration://11111111-1111-4111-8111-111111111111'
  const editor = new Editor({
    extensions: [StarterKit, TipTapAudioNode],
    content: `<div data-audio-node="true" data-src="${src}" data-caption="AI 生成語音"></div><p>中文文章</p>`,
  })
  const saved = editor.getHTML()
  editor.commands.setContent(saved)
  expect(editor.getJSON().content?.[0]).toMatchObject({
    type: 'audio',
    attrs: { src, caption: 'AI 生成語音' },
  })
  expect(editor.getJSON().content?.[1]).toMatchObject({
    type: 'paragraph',
    content: [{ type: 'text', text: '中文文章' }],
  })
  editor.destroy()
})
