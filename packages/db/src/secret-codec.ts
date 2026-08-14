import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptSecret(value: string): Uint8Array<ArrayBuffer> {
  const key = encryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return new Uint8Array(
    Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), encrypted]),
  );
}

export function decryptSecret(value: Uint8Array | null): string | null {
  if (!value) return null;
  const payload = Buffer.from(value);
  if (payload.length <= 1 + IV_LENGTH + TAG_LENGTH || payload[0] !== VERSION)
    throw new Error("Segredo criptografado inválido");
  const iv = payload.subarray(1, 1 + IV_LENGTH);
  const tag = payload.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

function encryptionKey(): Buffer {
  const encoded = process.env["TOKEN_ENCRYPTION_KEY_BASE64"]?.trim();
  if (!encoded) throw new Error("TOKEN_ENCRYPTION_KEY_BASE64 não configurada");
  // Older local templates supplied a 32-byte key as 64 hexadecimal chars.
  // Keep those installations readable while preferring real base64 values.
  const key = /^[0-9a-f]{64}$/i.test(encoded)
    ? Buffer.from(encoded, "hex")
    : Buffer.from(encoded, "base64");
  if (key.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY_BASE64 deve representar 32 bytes");
  return key;
}
