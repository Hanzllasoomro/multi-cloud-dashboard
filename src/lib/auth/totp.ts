// Ledger auth — TOTP MFA (v1.6). RFC 6238, SHA-1, 30s period, 6 digits.
// Implemented with Node crypto only — no external dependency. A secret is
// stored reversibly (it must be, to verify future codes); the auth file is
// 0600 and gitignored, and the secret is never returned by any API after
// setup except the one-time setup response.
import { createHash, createHmac, randomBytes } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/, "").toUpperCase();
  let bits = 0, value = 0; const bytes: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid TOTP secret.");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}

export function otpauthUrl(secret: string, email: string): string {
  return `otpauth://totp/Ledger:${encodeURIComponent(email)}?secret=${secret}&issuer=Ledger&algorithm=SHA1&digits=6&period=30`;
}

export function totpCode(secret: string, timeMs = Date.now(), step = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timeMs / 30000) + step;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

/** Accepts the current step and ±1 step (clock skew), constant-time compare. */
export function verifyTotp(secret: string, code: string, timeMs = Date.now()): boolean {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  for (const step of [0, -1, 1]) {
    const expected = totpCode(secret, timeMs, step);
    let diff = 0;
    for (let i = 0; i < 6; i++) diff |= expected.charCodeAt(i) ^ clean.charCodeAt(i);
    if (diff === 0) return true;
  }
  return false;
}

// ---- Backup codes: 8 one-time codes, stored only as hashes ----
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateBackupCodes(): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < 8; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) code += BACKUP_ALPHABET[randomBytes(1)[0] % BACKUP_ALPHABET.length];
    plain.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return { plain, hashes: plain.map(hashBackupCode) };
}
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex");
}
