import pLimit from "p-limit";
import { config } from "./config.js";
import { query } from "./db.js";
import { publish } from "./events.js";
import { analyze } from "./analyze.js";
import { dropCachedPhoto } from "./repo.js";
import { fetchPhoto, optimizePhoto, normalizeIgUsername, normalizeLinkedInUrl, scrapePerson, type Progress } from "./scrape.js";
import { runDatesFor } from "./dating.js";

const personQueue = pLimit(config.concurrency);

async function setStatus(id: number, status: string, error: string | null = null, progress?: Progress) {
  const rows = await query(
    `update people set status=$2, error=$3, progress=coalesce($4::jsonb, progress) where id=$1 returning name`,
    [id, status, error, progress ? JSON.stringify(progress) : null],
  );
  publish({ type: "person", id, status, progress, name: rows[0]?.name });
}

export async function createPerson(linkedinInput: string, instagramInput: string): Promise<number> {
  const linkedin = normalizeLinkedInUrl(linkedinInput);
  const username = normalizeIgUsername(instagramInput);
  const existing = await query(`select id, status from people where linkedin_url=$1`, [linkedin]);
  if (existing[0] && existing[0].status !== "failed") return existing[0].id;
  if (existing[0]) {
    await query(`update people set instagram_url=$2, ig_username=$3, status='queued', error=null where id=$1`, [existing[0].id, `https://www.instagram.com/${username}/`, username]);
    queuePerson(existing[0].id);
    return existing[0].id;
  }
  const rows = await query(
    `insert into people (name, linkedin_url, instagram_url, ig_username) values ($1,$2,$3,$4) returning id`,
    [`@${username}`, linkedin, `https://www.instagram.com/${username}/`, username],
  );
  publish({ type: "person", id: rows[0].id, status: "queued", name: `@${username}` });
  queuePerson(rows[0].id);
  return rows[0].id;
}

/** Replace a person's links (e.g. after a typo) and run the pipeline again. */
export async function updateLinks(id: number, linkedinInput: string, instagramInput: string): Promise<void> {
  const linkedin = normalizeLinkedInUrl(linkedinInput);
  const username = normalizeIgUsername(instagramInput);
  const clash = await query(`select id, name from people where linkedin_url=$1 and id<>$2`, [linkedin, id]);
  if (clash[0]) throw new Error(`That LinkedIn profile is already on AgentDate (${clash[0].name}).`);
  const rows = await query(
    `update people set linkedin_url=$2, instagram_url=$3, ig_username=$4, name=$5, status='queued', error=null, progress='{}'::jsonb where id=$1 returning id`,
    [id, linkedin, `https://www.instagram.com/${username}/`, username, `@${username}`],
  );
  if (!rows[0]) throw new Error("Person not found.");
  publish({ type: "person", id, status: "queued", name: `@${username}` });
  void queuePerson(id);
}

/** Scrape → analyze → date existing ready people. Never throws. */
export function queuePerson(id: number): Promise<void> {
  return personQueue(() => processPerson(id));
}

export async function processPerson(id: number): Promise<void> {
  try {
    const [p] = await query(`select * from people where id=$1`, [id]);
    if (!p) return;

    await setStatus(id, "scraping", null, { linkedin: "running", instagram: "running" });
    const scraped = await scrapePerson(p.linkedin_url, p.ig_username, (progress) => {
      query(`update people set progress=$2::jsonb where id=$1`, [id, JSON.stringify(progress)]).catch(() => {});
      publish({ type: "person", id, status: "scraping", progress });
    });
    const li = scraped.linkedin.norm;
    const ig = scraped.instagram.norm;
    const photo = (await fetchPhoto(li.profilePic)) ?? (await fetchPhoto(ig.profilePic));
    await query(
      `update people set name=$2, photo_url=$3, photo_blob=$4, photo_type=$5,
         raw_linkedin=$6, raw_instagram=$7, linkedin=$8, instagram=$9 where id=$1`,
      [id, li.name || ig.fullName || `@${ig.username}`, li.profilePic || ig.profilePic, photo?.data ?? null, photo?.type ?? null,
       JSON.stringify(scraped.linkedin.raw), JSON.stringify(scraped.instagram.raw), JSON.stringify(li), JSON.stringify(ig)],
    );

    await setStatus(id, "analyzing");
    const analysis = await analyze(li, ig);
    await query(`update people set analysis=$2, tags=$3 where id=$1`, [id, JSON.stringify(analysis), analysis.tags]);
    await setStatus(id, "ready");
  } catch (e) {
    console.error(`[person ${id}] failed:`, e);
    await setStatus(id, "failed", (e as Error).message).catch(() => {});
    return;
  }
  runDatesFor(id).catch((e) => console.error(`[person ${id}] dating failed:`, e));
}

/** One-time cleanup: shrink photos stored before resizing existed. No-op once everything is small. */
export async function optimizeStoredPhotos() {
  const big = await query<{ id: number; photo_blob: Buffer }>(`select id, photo_blob from people where photo_blob is not null and (photo_type <> 'image/webp' or length(photo_blob) > 60000)`);
  for (const row of big) {
    try {
      const { data, type } = await optimizePhoto(row.photo_blob);
      await query(`update people set photo_blob=$2, photo_type=$3 where id=$1`, [row.id, data, type]);
      dropCachedPhoto(row.id);
    } catch (e) {
      console.warn(`[photo ${row.id}] could not optimize:`, (e as Error).message);
    }
  }
  if (big.length) console.log(`[photo] optimized ${big.length} stored photos`);
}
