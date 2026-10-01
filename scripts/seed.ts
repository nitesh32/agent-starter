import "dotenv/config";
import path from "node:path";
import { migrate, pool, query } from "../src/db.js";
import { runRound } from "../src/dating.js";
import { queuePerson } from "../src/pipeline.js";
import { seedFromCsv } from "../src/seed.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const busy = async (sql: string) => Number((await query<{ n: string }>(sql))[0].n) > 0;

await migrate();
// Resume people a previous (stopped) run left mid-way. Nothing else is running, so this is safe.
const stuck = await query<{ id: number }>(`select id from people where status in ('queued','scraping','analyzing')`);
stuck.forEach((p) => void queuePerson(p.id));
if (stuck.length) console.log(`Resuming ${stuck.length} unfinished people from an earlier run`);
const { added, skipped, errors } = await seedFromCsv(path.resolve(process.argv[2] ?? "data/people.csv"));
console.log(`New: ${added.length}${added.length ? ` (${added.join(", ")})` : ""}`);
console.log(`Already on the site, skipped: ${skipped.length}${skipped.length ? ` (${skipped.join(", ")})` : ""}`);
if (errors.length) console.log(`Invalid rows: ${errors.length}\n  ${errors.join("\n  ")}`);

while (await busy(`select count(*) n from people where status in ('queued','scraping','analyzing')`)) await sleep(5000);

const scheduled = await runRound();
console.log(`Scheduled ${scheduled} dates`);
while (await busy(`select count(*) n from dates where status in ('queued','planning','dating','debrief')`)) await sleep(5000);

const people = await query(`select status, count(*)::int n from people group by status`);
const dates = await query(`select status, count(*)::int n, count(*) filter (where mutual)::int mutual from dates group by status`);
console.log("People:", people, "\nDates:", dates);
await pool.end();
