import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {ArticleForm} from '@/components/admin/ArticleForm'
import {canonicalClassReferences} from '@/utils/classReferences'
import type {AdminArticle} from '@/types/admin'
const classes=[{id:'auth-class',name:'甲辰',legacyIds:['JIACHEN']}]
describe('Auth class references in article editor',()=>{
 it('keeps unknown and ambiguous references intact',()=>{expect(canonicalClassReferences(['JIACHEN','unknown'],classes)).toEqual(['auth-class','unknown']);expect(canonicalClassReferences(['JIACHEN'],[...classes,{id:'other',legacyIds:['JIACHEN']}])).toEqual(['JIACHEN'])})
 it('shows legacy target selected and saves the canonical Auth ID',async()=>{
 const save=vi.fn()
 const article: AdminArticle={weekNumber:'2025-W47',order:1,id:'alias-article',title:'Class note',content:'Body',status:'published',createdAt:'2026-01-01',updatedAt:'2026-01-01',newsletterTargetingMode:'targeted',newsletterTargetClassIds:['JIACHEN'],classIds:[],familyIds:[]}
 render(<ArticleForm article={article} availableClasses={classes} showNewsletterTargeting onSave={save}/>)
 expect(screen.getAllByRole('checkbox',{name:'甲辰'})[1]).toBeChecked()
 fireEvent.click(screen.getByRole('button',{name:'保存'}))
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({newsletterTargetClassIds:['auth-class']})))
 })
})
