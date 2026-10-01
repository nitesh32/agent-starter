import "dotenv/config";
import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  keepAlive: true,
  // A new SSL connection to Neon costs ~800ms; keep idle ones around instead of the 10s default.
  idleTimeoutMillis: 10 * 60_000,
});
// An idle connection dropped by the server must not crash the process.
pool.on("error", (err) => console.warn("[db] idle client error:", err.message));

/** Keeps a few connections open (and Neon's compute awake) so page loads never pay the connect cost. */
export function startDbKeepAlive(connections = 3, everyMs = 30_000) {
  const ping = () => Promise.all(Array.from({ length: connections }, () => pool.query("select 1"))).catch(() => {});
  void ping();
  setInterval(ping, everyMs).unref();
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function migrate() {
  await pool.query(`
    create table if not exists people (
      id serial primary key,
      name text,
      linkedin_url text,
      instagram_url text,
      ig_username text,
      photo_url text,
      photo_blob bytea,
      photo_type text,
      raw_linkedin jsonb,
      raw_instagram jsonb,
      linkedin jsonb,
      instagram jsonb,
      analysis jsonb,
      tags text[] default '{}',
      status text not null default 'queued',
      progress jsonb default '{}',
      error text,
      created_at timestamptz default now()
    );
    create table if not exists dates (
      id serial primary key,
      a_id int not null references people(id) on delete cascade,
      b_id int not null references people(id) on delete cascade,
      pre_score real,
      setting jsonb,
      intent_a jsonb,
      intent_b jsonb,
      status text not null default 'queued',
      error text,
      verdict_a jsonb,
      verdict_b jsonb,
      match_score real,
      mutual boolean default false,
      created_at timestamptz default now(),
      unique (a_id, b_id)
    );
    create table if not exists date_turns (
      id serial primary key,
      date_id int not null references dates(id) on delete cascade,
      idx int not null,
      speaker_id int not null,
      text text not null,
      created_at timestamptz default now()
    );
    create index if not exists date_turns_date_idx on date_turns(date_id, idx);
  `);
}
