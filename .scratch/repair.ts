import "dotenv/config";
import { readyPeople } from "../src/repo.js";
import { preScore, runPairs, type Person } from "../src/dating.js";
import { query, pool } from "../src/db.js";

const badSql = `select d.id, d.a_id, d.b_id from dates d left join date_turns t on t.date_id=d.id
  where d.status='done' group by d.id having count(t.*) <> 8 order by d.id`;
const bad = await query<{ id: number; a_id: number; b_id: number }>(badSql);
const people = new Map(((await readyPeople()) as unknown as Person[]).map((p) => [p.id, p]));
const pairs = bad.flatMap((d) => (people.has(d.a_id) && people.has(d.b_id) ? [{ a: people.get(d.a_id)!, b: people.get(d.b_id)!, pre: preScore(people.get(d.a_id)!, people.get(d.b_id)!) }] : []));
console.log(`Regenerating ${pairs.length} dates with a wrong number of turns`);
await runPairs(pairs, true);
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const [{ n }] = await query<{ n: string }>(`select count(*) n from dates where status in ('queued','planning','dating','debrief')`);
  if (Number(n) === 0) break;
}
const still = await query(badSql);
const [{ n: failed }] = await query<{ n: string }>(`select count(*) n from dates where status='failed'`);
console.log(`REPAIR DONE. Still wrong turn count: ${still.length}. Failed dates: ${failed}`);
await pool.end();
process.exit(0);
