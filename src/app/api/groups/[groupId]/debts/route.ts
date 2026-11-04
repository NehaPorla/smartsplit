import {NextRequest} from 'next/server';
import {apiRoute,json,requireGroupMember,requireUser,uuidParam} from '@/lib/api';
import {groupDebtPlan} from '@/lib/sync';
import {GET as getBalances} from '../balances/route';
type Context={params:{groupId:string}};
export const GET=getBalances;
export const POST=apiRoute(async(req:NextRequest,ctx)=>{
 const user=await requireUser(req),groupId=uuidParam((ctx as Context|undefined)?.params.groupId,'groupId');
 await requireGroupMember(user.id,groupId);
 const plan=await groupDebtPlan(groupId);
 return json({available:plan.available,source:plan.source,debts:plan.debts});
});
