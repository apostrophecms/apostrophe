// Client ID Metadata Documents (CIMD, draft-ietf-oauth-client-id-metadata-
// document): a client whose `client_id` is an https URL publishes its
// metadata there, and this server fetches it.
//
// The URL is the client's choice, so the fetch is a request this server
// makes on a stranger's behalf. To keep it from reaching anything private:
//
// - https only, to the default port or any other, but never to a private,
//   loopback, link-local or otherwise reserved address. The address checked
//   is the one connected to, after DNS, so a name that resolves to a private
//   address (or is rebound to one) is refused too.
// - No redirects followed.
// - A size cap and a timeout.
//
// The `clientMetadataDocuments: false` option turns CIMD off, for hosts that
// don't allow outbound requests: clients then use DCR.

const dns = require('node:dns');
const https = require('node:https');
const net = require('node:net');

// The draft recommends 5 KB at most
const MAX_DOCUMENT_BYTES = 5 * 1024;
const TIMEOUT_MS = 5000;
// How long a document is cached: its Cache-Control max-age, within these
// bounds, or the default
const MIN_CACHE_SECONDS = 5 * 60;
const MAX_CACHE_SECONDS = 24 * 60 * 60;
const DEFAULT_CACHE_SECONDS = 60 * 60;

const blockList = createBlockList();

function documentError(message) {
  const e = new Error(message);
  e.aboutDocument = true;
  return e;
}

module.exports = (self) => {
  return {
    // Whether `clientId` is meant as a CIMD URL. Any https URL is: one
    // that isn't a valid CIMD URL is refused rather than looked up as a DCR
    // client id, which is never a URL
    isClientMetadataDocumentId(clientId) {
      return clientId.startsWith('https://');
    },

    async getClientFromDocument(clientId) {
      const cached = await self.clients.findOne({
        _id: clientId,
        source: 'cimd',
        expiresAt: { $gt: new Date() }
      });
      if (cached) {
        return {
          clientId,
          source: 'cimd',
          metadata: cached.metadata
        };
      }
      self.validateClientMetadataDocumentUrl(clientId);
      let document, maxAge;
      try {
        ({ document, maxAge } = await self.fetchClientMetadataDocument(clientId));
      } catch (e) {
        // Only a cause about the document itself is passed on: one about
        // the address, such as what a name resolves to, would tell anyone
        // who asks about this server's network. The whole cause is logged
        const shown = e.aboutDocument ? e.message : 'its address could not be reached';
        const error = self.oauthError('invalid_client', `The client's metadata document could not be fetched from ${clientId}: ${shown}`);
        error.cause = e;
        throw error;
      }
      if (document.client_id !== clientId) {
        throw self.oauthError('invalid_client', `The client's metadata document at ${clientId} names a different client_id.`);
      }
      let metadata;
      try {
        metadata = self.validateClientMetadata(document);
      } catch (e) {
        throw self.oauthError('invalid_client', `The client's metadata document at ${clientId} is not valid: ${e.message}`);
      }
      const seconds = Math.min(
        Math.max(maxAge ?? DEFAULT_CACHE_SECONDS, MIN_CACHE_SECONDS),
        MAX_CACHE_SECONDS
      );
      await self.clients.replaceOne({ _id: clientId }, {
        _id: clientId,
        source: 'cimd',
        metadata,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + (seconds * 1000))
      }, { upsert: true });
      return {
        clientId,
        source: 'cimd',
        metadata
      };
    },

    // The draft's rules for the URL: https, a path, no fragment, no
    // credentials, no dot segments. A URL that the parser would rewrite
    // (dot segments, an uppercase host, the default port written out) is
    // refused too, since the document's `client_id` must equal it exactly
    validateClientMetadataDocumentUrl(clientId) {
      const url = URL.parse(clientId);
      const valid = url &&
        (url.protocol === 'https:') &&
        (url.href === clientId) &&
        (url.pathname !== '/') &&
        !url.hash &&
        !url.username &&
        !url.password;
      if (!valid) {
        throw self.oauthError('invalid_client', `Not a valid client metadata document URL: ${clientId}.`);
      }
    },

    // Fetches the JSON document at `url`. Resolves to `{ document, maxAge }`,
    // `maxAge` being the Cache-Control max-age in seconds, if any.
    //
    // An error that's only about the document, which the tool's developer
    // can see from anywhere (the status, the type, the size, the time it
    // took), has `aboutDocument: true`. Any other error, about the address or
    // the connection, could describe this server's network.
    //
    // `transport` and `timeout` are for tests, which can't serve https from
    // a public address
    fetchClientMetadataDocument(url, { transport = https, timeout = TIMEOUT_MS } = {}) {
      const { hostname } = new URL(url);
      // An IP address in the URL isn't looked up, so it's checked here
      const literal = hostname.replace(/^\[(.*)\]$/, '$1');
      if (net.isIP(literal) && !self.isPublicAddress(literal)) {
        // The address is in the URL already, so it says nothing new
        return Promise.reject(documentError(`${literal} is not a public address`));
      }
      return new Promise((resolve, reject) => {
        // Only the first outcome counts: aborting a response mid-stream can
        // still end it, with a partial body
        let settled = false;
        const settle = (fn) => (value) => {
          if (!settled) {
            settled = true;
            fn(value);
          }
        };
        resolve = settle(resolve);
        reject = settle(reject);
        const request = transport.get(url, {
          headers: { accept: 'application/json' },
          lookup: publicLookup,
          // No connection reuse: each connection is checked
          agent: false,
          signal: AbortSignal.timeout(timeout)
        }, (response) => {
          if (response.statusCode !== 200) {
            response.resume();
            return reject(documentError(`the response status was ${response.statusCode}`));
          }
          if (!/\bjson\b/i.test(response.headers['content-type'] || '')) {
            response.resume();
            return reject(documentError('the response is not JSON'));
          }
          const length = Number(response.headers['content-length']);
          if (length > MAX_DOCUMENT_BYTES) {
            response.resume();
            return reject(documentError(`the document is larger than ${MAX_DOCUMENT_BYTES} bytes`));
          }
          const chunks = [];
          let size = 0;
          response.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_DOCUMENT_BYTES) {
              reject(documentError(`the document is larger than ${MAX_DOCUMENT_BYTES} bytes`));
              request.destroy();
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () => {
            let document;
            try {
              document = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch (e) {
              return reject(documentError('the document is not valid JSON'));
            }
            if (!document || (typeof document !== 'object') || Array.isArray(document)) {
              return reject(documentError('the document is not a JSON object'));
            }
            resolve({
              document,
              maxAge: getMaxAge(response.headers['cache-control'])
            });
          });
          response.on('error', reject);
        });
        request.on('error', (e) => {
          reject((e.name === 'AbortError') || (e.name === 'TimeoutError')
            ? documentError(`no response within ${timeout / 1000} seconds`)
            : e);
        });
      });

      // Resolves as usual, but fails if any address is not public, so the
      // connection can only go to a public one
      function publicLookup(name, options, callback) {
        dns.lookup(name, {
          ...options,
          all: true
        }, (err, addresses) => {
          if (err) {
            return callback(err);
          }
          const refused = addresses.find(({ address }) => !self.isPublicAddress(address));
          if (refused) {
            return callback(new Error(`${name} resolves to ${refused.address}, which is not a public address`));
          }
          if (options.all) {
            return callback(null, addresses);
          }
          return callback(null, addresses[0].address, addresses[0].family);
        });
      }
    },

    isPublicAddress(address) {
      const type = net.isIP(address);
      if (!type) {
        return false;
      }
      return !blockList.check(address, (type === 6) ? 'ipv6' : 'ipv4');
    }
  };
};

