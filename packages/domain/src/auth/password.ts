import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const PREFIX = "scrypt-v1";

export async function hashPassword(password: string): Promise<string> {
  assertPassword(password);
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${PREFIX}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [prefix, saltHex, keyHex] = encodedHash.split("$");
  if (prefix !== PREFIX || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;

  try {
    const actual = (await scrypt(
      password,
      Buffer.from(saltHex, "hex"),
      KEY_LENGTH,
    )) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function assertPassword(password: string): void {
  if (password.length < 10 || password.length > 128) {
    throw new Error("A senha deve ter entre 10 e 128 caracteres");
  }
}
