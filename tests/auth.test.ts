import {afterEach,describe,expect,it} from 'vitest';
import {issueToken,verifyToken} from '../src/lib/auth';
const priorSecret=process.env.JWT_SECRET;
afterEach(()=>{if(priorSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=priorSecret});
describe('signed sessions',()=>{
  it('issues a verifiable token bound to the user id',async()=>{process.env.JWT_SECRET='test-secret-that-is-at-least-thirty-two-characters';const token=await issueToken({id:'abc-user-id',role:'member'});expect(await verifyToken(token)).toEqual({userId:'abc-user-id'})});
  it('rejects tampered and malformed tokens',async()=>{process.env.JWT_SECRET='test-secret-that-is-at-least-thirty-two-characters';const token=await issueToken({id:'abc-user-id',role:'admin'});expect(await verifyToken(`${token}tampered`)).toBeNull();expect(await verifyToken('not-a-jwt')).toBeNull()});
});
