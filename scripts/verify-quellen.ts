/**
 * Liest die Beispiel-CSV aus quellen/ und gibt parseCsv-Ergebnisse aus.
 * Aufruf: npm run verify-quellen (im Projektroot)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../lib/csv-parser";

const root = process.cwd();
const rel = "quellen/beispiel-hpcn.csv";
const p = join(root, rel);
const content = readFileSync(p, "utf-8");
const rows = parseCsv(content);
console.log("\n===", rel, "===");
console.log("Zeilen:", rows.length);
console.log(JSON.stringify(rows, null, 2));
