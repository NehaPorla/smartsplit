import {z} from 'zod';
import {ApiError} from './api';
import {calculateSplits,moneyToPaise,paiseToMoney,type SplitInput,type SplitType} from './expense';

export const splitItemSchema=z.object({userId:z.string().uuid(),amount:z.string().optional(),percentage:z.string().optional(),shares:z.number().int().positive().max(1_000_000_000).optional()}).strict();
export const expenseSchema=z.object({
  title:z.string().trim().min(1).max(200),amount:z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),paidBy:z.string().uuid().optional(),
  categoryId:z.number().int().min(1).max(32767).nullable().optional(),expenseDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  splitType:z.enum(['equal','exact','percentage','shares']),notes:z.string().max(5000).default(''),splits:z.array(splitItemSchema).min(1).max(500),embedding:z.array(z.number().finite()).length(384).optional(),
}).strict();
export type ExpenseInput=z.infer<typeof expenseSchema>;
export function makeSplitRows(type:SplitType,amount:string,items:SplitInput[]){
  const total=moneyToPaise(amount),rows=calculateSplits(total,type,items);
  return rows.map(row=>({user_id:row.userId,share_amount:paiseToMoney(row.paise)}));
}
export function splitItemsFor(type:SplitType,items:ExpenseInput['splits']){
  for(const item of items){
    if(type==='exact'&&item.amount===undefined)throw new ApiError(400,'INVALID_SPLIT','Exact splits need amount values');
    if(type==='percentage'&&item.percentage===undefined)throw new ApiError(400,'INVALID_SPLIT','Percentage splits need percentage values');
    if(type==='shares'&&item.shares===undefined)throw new ApiError(400,'INVALID_SPLIT','Share splits need positive integer weights');
  }
  return items as SplitInput[];
}
