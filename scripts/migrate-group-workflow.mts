import {Pool} from 'pg';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
async function main(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');try{await pool.query("ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_token_hash text UNIQUE");await pool.query(`CREATE OR REPLACE FUNCTION prevent_member_leave_with_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.group_id,NEW.user_id) IS DISTINCT FROM (OLD.group_id,OLD.user_id) THEN
      RAISE EXCEPTION 'Membership identity is immutable; leave and rejoin using application rules';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM groups WHERE id=OLD.group_id) THEN RETURN OLD; END IF;
  IF EXISTS(SELECT 1 FROM get_group_balances(OLD.group_id) b WHERE b.user_id=OLD.user_id AND b.balance<>0) THEN
    RAISE EXCEPTION 'Cannot remove member % while their group balance is unsettled',OLD.user_id;
  END IF;
  RETURN OLD;
END $$`);console.log('Group invite and membership rules are ready.')}finally{await pool.end()}}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1});
