/** Summarize captured GraphQL traffic: operation names, variables, and auth header style. */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const lines = fs
  .readFileSync(path.join(ROOT, "discovery", "network.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Record<string, any>);

const filter = process.argv[2];
const showQuery = process.argv.includes("--query");
const seen = new Map<string, any>();

for (const e of lines) {
  if (!String(e.url).includes("router-graphql") || !e.postData) continue;
  let op: any;
  try {
    op = JSON.parse(e.postData);
  } catch {
    continue;
  }
  const ops = Array.isArray(op) ? op : [op];
  for (const o of ops) {
    const name = o.operationName ?? "(anon)";
    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue;
    if (!seen.has(name)) seen.set(name, { o, e });
  }
}

console.log("=== auth header sample ===");
const withAuth = lines.find((e) => e.reqHeaders?.authorization);
console.log(withAuth ? JSON.stringify(withAuth.reqHeaders, null, 2) : "none captured");

console.log(`\n=== ${seen.size} distinct operations ===`);
for (const [name, { o }] of seen) {
  console.log(`\n--- ${name} ---`);
  console.log("variables:", JSON.stringify(o.variables));
  if (showQuery) console.log("query:", o.query);
}
