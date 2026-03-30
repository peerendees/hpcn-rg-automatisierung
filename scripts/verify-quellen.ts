/**
 * Liest die Beispiel-CSVs aus quellen/ und gibt parseCsv-Ergebnisse aus.
 * Aufruf: npx tsx scripts/verify-quellen.ts (im Projektroot)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../lib/csv-parser";

const root = process.cwd();
const files = [
  "quellen/DLN KW 2025-47.csv",
  "quellen/DLN KW 2025-48.csv",
];

for (const rel of files) {
  const p = join(root, rel);
  const content = readFileSync(p, "utf-8");
  const pos = parseCsv(content);
  console.log("\n===", rel, "===");
  console.log(JSON.stringify(pos, null, 2));
}
