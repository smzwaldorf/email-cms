import '@tiptap/core'
import '@tiptap/extension-image'
import type { AudioNodeOptions } from '@/adapters/TipTapAudioNode'

declare module '@tiptap/extension-image' {
  interface ImageOptions {
    articleId?: string
  }

  interface SetImageOptions {
    mediaId?: string
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audio: {
      setAudio: (options: AudioNodeOptions) => ReturnType
      updateAudio: (options: Partial<AudioNodeOptions>) => ReturnType
    }
  }
}
