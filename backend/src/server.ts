import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { Server } from "socket.io";
import { z } from "zod";
import { Arena } from "./arena";
import { ProblemRegistry } from "./problems/registry";
import { judge } from "./judge";
import {
  languages,
  type ClientEvents,
  type ServerEvents,
  type Reply,
} from "../../shared/types";
export function secretMatches(
  value: string | undefined,
  expected: string | undefined,
) {
  if (!value || !expected) return false;
  const a = Buffer.from(value),
    b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function createApplication(
  registry: ProblemRegistry,
  judgeFn = judge,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "128kb" }));
  const http = createServer(app);
  const io = new Server<ClientEvents, ServerEvents>(http, {
    maxHttpBufferSize: 128 * 1024,
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      try {
        cb(null, !origin || new URL(origin).host === req.headers.host);
      } catch {
        cb(null, false);
      }
    },
  });
  const emit = (target: string, event: string, data: unknown) => {
    (
      io.to(target) as unknown as {
        emit: (event: string, data: unknown) => void;
      }
    ).emit(event, data);
    if (event === "match:reset") io.in(target).socketsLeave(target);
  };
  const arena = new Arena(registry, judgeFn, emit, emit);
  const connectionRates = new Map<string, { count: number; start: number }>();
  io.use((socket, next) => {
    const ip = socket.handshake.address;
    const now = Date.now();
    let bucket = connectionRates.get(ip);
    if (!bucket || now - bucket.start > 60000) {
      bucket = { count: 0, start: now };
      connectionRates.set(ip, bucket);
    }
    next(
      ++bucket.count > 60
        ? new Error("Too many connections. Try again shortly.")
        : undefined,
    );
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      readyProblems: registry.eligible().length,
      clubFairMode: process.env.CLUB_FAIR_MODE !== "false",
    }),
  );
  app.get("/api/problems", (_req, res) =>
    res.json(
      registry
        .eligible()
        .map(({ id, title, difficulty }) => ({ id, title, difficulty })),
    ),
  );
  const attempts = new Map<string, { count: number; time: number }>();
  app.use("/api/organizer", (req, res, next) => {
    const ip = req.ip || "";
    const now = Date.now();
    let bucket = attempts.get(ip);
    if (!bucket || now - bucket.time > 60000) {
      bucket = { count: 0, time: now };
      attempts.set(ip, bucket);
    }
    if (++bucket.count > 30) {
      res.status(429).json({ error: "Try again in a minute." });
      return;
    }
    if (
      !secretMatches(req.headers.authorization, process.env.ORGANIZER_SECRET)
    ) {
      res.status(401).json({ error: "Organizer secret required." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/organizer", (_req, res) =>
    res.json({
      rooms: [...arena.rooms.values()].map((r) => arena.view(r)),
      recent: arena.recent,
      diagnostics: registry.diagnostics,
      unvalidated: [...registry.problems.values()]
        .filter((p) => !p.ready)
        .map((p) => p.id),
    }),
  );
  app.post("/api/organizer/reset", (req, res) => {
    try {
      const code = z
        .string()
        .regex(/^[A-F0-9]{6}$/)
        .parse(req.body.code);
      arena.forceReset(code);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  io.on("connection", (socket) => {
    let count = 0,
      last = Date.now();
    const guard = (ack: (r: Reply) => void, fn: () => Reply | void) => {
      try {
        if (Date.now() - last > 10000) {
          count = 0;
          last = Date.now();
        }
        if (++count > 40) throw Error("Too many requests. Wait a moment.");
        ack(fn() || {});
      } catch (e) {
        ack({ error: (e as Error).message });
      }
    };
    const name = z.string().trim().min(1).max(24);
    const acknowledge = (ack: unknown): ack is (r: Reply) => void =>
      typeof ack === "function";
    socket.on("room:create", (data, ack) => {
      if (!acknowledge(ack)) return;
      guard(ack, () => {
        const parsed = z.object({ name }).parse(data);
        const r = arena.create(parsed.name, socket.id);
        socket.join(r.room.code);
        return r;
      });
    });
    socket.on("room:join", (data, ack) => {
      if (!acknowledge(ack)) return;
      guard(ack, () => {
        const parsed = z
          .object({
            name,
            code: z
              .string()
              .trim()
              .regex(/^[a-fA-F0-9]{6}$/),
          })
          .parse(data);
        const r = arena.join(parsed.code, parsed.name, socket.id);
        socket.join(r.room.code);
        return r;
      });
    });
    socket.on("room:resume", (data, ack) => {
      if (!acknowledge(ack)) return;
      guard(ack, () => {
        const token = z
          .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
          .parse(data).token;
        const r = arena.resume(token, socket.id);
        socket.join(r.room.code);
        return r;
      });
    });
    socket.on("room:leave", (ack) => {
      if (!acknowledge(ack)) return;
      guard(ack, () => {
        const code = arena.find(socket.id).room.code;
        arena.leave(socket.id);
        socket.leave(code);
      });
    });
    socket.on("room:configure", (data, ack) => {
      if (!acknowledge(ack)) return;
      guard(ack, () => {
        arena.configure(
          socket.id,
          z
            .object({
              difficulty: z.enum(["very-easy", "easy"]).optional(),
              problemId: z.string().max(80).optional(),
              durationSeconds: z.number().int().min(30).max(900).optional(),
              language: z.enum(languages).optional(),
              clubFairMode: z.boolean().optional(),
            })
            .strict()
            .parse(data),
        );
      });
    });
    socket.on("match:start", (ack) => {
      if (acknowledge(ack)) guard(ack, () => arena.start(socket.id));
    });
    socket.on("match:reset", (data, ack) => {
      if (acknowledge(ack))
        guard(ack, () =>
          arena.reset(
            socket.id,
            z.object({ newPlayers: z.boolean().optional() }).parse(data)
              .newPlayers,
          ),
        );
    });
    socket.on("submission:create", (data, ack) => {
      if (!acknowledge(ack)) return;
      guard(ack, () => {
        const parsed = z
          .object({
            requestId: z.string().uuid(),
            source: z.string().min(1).max(65536),
            language: z.enum(languages),
            mode: z.enum(["run", "submit"]),
          })
          .strict()
          .parse(data);
        void arena
          .submit(socket.id, parsed)
          .catch((e) => ack({ error: (e as Error).message }));
        return {};
      });
    });
    socket.on("disconnect", () => arena.disconnect(socket.id));
  });
  const timer = setInterval(() => arena.tick(), 1000);
  timer.unref();
  http.on("close", () => clearInterval(timer));
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  return { app, http, io, arena };
}
if (path.basename(process.argv[1] || "") === "server.ts") {
  const registry = new ProblemRegistry(
    path.resolve(process.env.PROBLEMS_DIR || "problems"),
  );
  await registry.load();
  registry.diagnostics.forEach((d) => console.error(d));
  const { http } = await createApplication(registry);
  http.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log(
      `ADA Code Race on port ${process.env.PORT || 3000}; ${registry.eligible().length} validated problems. See README for judge setup.`,
    ),
  );
}
