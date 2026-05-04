import { createHmac, timingSafeEqual } from "node:crypto";

export function getApprovalSecret(): string {
  const s = process.env.APPROVAL_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Serverkonfiguration: APPROVAL_SECRET fehlt (Umgebungsvariable setzen).",
    );
  }
  return "__dev_only_hpcn_rg_approval__";
}

export type ApprovalTokenPayload = {
  payloadHash: string;
  exp: number;
};

const PREFIX = "hpcn1";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/** Kurzlebiges MAC-Token (HS256-ähnlich, ohne extra Dependencies). */
export function signApprovalToken(
  payloadHash: string,
  secret: string,
  ttlSeconds: number,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = JSON.stringify({ payloadHash, exp } satisfies ApprovalTokenPayload);
  const bodyB64 = b64url(Buffer.from(body, "utf8"));
  const sig = createHmac("sha256", secret).update(bodyB64).digest();
  return `${PREFIX}.${bodyB64}.${b64url(sig)}`;
}

export function verifyApprovalToken(
  token: string,
  secret: string,
): ApprovalTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, bodyB64, sigB64] = parts;
  if (!bodyB64 || !sigB64) return null;
  let sig: Buffer;
  let bodyBuf: Buffer;
  try {
    sig = b64urlDecode(sigB64);
    bodyBuf = b64urlDecode(bodyB64);
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(bodyB64).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected))
    return null;
  try {
    const parsed = JSON.parse(bodyBuf.toString("utf8")) as ApprovalTokenPayload;
    if (
      typeof parsed.payloadHash !== "string" ||
      typeof parsed.exp !== "number"
    )
      return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
