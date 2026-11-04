import {NextRequest} from 'next/server';
import {apiRoute,json,requireAdmin,requireUser} from '@/lib/api';
import {neo4jHealth} from '@/lib/sync';
export const GET=apiRoute(async(req:NextRequest)=>{const user=await requireUser(req);requireAdmin(user);return json({neo4j:await neo4jHealth()})});
