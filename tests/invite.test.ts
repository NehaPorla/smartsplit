import {describe,expect,it} from 'vitest';
import {createInviteToken,hashInviteToken,isValidInviteToken} from '../src/lib/invites';

describe('group invite tokens',()=>{
  it('creates URL-safe random tokens suitable for invite URLs',()=>{
    const token=createInviteToken();
    expect(token).toHaveLength(43);
    expect(isValidInviteToken(token)).toBe(true);
    expect(createInviteToken()).not.toBe(token);
  });

  it('hashes tokens deterministically and rejects malformed values',()=>{
    const token=createInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toBe(token);
    expect(isValidInviteToken('not-an-invite-token')).toBe(false);
  });
});