// The special-purpose ranges of the IANA registries: anything but the
// public internet
function createBlockList() {
  const list = new net.BlockList();
  for (const [ address, prefix ] of [
    [ '0.0.0.0', 8 ],
    [ '10.0.0.0', 8 ],
    [ '100.64.0.0', 10 ],
    [ '127.0.0.0', 8 ],
    [ '169.254.0.0', 16 ],
    [ '172.16.0.0', 12 ],
    [ '192.0.0.0', 24 ],
    [ '192.0.2.0', 24 ],
    [ '192.88.99.0', 24 ],
    [ '192.168.0.0', 16 ],
    [ '198.18.0.0', 15 ],
    [ '198.51.100.0', 24 ],
    [ '203.0.113.0', 24 ],
    [ '224.0.0.0', 4 ],
    [ '240.0.0.0', 4 ]
  ]) {
    list.addSubnet(address, prefix, 'ipv4');
  }
  for (const [ address, prefix ] of [
    [ '::', 128 ],
    [ '::1', 128 ],
    // NAT64 addresses reach IPv4 ones, private ones included. IPv4-mapped
    // ones (::ffff:10.0.0.1) need no entry: BlockList checks them against
    // the IPv4 ranges above
    [ '64:ff9b::', 96 ],
    [ '64:ff9b:1::', 48 ],
    [ '100::', 64 ],
    [ '2001::', 23 ],
    [ '2001:db8::', 32 ],
    [ '2002::', 16 ],
    [ 'fc00::', 7 ],
    [ 'fe80::', 10 ],
    [ 'ff00::', 8 ]
  ]) {
    list.addSubnet(address, prefix, 'ipv6');
  }
  return list;
}

function getMaxAge(cacheControl) {
  const matches = (cacheControl || '').match(/(?:^|,)\s*max-age=(\d+)/i);
  return matches ? Number(matches[1]) : null;
}
