import {NextRequest} from 'next/server';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {db} from '@/lib/db';
import {issueToken,setSessionCookie} from '@/lib/auth';
import {apiRoute,json,readJson} from '@/lib/api';

const input=z.object({name:z.string().trim().min(2).max(100),email:z.string().email().max(254),password:z.string().min(10).max(128)}).strict();
export const POST=apiRoute(async(request:NextRequest)=>{
  const body=await readJson(request,input),hash=await bcrypt.hash(body.password,12);
  const result=await db.query('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,created_at',[body.name,body.email.toLowerCase(),hash,'member']);
  const user=result.rows[0],response=json({user},201);
  return setSessionCookie(response,await issueToken(user));
});
