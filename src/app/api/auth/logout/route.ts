import {NextRequest} from 'next/server';
import {apiRoute,json} from '@/lib/api';
import {clearSessionCookie} from '@/lib/auth';
export const POST=apiRoute(async(_request:NextRequest)=>clearSessionCookie(json({loggedOut:true})));
