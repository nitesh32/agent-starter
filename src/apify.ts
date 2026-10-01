import "dotenv/config";
import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runActor(actorId: string, input: object): Promise<unknown[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const run = await client.actor(actorId).call(input);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      return items;
    } catch (e) {
      // The plan allows only a few actor runs at once; wait for a slot instead of failing the person.
      if (!/concurrent Actor runs/i.test((e as Error).message) || attempt >= 8) throw e;
      await sleep(10_000 * attempt);
    }
  }
}
