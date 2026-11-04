import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Pool} from 'pg';

const pool=new Pool({connectionString:process.env.DATABASE_URL});
const files=['schema.sql','functions.sql','triggers.sql','views.sql','indexes.sql',...(process.env.ENABLE_VECTOR==='true'?['vector.sql']:[])];

async function main(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required (load .env.local before running db:init)');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    // This project explicitly uses a destructive, repeatable reset of the target database's public schema.
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    for(const file of files){
      const sql=await readFile(path.join(process.cwd(),'db',file),'utf8');
      await client.query(sql);
      console.log(`Applied db/${file}`);
    }
    await client.query('COMMIT');
    console.log('Database initialized. All previous objects in public were dropped and recreated.');
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
    await pool.end();
  }
}

main().catch(error=>{console.error('Database initialization failed:',error instanceof Error?error.message:error);process.exitCode=1});
