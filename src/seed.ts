import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { addPerson } from "./pipeline.js";

export interface SeedRow { name?: string; linkedin_url: string; instagram_url: string }

export async function readSeedCsv(path: string): Promise<SeedRow[]> {
  const rows: SeedRow[] = parse(await readFile(path, "utf8"), { columns: true, skip_empty_lines: true, trim: true });
  return rows.filter((r) => r.linkedin_url && r.instagram_url);
}

/** Registers every row. Profiles already on the site (same LinkedIn or Instagram) are skipped, not reprocessed. */
export async function seedFromCsv(path: string) {
  const added: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  for (const row of await readSeedCsv(path)) {
    const label = row.name || row.linkedin_url;
    try {
      const r = await addPerson(row.linkedin_url, row.instagram_url);
      (r.existing ? skipped : added).push(label);
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`);
    }
  }
  return { added, skipped, errors };
}
