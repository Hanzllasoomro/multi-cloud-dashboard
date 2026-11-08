// Ledger auth — passwords (v1.6). scrypt + per-user salt, 12-char policy.
// No plaintext password is ever stored or logged.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const COMMON_PASSWORDS = new Set([
  "password", "password123", "password1234", "123456", "12345678", "123456789",
  "1234567890", "qwerty", "qwerty123", "letmein", "letmein123", "admin123",
  "welcome123", "changeme", "changeme123", "ledger", "ledger123", "aaaaaaa",
]);

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common — choose a less guessable one.";
  if (/^(.)\1+$/.test(password)) return "That password is too weak — use a mix of characters.";
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return attempt.length === expected.length && timingSafeEqual(attempt, expected);
}
