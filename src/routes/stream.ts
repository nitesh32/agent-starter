import type { FastifyInstance } from "fastify";
import { subscribe } from "../events.js";

export async function streamRoutes(app: FastifyInstance) {
  app.get("/api/stream", (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.write(": connected\n\n");
    const unsubscribe = subscribe((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
    const beat = setInterval(() => res.write(": ping\n\n"), 15_000);
    req.raw.on("close", () => {
      clearInterval(beat);
      unsubscribe();
    });
  });
}
