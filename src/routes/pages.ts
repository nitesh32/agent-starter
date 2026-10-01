import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import * as repo from "../repo.js";
import { aboutPage, datePage, homePage, livePage, personPage, rankingsPage } from "../views/pages.js";

const html = (reply: { type: (t: string) => any }, body: string) => reply.type("text/html; charset=utf-8").send(body);
const idParam = (v: unknown) => Number((v as { id: string }).id);

export async function pageRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => html(reply, homePage(await repo.listPeople())));

  app.get("/person/:id", async (req, reply) => {
    const id = idParam(req.params);
    const person = await repo.getPerson(id);
    if (!person) return reply.code(404).type("text/html").send("<h1>Not found</h1>");
    const [dates, ranking] = await Promise.all([repo.datesOf(id), repo.rankingOf(id)]);
    return html(reply, personPage(person, dates, ranking));
  });

  app.get("/date/:id", async (req, reply) => {
    const id = idParam(req.params);
    const date = await repo.getDate(id);
    if (!date) return reply.code(404).type("text/html").send("<h1>Not found</h1>");
    const [people, turns] = await Promise.all([repo.peopleByIds([date.a_id, date.b_id]), repo.turnsOf(id)]);
    return html(reply, datePage(date, people.get(date.a_id)!, people.get(date.b_id)!, turns));
  });

  app.get("/live", async (_req, reply) => {
    const dates = await repo.liveDates();
    const people = await repo.peopleByIds([...new Set(dates.flatMap((d: any) => [d.a_id, d.b_id]))]);
    const enriched = await Promise.all(
      dates.map(async (d: any) => ({ ...d, a: people.get(d.a_id), b: people.get(d.b_id), turns: await repo.turnsOf(d.id) })),
    );
    const directory = Object.fromEntries([...people.values()].map((p: any) => [p.id, { name: p.name, photo: p.has_photo }]));
    return html(reply, livePage(enriched, directory));
  });

  app.get("/rankings", async (_req, reply) => {
    const people = await repo.listPeople();
    const rows = await Promise.all(people.map(async (person: any) => ({ person, top: await repo.rankingOf(person.id, 3) })));
    return html(reply, rankingsPage(rows));
  });

  app.get("/about", async (_req, reply) => html(reply, aboutPage(config.models)));
}
