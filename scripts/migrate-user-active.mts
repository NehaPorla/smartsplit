import {db} from '@/lib/db';
async function main(){await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true');console.log('User active-state migration applied');await db.end()}
main().catch(async e=>{console.error(e);await db.end();process.exitCode=1});
