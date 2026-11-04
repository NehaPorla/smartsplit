import {NextRequest,NextResponse} from 'next/server';
import {z,ZodError,ZodType} from 'zod';
import {db} from './db';
import {verifyToken} from './auth';

export type SessionUser={id:string;name:string;email:string;role:'admin'|'member'};
export class ApiError extends Error { constructor(public status:number,public code:string,message:string,public details?:unknown){super(message)} }
export type ApiHandler=(request:NextRequest,context?:{params:Record<string,string>})=>Promise<NextResponse>;
export function apiRoute(handler:ApiHandler){return async(request:NextRequest,context?:{params:Record<string,string>})=>{try{return await handler(request,context)}catch(error){if((error as {digest?:string})?.digest==='DYNAMIC_SERVER_USAGE')throw error;return apiError(error)}}}
export function json(data:unknown,status=200){return NextResponse.json({data}, {status})}
export function apiError(error:unknown){
  if(error instanceof ApiError)return NextResponse.json({error:{code:error.code,message:error.message,...(error.details?{details:error.details}:{})}},{status:error.status});
  if(error instanceof ZodError)return NextResponse.json({error:{code:'VALIDATION_ERROR',message:'Request validation failed',details:error.flatten()}},{status:400});
  const pg=error as {code?:string;message?:string};
  if(pg?.code==='23505')return NextResponse.json({error:{code:'CONFLICT',message:'A record with that unique value already exists'}},{status:409});
  if(pg?.code==='23503'||pg?.code==='23514'||pg?.code==='22P02'||pg?.code==='P0001')return NextResponse.json({error:{code:'DATA_INTEGRITY',message:pg.message??'The request violates a database constraint'}},{status:422});
  console.error('Unhandled API error:',error);
  return NextResponse.json({error:{code:'INTERNAL_ERROR',message:'An unexpected server error occurred'}},{status:500});
}
export async function readJson<T>(request:Request,schema:ZodType<T>):Promise<T>{let body:unknown;try{body=await request.json()}catch{throw new ApiError(400,'INVALID_JSON','Request body must be valid JSON')}return schema.parse(body)}
export async function requireUser(request:NextRequest):Promise<SessionUser>{
  const token=request.cookies.get('smartsplit_session')?.value;
  if(!token)throw new ApiError(401,'UNAUTHENTICATED','Please sign in');
  const claims=await verifyToken(token);if(!claims)throw new ApiError(401,'UNAUTHENTICATED','Session is invalid or expired');
  const result=await db.query('SELECT id,name,email,role,is_active FROM users WHERE id=$1',[claims.userId]);
  if(!result.rowCount||!result.rows[0].is_active)throw new ApiError(401,'UNAUTHENTICATED','Account no longer exists or is deactivated');
  return result.rows[0] as SessionUser;
}
export function requireAdmin(user:SessionUser){if(user.role!=='admin')throw new ApiError(403,'FORBIDDEN','Administrator role required')}
export async function requireGroupMember(userId:string,groupId:string){
  const result=await db.query(`SELECT g.id,g.name,gm.member_role FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=$1 AND gm.user_id=$2`,[groupId,userId]);
  if(!result.rowCount)throw new ApiError(404,'GROUP_NOT_FOUND','Group not found or you are not a member');
  return result.rows[0] as {id:string;name:string;member_role:'owner'|'member'};
}
export function requireGroupOwner(user:SessionUser,membership:{member_role:string}){if(user.role!=='admin'&&membership.member_role!=='owner')throw new ApiError(403,'FORBIDDEN','Group owner or administrator role required')}
export function uuidParam(value:string|undefined,label='id'){if(!value||!z.string().uuid().safeParse(value).success)throw new ApiError(400,'INVALID_ID',`${label} must be a UUID`);return value}

