import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const boundary=vi.hoisted(()=>({upload:vi.fn(), from:vi.fn(), metadata:vi.fn()}))
vi.mock('@/services/backendApi',()=>({backendRequest:boundary.upload}))
vi.mock('@/lib/supabase',()=>({getSupabaseClient:()=>({auth:{getUser:async()=>({data:{user:{id:'current-editor'}}})},from:boundary.from})}))
vi.mock('@/services/quotaManager',()=>({quotaManager:{checkQuota:async()=>({allowed:true,stats:{isNearLimit:false}})}}))
vi.mock('@/services/rateLimiter',()=>({checkRateLimit:()=>({allowed:true}),recordUploadAttempt:vi.fn()}))
vi.mock('@/services/imageOptimizer',()=>({imageOptimizer:{optimize:async(file:File)=>({optimizedFile:file})}}))
vi.mock('@/services/mediaService',()=>({mediaService:{detectMediaType:async(file:File)=>({type:file.type.split('/')[0]}),validateFile:()=>({valid:true}),createMediaMetadata:boundary.metadata}}))
import {useMediaUpload} from '@/hooks/useMediaUpload'
beforeEach(()=>{
 boundary.from.mockReset();boundary.upload.mockReset();boundary.metadata.mockReset().mockResolvedValue({width:640,height:480})
 boundary.upload.mockResolvedValue({id:'server-media-id',filename:'garden.png',file_size:4,mime_type:'image/png',file_type:'image',uploaded_by:'current-editor',uploaded_at:'2026-10-07',updated_at:'2026-10-07',public_url:'storage://media/development/editor/server-media-id.png',storage_path:'development/editor/server-media-id.png'})
})
describe('R2 editor uploads',()=>{
 it('sends raw image bytes to the authorized backend and uses its committed metadata',async()=>{
  const {result}=renderHook(()=>useMediaUpload());const file=new File(['test'],'garden.png',{type:'image/png'});let files
  await act(async()=>{files=await result.current.uploadFiles([file],'article-id')})
  const [url,request]=boundary.upload.mock.calls[0]
  expect(url).toContain('/api/media/upload?');expect(url).toContain('articleId=article-id');expect(url).toContain('width=640')
  expect(request).toMatchObject({method:'POST',headers:{'Content-Type':'image/png'},body:file})
  expect(files).toMatchObject([{id:'server-media-id',storageUrl:'storage://media/development/editor/server-media-id.png'}])
  expect(boundary.from).not.toHaveBeenCalled()
  expect(result.current.state).toMatchObject({isUploading:false,progress:100,error:null})
 })
 it('uploads audio duration through the same API',async()=>{
  boundary.metadata.mockResolvedValue({duration:3.5});boundary.upload.mockResolvedValue({...await boundary.upload(),mime_type:'audio/mpeg',file_type:'audio',duration:'3.5'})
  boundary.upload.mockClear();const {result}=renderHook(()=>useMediaUpload())
  await act(async()=>{await result.current.uploadFiles([new File(['ID3'],'story.mp3',{type:'audio/mpeg'})])})
  expect(boundary.upload.mock.calls[0][0]).toContain('duration=3.5')
  expect(result.current.state.uploadedFiles[0]).toMatchObject({mediaType:'audio',duration:3.5})
 })
 it('surfaces backend failures without inserting browser-authored database records',async()=>{
  boundary.upload.mockRejectedValue(new Error('R2 unavailable'));const {result}=renderHook(()=>useMediaUpload())
  await act(async()=>{await expect(result.current.uploadFiles([new File(['test'],'garden.png',{type:'image/png'})])).rejects.toThrow('R2 unavailable')})
  expect(result.current.state).toMatchObject({isUploading:false,error:'R2 unavailable',uploadedFiles:[]})
  expect(boundary.from).not.toHaveBeenCalled()
 })
})
