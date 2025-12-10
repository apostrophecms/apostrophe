const mongo = require('@apostrophecms/emulate-mongo-3-driver');
const dns = require('dns');

// Connect to MongoDB, using the modern topology and parser, and
// a tolerant policy to successfully connect to "localhost" even if
// the first record returned by the resolver doesn't reach mongodb's
// bind address because localhost resolves first to ::1 (ipv6) and
// mongodb lists only on 127.0.0.1 (ipv4) by default. For broadest
// compatibility we don't assume we know this will happen, we try all the
// addresses that localhost actually resolves to and succeed with the
// first one that works.

module.exports = async (uri, options) => {
  const connectOptions = {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    ...options
  };
  let parsed;
  try {
    parsed = new URL(uri);
  } catch (e) {
    // Parse failed, e.g. old school replica set URI
    // with commas, just let the mongo driver handle it
    return mongo.MongoClient.connect(uri, connectOptions);
  }
  if (!parsed || (parsed.protocol !== 'mongodb:') || (parsed.hostname !== 'localhost')) {
    return mongo.MongoClient.connect(parsed.toString(), connectOptions);
  }
  const records = await dns.promises.lookup('localhost', { all: true });
  if (!records.length) {
    // The computer that reaches this point has bigger problems 😅
    throw new Error('Unable to resolve localhost to an IP address.');
  }
  return new Promise((resolve, reject) => {
    let failed = 0;
    let succeeded = false;
    records.forEach(attempt);
    async function attempt(record) {
      try {
        const parsed = new URL(uri);
        parsed.hostname = record.address;
        const result = await mongo.MongoClient.connect(parsed.toString(), connectOptions);
        if (!succeeded) {
          succeeded = true;
          resolve(result);
        } else {
          // We succeeded in reaching localhost at both ip4 and ip6,
          // but we only need one of them to succeed
          await result.close();
        }
      } catch (e) {
        failed++;
        if (failed === records.length) {
          // None succeeded, so reject with the last error
          // (which one we reject with doesn't really matter)
          reject(e);
        }
      }
    }
  });
};
