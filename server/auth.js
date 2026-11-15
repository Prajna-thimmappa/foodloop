const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const keyLength = 64;
const saltLength = 16;
const dummySalt = Buffer.alloc(saltLength);
const dummyHash = crypto.scryptSync('not-a-real-password', dummySalt, keyLength).toString('hex');
const dummyPasswordHash = `scrypt$${dummySalt.toString('hex')}$${dummyHash}`;

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(saltLength);
  const derivedKey = await scrypt(password, salt, keyLength);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
};

const verifyPassword = async (password, encodedHash) => {
  const [, saltHex, hashHex] = encodedHash.split('$');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, keyLength);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const createSessionToken = () => crypto.randomBytes(32).toString('base64url');
const hashSessionToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  hashPassword,
  verifyPassword,
  dummyPasswordHash,
  createSessionToken,
  hashSessionToken,
};
