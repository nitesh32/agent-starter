import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPerson, queuePerson } from "../pipeline.js";
import { runRound } from "../dating.js";
import { seedFromCsv } from "../seed.js";
import * as repo from "../repo.js";
import path from "node:path";

const newPerson = z.object({ linkedin_url: z.string().min(3), instagram_url: z.string().min(1) });
const idParam = (v: unknown) => Number((v as { id: string }).id);

export async function apiRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.post("/api/people", async (req, reply) => {
    const body = newPerson.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "linkedin_url and instagram_url are required" });
    try {
      return { id: await createPerson(body.data.linkedin_url, body.data.instagram_url) };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.get("/api/people", () => repo.listPeople());

  app.get("/api/people/:id", async (req, reply) => (await repo.getPerson(idParam(req.params))) ?? reply.code(404).send({ error: "not found" }));

  app.get("/api/people/:id/ranking", (req) => repo.rankingOf(idParam(req.params)));

  app.post("/api/people/:id/retry", async (req) => {
    void queuePerson(idParam(req.params));
    return { ok: true };
  });

  app.post("/api/dates/run", async (req) => {
    const force = (req.query as { force?: string }).force === "1";
    return { scheduled: await runRound(force) };
  });

  app.get("/api/dates/:id", async (req, reply) => {
    const id = idParam(req.params);
    const date = await repo.getDate(id);
    return date ? { ...date, turns: await repo.turnsOf(id) } : reply.code(404).send({ error: "not found" });
  });

  app.post("/api/seed", async () => seedFromCsv(path.resolve("data/people.csv")));

  app.get("/photo/:id", async (req, reply) => {
    const photo = await repo.getPhoto(idParam(req.params));
    if (!photo) return reply.code(404).send();
    return reply.header("Cache-Control", "public, max-age=86400").type(photo.photo_type).send(photo.photo_blob);
  });
}
