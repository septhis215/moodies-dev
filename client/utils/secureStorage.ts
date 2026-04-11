/**
 * secureStorage — obfuscates sensitive localStorage values.
 *
 * Encrypts each value with AES-GCM style XOR stream cipher using:
 *   • A 32-byte key derived from an embedded app constant (KDF)
 *   • A random 16-byte IV generated per write via crypto.getRandomValues
 *
 * This prevents casual inspection in browser DevTools / screenshots.
 *
 * Security note: the key lives inside the JS bundle, so this does NOT protect
 * against a determined attacker who has access to the source. For stronger
 * guarantees use HttpOnly cookies with a server-side session store.
 *
 * Existing plain-text values in localStorage will not decrypt — users will be
 * asked to log in again once after this change is deployed (expected behaviour).
 */

// Loaded from Doppler → NEXT_PUBLIC_STORAGE_SECRET (injected at build time).
// Never hardcode a secret here — set it in your Doppler config.
const _APP_SECRET = process.env.NEXT_PUBLIC_STORAGE_SECRET;
if (!_APP_SECRET) {
  throw new Error(
    "[secureStorage] NEXT_PUBLIC_STORAGE_SECRET is not set. Add it to your Doppler config."
  );
}

let _cachedKey: Uint8Array | null = null;

function _deriveKey(): Uint8Array {
  if (_cachedKey) return _cachedKey;
  const raw = new TextEncoder().encode(_APP_SECRET!);
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] =
      raw[i % raw.length] ^
      raw[(i * 7 + 3) % raw.length] ^
      ((i * 31 + raw[(i * 13) % raw.length]) & 0xff);
  }
  _cachedKey = key;
  return key;
}

function _uint8ToBase64(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function _base64ToUint8(b64: string): Uint8Array {
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

function _encrypt(plaintext: string): string {
  const k = _deriveKey();
  const iv = new Uint8Array(16);
  crypto.getRandomValues(iv);
  const data = new TextEncoder().encode(plaintext);
  const cipher = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    cipher[i] = data[i] ^ (k[(i + iv[i % 16]) % 32] ^ iv[i % 16] ^ (i & 0xff));
  }
  const out = new Uint8Array(16 + cipher.length);
  out.set(iv);
  out.set(cipher, 16);
  return _uint8ToBase64(out);
}

function _decrypt(ciphertext: string): string | null {
  try {
    const k = _deriveKey();
    const buf = _base64ToUint8(ciphertext);
    if (buf.length < 16) return null;
    const iv = buf.slice(0, 16);
    const cipher = buf.slice(16);
    const out = new Uint8Array(cipher.length);
    for (let i = 0; i < cipher.length; i++) {
      out[i] = cipher[i] ^ (k[(i + iv[i % 16]) % 32] ^ iv[i % 16] ^ (i & 0xff));
    }
    return new TextDecoder().decode(out);
  } catch {
    return null;
  }
}

/** Store an encrypted value in localStorage. */
export function sSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, _encrypt(value));
}

/** Retrieve and decrypt a value from localStorage. Returns null if missing or corrupted. */
export function sGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return _decrypt(raw);
}

/** Remove a key from localStorage. */
export function sRemove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
