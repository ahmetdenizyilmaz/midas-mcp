/** Print N chars of context around each occurrence of a needle in a file.
 *  Usage: npx tsx scripts/ctx.ts <file> <needle> [before] [after] [maxHits] */
import * as fs from "node:fs";

const [file, needle, before = "200", after = "400", maxHits = "5"] = process.argv.slice(2);
const src = fs.readFileSync(file, "utf8");
let idx = 0;
let hits = 0;
while ((idx = src.indexOf(needle, idx)) !== -1 && hits < Number(maxHits)) {
  console.log(`\n--- hit ${++hits} @ ${idx} ---`);
  console.log(src.slice(Math.max(0, idx - Number(before)), idx + Number(after)));
  idx += needle.length;
}
if (!hits) console.log("no hits");
