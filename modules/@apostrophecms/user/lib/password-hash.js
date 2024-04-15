// Password hashing based on scrypt, per:
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
//
// Also includes legacy support for pbkdf2 passwords.
//
// Adapted from the "credential" and "credentials" modules,
// which were also released under the MIT license.

const util = require('util');
const crypto = require('crypto');

const scrypt = util.promisify(crypto.scrypt);
const pbkdf2 = util.promisify(crypto.pbkdf2);
const randomBytes = util.promisify(crypto.randomBytes);
const timingSafeEqual = crypto.timingSafeEqual;

function getScryptOptions(options) {
  const result = {
    cost: 131072,
    parallelization: 1,
    blockSize: 8,
    ...options
  };
  // Per https://github.com/nodejs/node/issues/21524
  // Without this the parameters are rejected as soon as we
  // exceed the default cost of 16384
  result.maxmem = 128 * result.parallelization * result.blockSize + 128 * (2 + result.cost) * result.blockSize;
  return result;
}

configure.hash = hash;
configure.verify = verify;

module.exports = configure;

function configure(opts) {
  opts = {
    keyLength: 64,
    ...opts,
    scrypt: getScryptOptions(opts.scrypt)
  };
  return {
    hash: password => hash(password, opts),
    verify: (stored, input) => verify(stored, input, opts)
  };
}

async function hash(password, opts) {
  const { keyLength } = opts;

  if (typeof password !== 'string' || password.length === 0) {
    throw opts.error('Password must be a non-empty string.');
  }

  const salt = await randomBytes(keyLength);
  const hash = await scrypt(password, salt, keyLength, opts.scrypt);

  return JSON.stringify({
    hashMethod: 'scrypt',
    salt: salt.toString('base64'),
    hash: hash.toString('base64'),
    keyLength,
    scrypt: opts.scrypt
  });
}

async function verify(stored, input, opts) {
  const parsed = parse(stored);

  const {
    hashMethod, keyLength, salt, hash: hashA
  } = parse(stored);

  if (typeof input !== 'string' || input.length === 0) {
    throw opts.error('Input password must be a non-empty string.');
  }
  if (!hashMethod) {
    throw opts.error('Couldn\'t parse stored hash.');
  }
  let hashB;
  if (hashMethod === 'scrypt') {
    // Use scrypt as a more modern but also safely portable
    // solution in Node.js
    const { scrypt: scryptOptions } = parsed;
    // Calculate maxmem to make sure we still have the resources
    // if this password was hashed with a higher cost factor
    // than the one we are using for new passwords
    hashB = await scrypt(input, salt, keyLength, getScryptOptions(scryptOptions));
  } else {
    // Support existing pbkdf2 hashes from credentials module
    const { iterations } = parsed;
    const dfn = hashMethod.slice(0, 6);
    const hfn = hashMethod.slice(7) || 'sha1';
    if (dfn !== 'pbkdf2') {
      throw opts.error('Unsupported key derivation function');
    }
    if (![ 'sha1', 'sha512' ].includes(hfn)) {
      throw opts.error('Unsupported hash function');
    }
    hashB = await pbkdf2(input, salt, iterations, keyLength, hfn);
  }
  const equal = timingSafeEqual(hashA, hashB);
  if (equal && (hashMethod !== 'scrypt')) {
    // Modernize legacy hashes on next login
    return hash(input, opts);
  } else {
    return equal;
  }
}

function parse(stored) {
  try {
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      salt: Buffer.from(parsed.salt, 'base64'),
      hash: Buffer.from(parsed.hash, 'base64')
    };
  } catch (err) {
    return {};
  }
}
