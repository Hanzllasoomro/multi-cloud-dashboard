// Ledger auth — API keys (v1.6).
// A key is `lk_` + 32 hex chars, shown in full exactly once at creation.
// Only its sha256 hash is stored. Keys inherit the owning user's role at
// use time (a role change or demotion applies to the key immediately),
// and a revoked key stops working at once. lastUsedAt is updated at
// most once an hour, so a key used on every request does not rewrite
// the auth file on every request.
import { createHash, randomBytes } from "node:crypto";
import { addApiKey, findApiKeyByHash, getUserById, listApiKeysForUser, updateApiKey, logAuthEvent, type ApiKeyRecord, type PublicApiKey, type PublicUser, publicUser } from "./store";

export const API_KEY_PREFIX = "lk_";

export function publicApiKey(k: ApiKeyRecord): PublicApiKey {
  return { id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt };
}

export function createApiKey(userId: string, name: string): { record: PublicApiKey; key: string } {
  const u = getUserById(userId);
  if (!u) throw new Error("User not found");
  const clean = name.trim();
  if (!clean) throw new Error("Give the API key a name.");
  if (clean.length > 80) throw new Error("API key name must be 80 characters or fewer.");
  const raw = randomBytes(16).toString("hex");
  const key = `${API_KEY_PREFIX}${raw}`;
  const record: ApiKeyRecord = {
    id: `key-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`,
    userId, name: clean, prefix: key.slice(0, 12),
    keyHash: createHash("sha256").update(key).digest("hex"),
    createdAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
  };
  addApiKey(record);
  logAuthEvent("api_key_created", { userId, email: u.email, detail: `${clean} (${record.prefix}…).` });
  return { record: publicApiKey(record), key };
}

export function listApiKeys(userId: string): PublicApiKey[] {
  return listApiKeysForUser(userId).map(publicApiKey);
}

export function revokeApiKey(userId: string, id: string): PublicApiKey {
  const k = listApiKeysForUser(userId).find((x) => x.id === id);
  if (!k) throw new Error("API key not found");
  if (k.revokedAt) throw new Error("API key is already revoked.");
  const updated = updateApiKey(id, { revokedAt: new Date().toISOString() })!;
  const u = getUserById(userId);
  logAuthEvent("api_key_revoked", { userId, email: u?.email, detail: `${k.name} (${k.prefix}…).` });
  return publicApiKey(updated);
}

/** Validate a raw key (Bearer token or X-Ledger-Api-Key header). Returns
 *  the owning public user, or null. Updates lastUsedAt at most hourly. */
export function validateApiKey(raw: string | undefined | null): PublicUser | null {
  if (!raw || !raw.startsWith(API_KEY_PREFIX)) return null;
  const hash = createHash("sha256").update(raw.trim()).digest("hex");
  const rec = findApiKeyByHash(hash);
  if (!rec) return null;
  const user = getUserById(rec.userId);
  if (!user) return null;
  const last = rec.lastUsedAt ? Date.parse(rec.lastUsedAt) : 0;
  if (Date.now() - last > 60 * 60 * 1000) {
    updateApiKey(rec.id, { lastUsedAt: new Date().toISOString() });
  }
  return publicUser(user);
}
