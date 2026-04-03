/**
 * E2E Encryption for Talco using Web Crypto API (ECDH + AES-GCM)
 *
 * Flow:
 * 1. On login, attempt to load a persisted ECDH private key from IndexedDB.
 *    The key is stored wrapped (AES-KW) with a PBKDF2 key derived from the user's password.
 * 2. If found and successfully unwrapped, the same key pair is reused — DM history stays readable.
 * 3. If not found (new device/browser) or unwrap fails (password mismatch), a fresh pair is
 *    generated, persisted, and the new public key is published to the server.
 * 4. To send a DM: fetch recipient's public key → derive shared secret → encrypt with AES-GCM
 * 5. To receive a DM: use your private key + sender's public key → same shared secret → decrypt
 */

// ─── Key Generation ──────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "spki",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

// ─── Shared Secret Derivation ─────────────────────────────────────────────────

export async function deriveSharedKey(
  privateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

export interface EncryptedPayload {
  iv: string;
  data: string;
}

export async function encryptMessage(
  sharedKey: CryptoKey,
  plaintext: string,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encoded,
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
  };
}

export async function decryptMessage(
  sharedKey: CryptoKey,
  payload: EncryptedPayload,
): Promise<string> {
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    data,
  );
  return new TextDecoder().decode(plainBuffer);
}

// ─── Serialisation helpers ────────────────────────────────────────────────────

export function serializeEncrypted(payload: EncryptedPayload): string {
  return JSON.stringify({ __e2e: true, ...payload });
}

export function parseEncrypted(content: string): EncryptedPayload | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.__e2e && parsed.iv && parsed.data)
      return { iv: parsed.iv, data: parsed.data };
  } catch {
    /* not JSON */
  }
  return null;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const IDB_NAME = "yakk_e2e";
const IDB_STORE = "keys";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(IDB_STORE, "readonly")
      .objectStore(IDB_STORE)
      .get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(IDB_STORE, "readwrite")
      .objectStore(IDB_STORE)
      .put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(IDB_STORE, "readwrite")
      .objectStore(IDB_STORE)
      .delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── PBKDF2 wrapping key ──────────────────────────────────────────────────────
// Derives an AES-KW wrapping key from the user's password + a random salt.
// The wrapping key is used to encrypt/decrypt the ECDH private key at rest in IndexedDB.

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    base,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

interface PersistedBundle {
  wrappedPrivateKey: string; // base64 AES-KW wrapped PKCS8
  publicKeySpki: string; // base64 SPKI public key
  salt: string; // base64 32-byte PBKDF2 salt
}

// ─── Key Store ────────────────────────────────────────────────────────────────

class E2EKeyStore {
  private keyPair: CryptoKeyPair | null = null;
  private sharedKeys: Map<number, CryptoKey> = new Map();

  /**
   * Called on every login.
   * - Loads a persisted key pair from IndexedDB and unwraps it with the user's password.
   * - Falls back to generating a fresh pair (and persisting it) if none exists or unwrap fails.
   * Returns the base64 public key to publish to the server.
   */
  async init(username: string, password: string): Promise<string> {
    try {
      const db = await openIDB();
      const storeKey = `ecdh:${username}`;
      const bundle = (await idbGet(db, storeKey)) as
        | PersistedBundle
        | undefined;

      if (bundle) {
        try {
          const salt = Uint8Array.from(atob(bundle.salt), (c) =>
            c.charCodeAt(0),
          );
          const wrappingKey = await deriveWrappingKey(password, salt);
          const wrapped = Uint8Array.from(atob(bundle.wrappedPrivateKey), (c) =>
            c.charCodeAt(0),
          );

          const privateKey = await crypto.subtle.unwrapKey(
            "pkcs8",
            wrapped,
            wrappingKey,
            "AES-KW",
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey"],
          );

          const pubBytes = Uint8Array.from(atob(bundle.publicKeySpki), (c) =>
            c.charCodeAt(0),
          );
          const publicKey = await crypto.subtle.importKey(
            "spki",
            pubBytes,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            [],
          );

          this.keyPair = { privateKey, publicKey };
          db.close();
          // Return existing public key — no need to re-publish unless the server lost it
          return bundle.publicKeySpki;
        } catch {
          // Wrong password or corrupted bundle — regenerate
          await idbDelete(db, storeKey);
        }
      }

      // Generate fresh pair and persist it
      this.keyPair = await generateKeyPair();
      const publicKeyB64 = await exportPublicKey(this.keyPair.publicKey);
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const wrappingKey = await deriveWrappingKey(password, salt);
      const wrappedPrivate = await crypto.subtle.wrapKey(
        "pkcs8",
        this.keyPair.privateKey,
        wrappingKey,
        "AES-KW",
      );

      const newBundle: PersistedBundle = {
        wrappedPrivateKey: btoa(
          String.fromCharCode(...new Uint8Array(wrappedPrivate)),
        ),
        publicKeySpki: publicKeyB64,
        salt: btoa(String.fromCharCode(...salt)),
      };
      await idbSet(db, storeKey, newBundle);
      db.close();
      return publicKeyB64;
    } catch (err) {
      // IndexedDB unavailable (e.g. some private-browsing modes) — fall back to in-memory only
      console.warn(
        "E2E key persistence unavailable, using in-memory only:",
        err,
      );
      this.keyPair = await generateKeyPair();
      return exportPublicKey(this.keyPair.publicKey);
    }
  }

  getPrivateKey(): CryptoKey {
    if (!this.keyPair) throw new Error("E2E key store not initialised");
    return this.keyPair.privateKey;
  }

  getPublicKey(): CryptoKey {
    if (!this.keyPair) throw new Error("E2E key store not initialised");
    return this.keyPair.publicKey;
  }

  async getSharedKey(
    userId: number,
    theirPublicKeyB64: string,
  ): Promise<CryptoKey> {
    if (this.sharedKeys.has(userId)) return this.sharedKeys.get(userId)!;
    const theirKey = await importPublicKey(theirPublicKeyB64);
    const shared = await deriveSharedKey(this.getPrivateKey(), theirKey);
    this.sharedKeys.set(userId, shared);
    return shared;
  }

  clear() {
    this.keyPair = null;
    this.sharedKeys.clear();
  }
}

export const e2eKeyStore = new E2EKeyStore();
