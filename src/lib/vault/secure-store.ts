/**
 * Encrypted client secret store (AES-GCM + per-device key in IndexedDB).
 * Prefers storing a non-extractable CryptoKey via structured clone.
 * Falls back to JWK (imported non-extractable at runtime) on older browsers.
 * Note: same-origin XSS can still use the key to decrypt — CSP is primary XSS control.
 */

const DB_NAME = "stippo-secure";
const DB_VERSION = 2;
const STORE = "kv";
const DEVICE_KEY_ID = "__device_aes_key__";
const DEVICE_KEY_RAW_ID = "__device_aes_key_jwk__"; // legacy

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("secure-store open failed"));
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

let cachedKey: CryptoKey | null = null;

async function getDeviceKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  // Prefer non-extractable CryptoKey stored via structured clone
  const storedKey = await idbGet<CryptoKey>(DEVICE_KEY_ID);
  if (storedKey && typeof storedKey === "object" && "type" in storedKey) {
    cachedKey = storedKey;
    return storedKey;
  }

  // Migrate legacy JWK → non-extractable CryptoKey in IDB
  const legacyJwk = await idbGet<JsonWebKey>(DEVICE_KEY_RAW_ID);
  if (legacyJwk && typeof legacyJwk === "object" && "k" in legacyJwk) {
    const imported = await crypto.subtle.importKey(
      "jwk",
      legacyJwk,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    try {
      await idbSet(DEVICE_KEY_ID, imported);
      await idbDel(DEVICE_KEY_RAW_ID);
    } catch {
      // structured clone of CryptoKey unsupported — keep JWK but use non-extractable runtime key
    }
    cachedKey = imported;
    return imported;
  }

  // Also check old key id that stored JWK under DEVICE_KEY_ID
  const maybeJwk = await idbGet<JsonWebKey | CryptoKey>(DEVICE_KEY_ID);
  if (
    maybeJwk &&
    typeof maybeJwk === "object" &&
    "k" in (maybeJwk as object) &&
    !("type" in (maybeJwk as object) && (maybeJwk as CryptoKey).type === "secret")
  ) {
    const jwk = maybeJwk as JsonWebKey;
    const imported = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    try {
      await idbSet(DEVICE_KEY_ID, imported);
    } catch {
      await idbSet(DEVICE_KEY_RAW_ID, jwk);
    }
    cachedKey = imported;
    return imported;
  }

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable when possible
    ["encrypt", "decrypt"]
  );

  try {
    await idbSet(DEVICE_KEY_ID, key);
    cachedKey = key;
    return key;
  } catch {
    // Fallback: generate extractable, persist JWK, use non-extractable import
    const extractable = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const exported = await crypto.subtle.exportKey("jwk", extractable);
    await idbSet(DEVICE_KEY_RAW_ID, exported);
    const runtime = await crypto.subtle.importKey(
      "jwk",
      exported,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    cachedKey = runtime;
    return runtime;
  }
}

function b64encode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]!);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type EncEnvelope = { v: 1; iv: string; ct: string };

export async function secureSet(key: string, value: unknown): Promise<void> {
  const cryptoKey = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    plaintext
  );
  const envelope: EncEnvelope = {
    v: 1,
    iv: b64encode(iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength)),
    ct: b64encode(ct),
  };
  await idbSet(key, envelope);
}

export async function secureGet<T>(key: string): Promise<T | null> {
  const envelope = await idbGet<EncEnvelope>(key);
  if (!envelope || envelope.v !== 1) return null;
  try {
    const cryptoKey = await getDeviceKey();
    const iv = b64decode(envelope.iv);
    const ct = b64decode(envelope.ct);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      cryptoKey,
      ct as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  } catch {
    return null;
  }
}

export async function secureRemove(key: string): Promise<void> {
  await idbDel(key);
}

/** Move plaintext localStorage secrets into encrypted store, then wipe legacy. */
export async function migrateLegacyLocalStorage<T>(
  legacyKey: string,
  secureKey: string
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const existing = await secureGet<T>(secureKey);
  if (existing) {
    try {
      localStorage.removeItem(legacyKey);
    } catch {
      /* ignore */
    }
    return existing;
  }
  try {
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    await secureSet(secureKey, parsed);
    localStorage.removeItem(legacyKey);
    return parsed;
  } catch {
    return null;
  }
}
