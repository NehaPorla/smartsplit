import {Pool} from 'pg';
const globalForPg=globalThis as unknown as {pg?:Pool};
export const db=globalForPg.pg??new Pool({connectionString:process.env.DATABASE_URL});
if(process.env.NODE_ENV!=='production')globalForPg.pg=db;
