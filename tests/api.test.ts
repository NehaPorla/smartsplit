import {describe,expect,it} from 'vitest';
import {ApiError,apiError,requireAdmin,requireGroupOwner,type SessionUser} from '../src/lib/api';

const member:SessionUser={id:'member-1',name:'Member',email:'member@example.test',role:'member'};
const admin:SessionUser={id:'admin-1',name:'Admin',email:'admin@example.test',role:'admin'};

describe('API authorization and JSON errors',()=>{
  it('rejects a member from admin-only operations',()=>{
    expect(()=>requireAdmin(member)).toThrowError(ApiError);
    try{requireAdmin(member)}catch(error){expect(error).toMatchObject({status:403,code:'FORBIDDEN'})}
  });

  it('allows admins and group owners while rejecting ordinary group members',()=>{
    expect(()=>requireAdmin(admin)).not.toThrow();
    expect(()=>requireGroupOwner(member,{member_role:'owner'})).not.toThrow();
    expect(()=>requireGroupOwner(admin,{member_role:'member'})).not.toThrow();
    expect(()=>requireGroupOwner(member,{member_role:'member'})).toThrowError(ApiError);
  });

  it('formats expected authorization errors as consistent JSON',async()=>{
    const response=apiError(new ApiError(403,'FORBIDDEN','Administrator role required'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({error:{code:'FORBIDDEN',message:'Administrator role required'}});
  });
});
