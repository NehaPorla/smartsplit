import {SignJWT,jwtVerify} from 'jose';
import {NextResponse} from 'next/server';
const secret=()=>{const value=process.env.JWT_SECRET;if(!value||value.length<32)throw new Error('JWT_SECRET must contain at least 32 characters');return new TextEncoder().encode(value)};
export async function issueToken(user:{id:string;role:string}){return new SignJWT({role:user.role}).setProtectedHeader({alg:'HS256'}).setSubject(user.id).setIssuedAt().setExpirationTime('7d').sign(secret())}
export async function verifyToken(token:string){try{const {payload}=await jwtVerify(token,secret());if(typeof payload.sub!=='string')return null;return{userId:payload.sub}}catch{return null}}
export function setSessionCookie(response:NextResponse,token:string){response.cookies.set('smartsplit_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:604800});return response}
export function clearSessionCookie(response:NextResponse){response.cookies.set('smartsplit_session','',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});return response}
