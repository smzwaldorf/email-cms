import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
vi.mock('@/components/admin/AdminLayout',()=>({AdminLayout:({children}:{children:React.ReactNode})=><div>{children}</div>}))
vi.mock('@/components/admin/NewsletterForm',()=>({NewsletterForm:()=>null}))
vi.mock('@/services/adminService',()=>({AdminServiceError:class extends Error{},adminService:{fetchNewsletter:vi.fn().mockResolvedValue({id:'n',title:'Newsletter',status:'draft',weekNumber:'2025-W47',releaseDate:'2025-11-20'}),fetchArticlesByNewsletterId:vi.fn().mockResolvedValue([{id:'a',title:'Article',status:'published',newsletterTargetingMode:'targeted',newsletterTargetClassIds:['JIACHEN']}]),getAvailableArticlesByNewsletterId:vi.fn().mockResolvedValue([]),fetchClasses:vi.fn().mockResolvedValue([{id:'auth-class',name:'甲辰',legacyIds:['JIACHEN']}]),fetchFamilies:vi.fn().mockResolvedValue([]),getNewsletterPublishReadiness:vi.fn().mockResolvedValue({canPublish:false,issues:[]}),fetchNewsletterDeliveryBatches:vi.fn().mockResolvedValue([]),updateArticleTargetingInNewsletterById:vi.fn().mockResolvedValue(undefined)}}))
import {AdminArticleListPage} from '@/pages/AdminArticleListPage'
import {adminService} from '@/services/adminService'
describe('newsletter detail historical class targets',()=>{
 it('shows mapped class selected and saves its canonical ID',async()=>{
 render(<MemoryRouter initialEntries={['/newsletter/n']}><Routes><Route path='/newsletter/:id' element={<AdminArticleListPage/>}/></Routes></MemoryRouter>)
 expect(await screen.findByRole('checkbox',{name:'甲辰'})).toBeChecked()
 fireEvent.click(screen.getByRole('button',{name:'儲存班級設定'}))
 await waitFor(()=>expect(adminService.updateArticleTargetingInNewsletterById).toHaveBeenCalledWith('n','a','targeted',['auth-class']))
 })
})
