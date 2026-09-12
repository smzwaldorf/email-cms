import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/services/serverSessionMode', () => ({ serverSessionMode: true }))
vi.mock('@/services/backendClient', () => ({ getStoredAuthUser: () => ({ id: 'person' }) }))
import { usePersistentDraft } from '@/hooks/usePersistentDraft'
beforeEach(() => localStorage.clear())
describe('identity-scoped editor drafts', () => {
  it('restores unsaved work after an editor reload and removes it after confirmed save', () => {
    const initial = { title: 'Original', content: 'Text' }
    const first=renderHook(()=>usePersistentDraft('article:one',initial))
    act(()=>first.result.current[1]({title:'Unsaved',content:'Draft'}));first.unmount()
    const restored=renderHook(()=>usePersistentDraft('article:one',initial))
    expect(restored.result.current[0].title).toBe('Unsaved')
    act(()=>restored.result.current[2]())
    expect(localStorage.getItem('email-cms-draft:person:article:one')).toBeNull()
  })
  it('does not silently overwrite a newer server version with an older draft', () => {
    localStorage.setItem('email-cms-draft:person:article:one',JSON.stringify({baseline:JSON.stringify({title:'old'}),value:{title:'my draft'}}))
    const hook=renderHook(()=>usePersistentDraft('article:one',{title:'new server version'}))
    expect(hook.result.current[0].title).toBe('new server version')
    expect(hook.result.current[3]?.title).toBe('my draft')
    act(()=>hook.result.current[4]())
    expect(hook.result.current[0].title).toBe('my draft')
  })
  it('does not restore a draft belonging to another person', () => {
    localStorage.setItem('email-cms-draft:other:article:one',JSON.stringify({baseline:JSON.stringify({title:'old'}),value:{title:'private'}}))
    expect(renderHook(()=>usePersistentDraft('article:one',{title:'old'})).result.current[0].title).toBe('old')
  })
})
