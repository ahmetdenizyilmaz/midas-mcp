/**
 * Reconstruct a full GraphQL document from the minified bundle's embedded graphql-tag AST.
 * Usage: npx tsx scripts/extract-document.ts <file.js> <OperationName>
 */
import * as fs from "node:fs";
import { print } from "graphql";

const src = fs.readFileSync(process.argv[2], "utf8");
const opName = process.argv[3];

const nameIdx = src.indexOf(`value:"${opName}"`);
if (nameIdx === -1) throw new Error(`operation ${opName} not found`);

// walk back to the enclosing {kind:"Document"
const docIdx = src.lastIndexOf('{kind:"Document"', nameIdx);
if (docIdx === -1) throw new Error("enclosing Document node not found");

// extract a brace-balanced object literal starting at docIdx
let depth = 0;
let end = -1;
for (let i = docIdx; i < src.length; i++) {
  const c = src[i];
  if (c === '"') {
    // skip string literal
    i++;
    while (i < src.length && !(src[i] === '"' && src[i - 1] !== "\\")) i++;
    continue;
  }
  if (c === "{") depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
if (end === -1) throw new Error("unbalanced object literal");

const literal = src.slice(docIdx, end);
// the literal is pure data (kind/value/name objects) produced by graphql-tag
const ast = new Function(`"use strict"; return (${literal});`)();

const doc = {
  ...ast,
  definitions: ast.definitions.filter(
    (d: any) => d.kind !== "OperationDefinition" || d.name?.value === opName
  ),
};

console.log(print(doc as any));
