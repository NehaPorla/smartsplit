import {NextRequest} from 'next/server';import {z} from 'zod';import {db} from '@/lib/db';import {apiRoute,json,readJson,requireGroupMember,requireUser,uuidParam,ApiError} from '@/lib/api';import {expenseSchema,makeSplitRows,splitItemsFor} from '@/lib/expense-api';import {transaction} from '@/lib/transaction';import {syncGroupGraph} from '@/lib/sync';import {expenseEmbedding,pgVector} from '@/lib/embedding';
type Context={params:{groupId:string}};
const filters=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25),categoryId:z.coerce.number().int().positive().optional(),paidBy:z.string().uuid().optional(),from:z.string().date().optional(),to:z.string().date().optional(),q:z.string().trim().max(200).optional(),sortBy:z.enum(['date','amount']).default('date'),sortOrder:z.enum(['asc','desc']).default('desc')});
export const GET=apiRoute(async(req:NextRequest,ctx)=>{
  const user=await requireUser(req),groupId=uuidParam((ctx as Context|undefined)?.params.groupId,'groupId');await requireGroupMember(user.id,groupId);
  const parsed=filters.safeParse(Object.fromEntries(req.nextUrl.searchParams));if(!parsed.success)throw parsed.error;const f=parsed.data;
  const values=[groupId,f.categoryId??null,f.paidBy??null,f.from??null,f.to??null,f.q||null,f.pageSize,(f.page-1)*f.pageSize,user.id];
  const orderColumn=f.sortBy==='amount'?'e.amount':'e.expense_date',orderDirection=f.sortOrder==='asc'?'ASC':'DESC';
  const where=`e.group_id=$1 AND NOT e.is_deleted AND ($2::smallint IS NULL OR e.category_id=$2) AND ($3::uuid IS NULL OR e.paid_by=$3) AND ($4::date IS NULL OR e.expense_date >= $4) AND ($5::date IS NULL OR e.expense_date <= $5) AND ($6::text IS NULL OR e.search_doc @@ websearch_to_tsquery('english',$6))`;
  const [rows,count]=await Promise.all([db.query(`SELECT e.id,e.group_id,e.paid_by,u.name AS payer_name,e.title,e.amount,e.category_id,c.name AS category_name,e.expense_date,e.split_type,e.notes,count(s.user_id)::int AS split_count,coalesce(sum(s.share_amount),0)::numeric(12,2) AS split_total,coalesce(sum(s.share_amount) FILTER(WHERE s.user_id=$9),0)::numeric(12,2) AS your_share,CASE WHEN $6::text IS NULL THEN 0 ELSE ts_rank(e.search_doc,websearch_to_tsquery('english',$6)) END AS relevance FROM expenses e JOIN users u ON u.id=e.paid_by LEFT JOIN categories c ON c.id=e.category_id LEFT JOIN expense_splits s ON s.expense_id=e.id WHERE ${where} GROUP BY e.id,u.name,c.name ORDER BY ${orderColumn} ${orderDirection},e.created_at DESC LIMIT $7 OFFSET $8`,values),db.query(`SELECT count(*)::int AS total FROM expenses e WHERE ${where}`,values.slice(0,6))]);
  return json({expenses:rows.rows,pagination:{page:f.page,pageSize:f.pageSize,total:count.rows[0].total},search:f.q??null});
});
export const POST=apiRoute(async(req:NextRequest,ctx)=>{
  const user=await requireUser(req),groupId=uuidParam((ctx as Context|undefined)?.params.groupId,'groupId');await requireGroupMember(user.id,groupId);const body=await readJson(req,expenseSchema),payer=body.paidBy??user.id;
  const splits=makeSplitRows(body.splitType,body.amount,splitItemsFor(body.splitType,body.splits));
  const id=await transaction(async client=>{
    const result=await client.query(`SELECT add_expense_with_splits($1,$2,$3,$4,$5,$6,$7::jsonb) AS id`,[groupId,payer,body.title,body.amount,body.categoryId??null,body.splitType,JSON.stringify(splits)]);
    await client.query('UPDATE expenses SET expense_date=coalesce($2::date,expense_date),notes=$3 WHERE id=$1',[result.rows[0].id,body.expenseDate??null,body.notes]);
    if(process.env.ENABLE_VECTOR==='true'&&body.embedding){const vector=`[${body.embedding.join(',')}]`;await client.query('INSERT INTO expense_vectors(expense_id,embedding,model) VALUES($1,$2::vector,$3)',[result.rows[0].id,vector,'client-supplied-384d']);}
    return String(result.rows[0].id);
  },user.id);
  const graph=await syncGroupGraph(groupId);return json({expenseId:id,neo4jAvailable:graph.available,notice:graph.available?undefined:'Neo4j unavailable; debt graph will use the TypeScript fallback'},201);
});


