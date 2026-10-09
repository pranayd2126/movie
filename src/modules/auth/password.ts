import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const parameters = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, parameters, (error, key) => error ? reject(error) : resolve(key)));
export async function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `scrypt-v1$${salt}$${(await derive(password,salt)).toString('hex')}`; }
export async function verifyPassword(password: string, encoded: string) {
  const [version,salt,hex] = encoded.split('$');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hex ?? '')) return false;
  return timingSafeEqual(await derive(password,salt), Buffer.from(hex,'hex'));
}
