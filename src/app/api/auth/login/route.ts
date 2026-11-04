import {NextRequest} from 'next/server';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {db} from '@/lib/db';
import {issueToken,setSessionCookie} from '@/lib/auth';
import {ApiError,apiRoute,json,readJson} from '@/lib/api';

const input=z.object({email:z.string().email().max(254),password:z.string().min(1).max(128)}).strict();
export const POST=apiRoute(async(request:NextRequest)=>{
  const body=await readJson(request,input);
  const result=await db.query('SELECT id,name,email,role,password_hash,is_active FROM users WHERE email=$1',[body.email.toLowerCase()]);
  const user=result.rows[0];
  if(!user||!user.is_active||!(await bcrypt.compare(body.password,user.password_hash)))throw new ApiError(401,'INVALID_CREDENTIALS','Email or password is incorrect');
  const response=json({user:{id:user.id,name:user.name,email:user.email,role:user.role}});
  return setSessionCookie(response,await issueToken(user));
});

