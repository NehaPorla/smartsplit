import {Pool} from 'pg';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
async function main(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');try{await pool.query("ALTER TABLE groups ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '◉' CHECK (length(icon) BETWEEN 1 AND 16)");console.log('Group icon column is ready.')}finally{await pool.end()}}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
