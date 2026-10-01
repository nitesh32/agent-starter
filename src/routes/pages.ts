import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import * as repo from "../repo.js";
import { datingSummary } from "../dating.js";
import { notFoundPage } from "../views/ui.js";
import { aboutPage, datePage, homeFragments, homePage, livePage, personPage, rankingsPage } from "../views/pages.js";

const html = (reply: { type: (t: string) => any }, body: string) => reply.type("text/html; charset=utf-8").send(body);
const idParam = (v: unknown) => Number((v as { id: string }).id);

export async function pageRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    const [people, summary] = await Promise.all([repo.listPeople(), datingSummary()]);
    return html(reply, homePage(people, summary));
  });

  app.get("/fragments/home", async () => {
    const [people, summary] = await Promise.all([repo.listPeople(), datingSummary()]);
    return homeFragments(people, summary);
  });

  app.get("/person/:id", async (req, reply) => {
    const id = idParam(req.params);
    const [person, dates, ranking, readyCount] = await Promise.all([repo.getPerson(id), repo.datesOf(id), repo.rankingOf(id), repo.countReadyPeople()]);
    if (!person) return reply.code(404).type("text/html").send(notFoundPage("person"));
    return html(reply, personPage(person, dates, ranking, readyCount - 1));
  });

  app.get("/date/:id", async (req, reply) => {
    const id = idParam(req.params);
    const date = await repo.getDate(id);
    if (!date) return reply.code(404).type("text/html").send(notFoundPage("date"));
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
    const people = (await repo.listPeople()).filter((p: any) => p.status === "ready");
    const [pairs, ...tops] = await Promise.all([repo.topPairs(5), ...people.map((p: any) => repo.rankingOf(p.id, 3))]);
    return html(reply, rankingsPage(pairs, people.map((person: any, i: number) => ({ person, top: tops[i] }))));
  });

  app.get("/about", async (_req, reply) => html(reply, aboutPage(config.models)));
}
