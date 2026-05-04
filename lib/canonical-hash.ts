import { createHash } from "node:crypto";

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableSerialize(x)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`);
  return `{${pairs.join(",")}}`;
}

/** Kanonisierter SHA-256-Hash für Freigabe/Generate (keine Float-Freiheit durch Reihenfolge). */
export function sha256CanonicalJson(payload: unknown): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}
