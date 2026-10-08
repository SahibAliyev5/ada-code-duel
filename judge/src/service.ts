import "dotenv/config";
import express from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { languages } from "../../shared/types";
import { evaluate } from "./docker";
const secret = process.env.JUDGE_SECRET;
if (!secret || secret.length < 24)
  throw Error("Configure a JUDGE_SECRET of at least 24 characters.");
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
let active = 0;
const schema = z
  .object({
    source: z.string().min(1).max(65536),
    language: z.enum(languages),
    mode: z.enum(["run", "submit"]),
    timeLimitMs: z.number().int().min(100).max(5000),
    memoryLimitMb: z.number().int().min(64).max(512),
    tests: z
      .array(
        z.object({
          name: z.string().max(80),
          input: z.string().max(65536),
          output: z.string().max(65536),
        }),
      )
      .min(1)
      .max(50),
  })
  .strict();
app.post("/evaluate", async (req, res) => {
  const incoming = Buffer.from(req.headers.authorization || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    incoming.length !== expected.length ||
    !timingSafeEqual(incoming, expected)
  ) {
    res.sendStatus(401);
    return;
  }
  if (active >= 4) {
    res.status(503).json({ error: "Judge capacity reached. Retry shortly." });
    return;
  }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid judge job" });
    return;
  }
  active++;
  try {
    res.json(await evaluate(parsed.data));
  } finally {
    active--;
  }
});
// Runs on the Docker host; never mounts the Docker socket into application containers.
app.listen(4001, process.env.JUDGE_BIND || "127.0.0.1", () =>
  console.log("Local Docker judge listening on port 4001"),
);
