import {describe,it,expect} from 'vitest'
import {isAllowedRpc} from '../../../src/services/rpcPolicy'
describe('retired identity operations',()=>{
 it.each(['createFamily','updateFamily','deleteClass','addParentToFamily','removeStudentFromClass','fetchUsers','fetchStudents','fetchTeacherAssignedClasses'])('rejects %s',method=>expect(isAllowedRpc('admin',method)).toBe(false))
 it.each(['fetchNewsletters','updateArticle','fetchClasses','fetchFamilies'])('retains CMS actions and Auth catalogue reads %s',method=>expect(isAllowedRpc('admin',method)).toBe(true))
})
