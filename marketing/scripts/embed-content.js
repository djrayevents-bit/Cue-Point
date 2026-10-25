#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");
const json = readFileSync(join(root, "content.json"), "utf8");
writeFileSync(join(root, "content.embedded.js"), `window.CUEPOINT_CONTENT = ${json};\n`);
console.log("Wrote content.embedded.js");
