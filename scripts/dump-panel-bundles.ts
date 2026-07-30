/** Open the order panel, then download every JS resource the page has loaded (incl. lazy chunks). */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "discovery", "js2");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP("http://localhost:9222");
const context = browser.contexts()[0];
const page = context.pages().at(-1)!;

const buy = page.getByRole("button", { name: /^Al$/ }).first();
await buy.waitFor({ state: "visible", timeout: 15000 });
await buy.click();
await page.waitForTimeout(5000);
console.log("order panel opened");

const urls = (await page.evaluate(
  `performance.getEntriesByType("resource").map(e => e.name).filter(n => n.includes(".js"))`
)) as string[];
console.log("js resources:", urls.length);

let n = 0;
for (const url of urls) {
  try {
    const res = await context.request.get(url);
    if (!res.ok()) continue;
    const name = url.split("/").pop()!.split("?")[0].replace(/[^\w.\-]/g, "_");
    fs.writeFileSync(path.join(OUT, name), await res.body());
    n++;
  } catch {
    /* chunk no longer served */
  }
}
console.log("saved", n, "files to discovery/js2");
await browser.close();
