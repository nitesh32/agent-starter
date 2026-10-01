import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { createPerson } from "./pipeline.js";

export interface SeedRow { name?: string; linkedin_url: string; instagram_url: string }

export async function readSeedCsv(path: string): Promise<SeedRow[]> {
  const rows: SeedRow[] = parse(await readFile(path, "utf8"), { columns: true, skip_empty_lines: true, trim: true });
  return rows.filter((r) => r.linkedin_url && r.instagram_url);
}

/** Registers every row (invalid rows are reported, not fatal). Processing runs through the pipeline queue. */
export async function seedFromCsv(path: string) {
  const ids: number[] = [];
  const errors: string[] = [];
  for (const row of await readSeedCsv(path)) {
    try {
      ids.push(await createPerson(row.linkedin_url, row.instagram_url));
    } catch (e) {
      errors.push(`${row.linkedin_url}: ${(e as Error).message}`);
    }
  }
  return { ids, errors };
}
