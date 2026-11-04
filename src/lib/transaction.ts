import {db} from './db';
import type {PoolClient} from 'pg';
export async function transaction<T>(work:(client:PoolClient)=>Promise<T>,actorId?:string):Promise<T>{
  const client=await db.connect();
  try{await client.query('BEGIN');if(actorId)await client.query("SELECT set_config('app.user_id',$1,true)",[actorId]);const value=await work(client);await client.query('COMMIT');return value}
  catch(error){try{await client.query('ROLLBACK')}catch{}throw error}
  finally{client.release()}
}
