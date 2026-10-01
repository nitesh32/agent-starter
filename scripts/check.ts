import "dotenv/config";
import { chat } from "../src/llm.js";
import { runActor } from "../src/apify.js";
import { pool, query } from "../src/db.js";
import { bot } from "../src/telegram.js";

const username = process.argv[2];
const linkedinUrl = process.argv[3];

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const detail = await fn();
    console.log(`${name}: OK${typeof detail === "string" ? `\n${detail}` : ""}`);
  } catch (err) {
    console.log(`${name}: FAIL - ${err instanceof Error ? err.message : err}`);
  }
}

await step("LLM", () => chat([{ role: "user", content: "Say hi" }]));
await step("Apify", async () => {
  if (!username) throw new Error("usage: npm run check <ig_username> <linkedin_url>");
  const items = (await runActor("apify/instagram-profile-scraper", { usernames: [username] })) as any[];
  const p = items[0];
  if (!p?.username) throw new Error(`no profile returned (${items.length} items)`);
  return [
    `  items: ${items.length}`,
    `  username: ${p.username}`,
    `  full name: ${p.fullName}`,
    `  followers: ${p.followersCount}`,
    `  posts returned: ${p.latestPosts?.length ?? 0}`,
  ].join("\n");
});
const linkedinActor = process.env.APIFY_LINKEDIN_ACTOR;
if (!linkedinActor) {
  console.log("LinkedIn: SKIPPED - APIFY_LINKEDIN_ACTOR is not set");
} else {
  await step("LinkedIn", async () => {
    if (!linkedinUrl) throw new Error("usage: npm run check <ig_username> <linkedin_url>");
    const items = (await runActor(linkedinActor, { profileUrls: [linkedinUrl] })) as any[];
    if (items.length === 0) throw new Error("0 items returned");
    const p = items[0];
    const name = p.fullName ?? p.name ?? [p.firstName, p.lastName].filter(Boolean).join(" ");
    return [`  items: ${items.length}`, `  name: ${name}`, `  headline: ${p.headline}`].join("\n");
  });
}
await step("DB", () => query("select 1"));
await step("Telegram", () => bot.api.getMe());

await pool.end();
