import {NextRequest} from 'next/server';import {db} from '@/lib/db';import {apiRoute,json,requireUser} from '@/lib/api';
export const GET=apiRoute(async(req:NextRequest)=>{await requireUser(req);const r=await db.query('SELECT id,name FROM categories ORDER BY name');return json({categories:r.rows})});
