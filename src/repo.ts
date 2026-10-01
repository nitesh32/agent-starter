// Read-side data access. Routes call these; views never touch the DB.
import { createHash } from "node:crypto";
import { query } from "./db.js";

const PUBLIC = `id, name, linkedin_url, instagram_url, ig_username, status, progress, error, tags, analysis, linkedin, instagram,
  (photo_type is not null) as has_photo, analysis->>'headline_tagline' as tagline`;

/** Slim card data for list pages (no full analysis JSON), plus each person's date results. */
export const listPeople = () =>
  query(`select p.id, p.name, p.status, p.error, (p.photo_type is not null) as has_photo, p.analysis->>'headline_tagline' as tagline,
      (select count(*)::int from dates d where d.status='done' and (d.a_id=p.id or d.b_id=p.id)) as dates_done,
      (select max(d.match_score) from dates d where d.status='done' and (d.a_id=p.id or d.b_id=p.id)) as best_score
     from people p order by p.id desc`);

/** The best pairs overall (a date belongs to two people, so list it once). */
export const topPairs = (limit = 5) =>
  query(
    `select d.id, d.match_score, d.mutual,
            a.id as a_id, a.name as a_name, (a.photo_type is not null) as a_has_photo,
            b.id as b_id, b.name as b_name, (b.photo_type is not null) as b_has_photo
       from dates d join people a on a.id=d.a_id join people b on b.id=d.b_id
      where d.status='done' order by d.match_score desc limit $1`,
    [limit],
  );

export const countReadyPeople = async () =>
  Number((await query<{ n: string }>(`select count(*) n from people where status='ready'`))[0].n);

export const listPeopleFull = () => query(`select ${PUBLIC} from people order by id desc`);

export const getPerson = async (id: number) => (await query(`select ${PUBLIC} from people where id=$1`, [id]))[0];

export interface Photo { data: Buffer; type: string; etag: string }
const photoCache = new Map<number, Photo>();

/** Photos are tiny (resized at ingest) and immutable per person, so keep them in memory. */
export async function getPhoto(id: number): Promise<Photo | undefined> {
  const hit = photoCache.get(id);
  if (hit) return hit;
  const row = (await query<{ photo_blob: Buffer; photo_type: string }>(`select photo_blob, photo_type from people where id=$1 and photo_blob is not null`, [id]))[0];
  if (!row) return undefined;
  const photo = { data: row.photo_blob, type: row.photo_type, etag: `"${createHash("md5").update(row.photo_blob).digest("hex")}"` };
  photoCache.set(id, photo);
  return photo;
}
export const dropCachedPhoto = (id: number) => photoCache.delete(id);

export const readyPeople = () =>
  query(`select id, name, tags, analysis, linkedin, instagram from people where status='ready' and analysis is not null order by id`);

const partnerJoin = `join people p on p.id = case when d.a_id=$1 then d.b_id else d.a_id end`;

export const datesOf = (personId: number) =>
  query(
    `select d.id, d.status, d.match_score, d.mutual, d.setting, p.id as partner_id, p.name as partner_name, (p.photo_type is not null) as partner_has_photo
       from dates d ${partnerJoin} where d.a_id=$1 or d.b_id=$1 order by d.match_score desc nulls last, d.id`,
    [personId],
  );

export const rankingOf = (personId: number, limit = 100) =>
  query(
    `select d.id as date_id, d.match_score, d.mutual, d.setting,
            p.id as partner_id, p.name as partner_name, (p.photo_type is not null) as partner_has_photo,
            p.analysis->>'headline_tagline' as partner_tagline,
            case when d.a_id=$1 then d.verdict_a else d.verdict_b end as my_verdict
       from dates d ${partnerJoin} where (d.a_id=$1 or d.b_id=$1) and d.status='done'
      order by d.match_score desc limit $2`,
    [personId, limit],
  );

export const getDate = async (id: number) => (await query(`select * from dates where id=$1`, [id]))[0];

export const turnsOf = (dateId: number) => query(`select idx, speaker_id, text from date_turns where date_id=$1 order by idx`, [dateId]);

export const liveDates = () =>
  query(`select id, a_id, b_id, status, setting from dates where status in ('planning','dating','debrief') order by id`);

export const peopleByIds = async (ids: number[]) =>
  new Map((await query(`select id, name, (photo_type is not null) as has_photo from people where id = any($1)`, [ids])).map((p: any) => [p.id, p]));
