import "dotenv/config";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { migrate } from "./db.js";
import { queuePerson } from "./pipeline.js";
import { resumeInterrupted } from "./dating.js";
import { query } from "./db.js";
import { apiRoutes } from "./routes/api.js";
import { pageRoutes } from "./routes/pages.js";
import { streamRoutes } from "./routes/stream.js";

const app = Fastify({ logger: true });

app.setErrorHandler((err, _req, reply) => {
  app.log.error(err);
  reply.code(500).send({ error: (err as Error).message });
});

await app.register(fastifyStatic, { root: path.resolve("public"), maxAge: "10m" });
await app.register(apiRoutes);
await app.register(streamRoutes);
await app.register(pageRoutes);

await migrate();
await app.listen({ port: config.port, host: "0.0.0.0" });

// Resume work interrupted by a restart (Render free tier sleeps/restarts).
const pending = await query<{ id: number }>(`select id from people where status in ('queued','scraping','analyzing')`);
pending.forEach((p) => void queuePerson(p.id));
resumeInterrupted().catch((e) => app.log.error(e, "resume failed"));
