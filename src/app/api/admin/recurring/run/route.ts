import {NextRequest} from 'next/server';import {db} from '@/lib/db';import {apiRoute,json,requireAdmin,requireUser} from '@/lib/api';
export const POST=apiRoute(async(req:NextRequest)=>{const user=await requireUser(req);requireAdmin(user);const r=await db.query('SELECT run_recurring_expenses() AS created_count');return json({createdCount:r.rows[0].created_count})});
