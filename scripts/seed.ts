import "dotenv/config";
import path from "node:path";
import { migrate, pool, query } from "../src/db.js";
import { runRound } from "../src/dating.js";
import { seedFromCsv } from "../src/seed.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const busy = async (sql: string) => Number((await query<{ n: string }>(sql))[0].n) > 0;

await migrate();
const { ids, errors } = await seedFromCsv(path.resolve(process.argv[2] ?? "data/people.csv"));
console.log(`Registered ${ids.length} people${errors.length ? `, ${errors.length} invalid rows:\n  ${errors.join("\n  ")}` : ""}`);

while (await busy(`select count(*) n from people where status in ('queued','scraping','analyzing')`)) await sleep(5000);

const scheduled = await runRound();
console.log(`Scheduled ${scheduled} dates`);
while (await busy(`select count(*) n from dates where status in ('queued','planning','dating','debrief')`)) await sleep(5000);

const people = await query(`select status, count(*)::int n from people group by status`);
const dates = await query(`select status, count(*)::int n, count(*) filter (where mutual)::int mutual from dates group by status`);
console.log("People:", people, "\nDates:", dates);
await pool.end();
