import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) =>
      error ? reject(error) : resolve(key as Buffer),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, n, r, p, saltText, hashText, extra] = encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    n !== '32768' ||
    r !== '8' ||
    p !== '1' ||
    !saltText ||
    !hashText ||
    extra !== undefined
  )
    return false;

  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
