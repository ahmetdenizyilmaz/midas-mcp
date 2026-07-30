/**
 * Long-running headed browser for discovery/development.
 * Exposes CDP on port 9222 so other scripts can attach via connectOverCDP.
 * Logs all XHR/fetch responses to discovery/network.jsonl (JSON bodies inlined when small).
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SESSION_DIR = path.join(ROOT, ".midas-session");
const DISCOVERY_DIR = path.join(ROOT, "discovery");
fs.mkdirSync(DISCOVERY_DIR, { recursive: true });
const logStream = fs.createWriteStream(path.join(DISCOVERY_DIR, "network.jsonl"), { flags: "a" });

const context = await chromium.launchPersistentContext(SESSION_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  args: ["--remote-debugging-port=9222"],
});

context.on("response", async (response) => {
  const req = response.request();
  if (!["xhr", "fetch"].includes(req.resourceType())) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    method: req.method(),
    url: response.url(),
    status: response.status(),
    contentType: response.headers()["content-type"] ?? "",
    postData: req.postData()?.slice(0, 5000) ?? null,
  };
  if (response.url().includes("router-graphql")) {
    try {
      entry.reqHeaders = Object.fromEntries(
        Object.entries(await req.allHeaders()).map(([k, v]) => [k, v.slice(0, 80)])
      );
    } catch {
      /* headers unavailable */
    }
  }
  try {
    const ct = String(entry.contentType);
    if (ct.includes("json") || ct.includes("grpc")) {
      const body = await response.body();
      entry.bodyLength = body.length;
      if (body.length < 20000) {
        entry.body = ct.includes("json") ? body.toString("utf8") : body.toString("base64");
      }
    }
  } catch {
    // body unavailable (e.g. redirect) — keep the metadata entry
  }
  logStream.write(JSON.stringify(entry) + "\n");
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://atlas.getmidas.com/", { waitUntil: "domcontentloaded" });
console.log("Browser up. CDP on http://localhost:9222 — leave this process running.");

// keep alive until killed
await new Promise(() => {});
