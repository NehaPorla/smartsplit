import {ApiError} from './api';

export type SplitType='equal'|'exact'|'percentage'|'shares';
export type SplitInput={userId:string;amount?:string;percentage?:string;shares?:number};
export type CalculatedSplit={userId:string;paise:bigint};

export function moneyToPaise(value:string,allowZero=false):bigint{
  const match=/^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value);
  if(!match)throw new ApiError(400,'INVALID_AMOUNT','Amount must be a positive decimal with at most two fractional digits');
  const paise=BigInt(match[1])*100n+BigInt((match[2]??'').padEnd(2,'0')||'0');
  if((allowZero?paise<0n:paise<=0n)||paise>999999999999n)throw new ApiError(400,'INVALID_AMOUNT','Amount must fit NUMERIC(12,2) and be greater than zero');
  return paise;
}
export function paiseToMoney(paise:bigint){return `${paise/100n}.${String(paise%100n).padStart(2,'0')}`}
function percentageToBasisPoints(value:string){const m=/^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value);if(!m)throw new ApiError(400,'INVALID_SPLIT','Percentages may have at most two decimal places');return Number(m[1])*100+Number((m[2]??'').padEnd(2,'0')||'0')}

export function calculateSplits(total:bigint,type:SplitType,items:SplitInput[]):CalculatedSplit[]{
  if(!items.length)throw new ApiError(400,'INVALID_SPLIT','At least one split participant is required');
  if(new Set(items.map(i=>i.userId)).size!==items.length)throw new ApiError(400,'INVALID_SPLIT','A participant may appear only once');
  if(type==='equal'){
    const base=total/BigInt(items.length),remainder=Number(total%BigInt(items.length));
    return items.map((item,index)=>({userId:item.userId,paise:base+(index<remainder?1n:0n)}));
  }
  if(type==='exact'){
    const rows=items.map(item=>{if(item.amount===undefined)throw new ApiError(400,'INVALID_SPLIT','Each exact split needs an amount');return{userId:item.userId,paise:moneyToPaise(item.amount,true)}});
    if(rows.reduce((sum,row)=>sum+row.paise,0n)!==total)throw new ApiError(400,'INVALID_SPLIT','Exact split amounts must add up to the expense total');
    return rows;
  }
  const weights=items.map(item=>type==='percentage'
    ? (item.percentage===undefined?0:percentageToBasisPoints(item.percentage))
    : (Number.isInteger(item.shares)&&Number(item.shares)>0?Number(item.shares):0));
  const denominator=type==='percentage'?10000:weights.reduce((a,b)=>a+b,0);
  if(weights.some(w=>type==='percentage'?w<0:w<=0)||denominator<=0||(type==='percentage'&&denominator!==weights.reduce((a,b)=>a+b,0)))throw new ApiError(400,'INVALID_SPLIT',type==='percentage'?'Percentages must total exactly 100.00%':'Share weights must be positive integers');
  const den=BigInt(denominator);let remainder=total;
  const rows=items.map((item,index)=>{const paise=total*BigInt(weights[index])/den;remainder-=paise;return{userId:item.userId,paise}});
  for(let i=0;remainder>0n;i=(i+1)%rows.length){rows[i].paise+=1n;remainder-=1n;}
  return rows;
}
