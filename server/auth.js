import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const keyLength = 64;
const saltLength = 16;
const dummySalt = Buffer.alloc(saltLength);
const dummyHash = crypto.scryptSync('not-a-real-password', dummySalt, keyLength).toString('hex');
const dummyPasswordHash = `scrypt$${dummySalt.toString('hex')}$${dummyHash}`;

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(saltLength);
  const derivedKey = await scrypt(password, salt, keyLength);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
};

export const verifyPassword = async (password, encodedHash) => {
  if (!encodedHash || typeof encodedHash !== 'string') return false;
  const [, saltHex, hashHex] = encodedHash.split('$');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, keyLength);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const createSessionToken = () => crypto.randomBytes(32).toString('base64url');
export const hashSessionToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export { dummyPasswordHash };
