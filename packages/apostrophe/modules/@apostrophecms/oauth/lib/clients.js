// Clients: the tools that ask users for access. A client is known one of two
// ways:
//
// - Dynamic Client Registration (DCR, RFC 7591): the client posts its
//   metadata to the register endpoint and gets a random `client_id`.
// - Client ID Metadata Documents (CIMD): the `client_id` is an https URL,
//   and the client's metadata is the JSON document served there. It's
//   fetched when first needed, then cached (see lib/cimd.js).
//
// Either way the metadata is checked the same way. Only public clients
// (`token_endpoint_auth_method: none`) are taken so far: an AI tool can't
// keep a secret, and PKCE proves it's the same client at the token endpoint.
// Clients with a secret, registered by an admin, are later work (see the
// design note).
//
// Both are kept in one collection, `_id` being the `client_id`: DCR clients
// for good, CIMD documents until their cache expires.

const crypto = require('node:crypto');

const MAX_REDIRECT_URIS = 10;
const MAX_URL_LENGTH = 2000;
const MAX_TEXT_LENGTH = 200;
const GRANT_TYPES = [ 'authorization_code', 'refresh_token' ];
// Never valid as a redirect: they run or show content instead of reaching
// the client
const REFUSED_SCHEMES = [
  'javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:', 'ws:', 'wss:', 'ftp:'
];
// RFC 8252 section 7.3. `localhost` isn't recommended there, but CLI
// clients use it
const LOOPBACK_HOSTS = [ '127.0.0.1', '[::1]', 'localhost' ];

module.exports = (self) => {
  return {
    async ensureClientsCollection() {
      self.clients = self.apos.db.collection('aposOauthClients');
      // Cached CIMD documents expire. DCR clients have no `expiresAt` and
      // stay off the index
      await self.clients.createIndex({ expiresAt: 1 }, {
        expireAfterSeconds: 0,
        sparse: true
      });
    },

    // Registers a client from DCR metadata. Returns the registration
    // response, or throws an OAuth error (see `oauthError`)
    async registerClient(input) {
      const metadata = self.validateClientMetadata(input);
      const clientId = crypto.randomBytes(24).toString('base64url');
      const createdAt = new Date();
      await self.clients.insertOne({
        _id: clientId,
        source: 'dcr',
        metadata,
        createdAt
      });
      return {
        client_id: clientId,
        client_id_issued_at: Math.floor(createdAt.getTime() / 1000),
        ...metadata
      };
    },

    // The client with this `client_id`: `{ clientId, source, metadata }`, or
    // null when there is none. For a CIMD client id, fetches the document if
    // it isn't cached, and throws an `invalid_client` OAuth error when it
    // can't be fetched or isn't valid
    async getClient(clientId) {
      if ((typeof clientId !== 'string') || !clientId.length || (clientId.length > MAX_URL_LENGTH)) {
        return null;
      }
      if (self.isClientMetadataDocumentId(clientId)) {
        if (!self.options.clientMetadataDocuments) {
          return null;
        }
        return self.getClientFromDocument(clientId);
      }
      const client = await self.clients.findOne({
        _id: clientId,
        source: 'dcr'
      });
      return client && {
        clientId,
        source: 'dcr',
        metadata: client.metadata
      };
    },

    // Checks client metadata from DCR or a CIMD document. Returns the
    // metadata this server keeps, with defaults filled in. Unknown fields
    // are dropped (RFC 7591 section 2)
    validateClientMetadata(input) {
      if (!input || (typeof input !== 'object') || Array.isArray(input)) {
        throw self.oauthError('invalid_client_metadata', 'The client metadata must be a JSON object.');
      }
      const {
        redirect_uris: redirectUris,
        token_endpoint_auth_method: authMethod = 'none',
        grant_types: grantTypes = [ 'authorization_code' ],
        response_types: responseTypes = [ 'code' ],
        scope = self.getScopes().join(' ')
      } = input;

      if (!Array.isArray(redirectUris) || !redirectUris.length) {
        throw self.oauthError('invalid_redirect_uri', 'redirect_uris must be a non-empty array.');
      }
      if (redirectUris.length > MAX_REDIRECT_URIS) {
        throw self.oauthError('invalid_redirect_uri', `At most ${MAX_REDIRECT_URIS} redirect_uris are allowed.`);
      }
      for (const uri of redirectUris) {
        self.validateRedirectUri(uri);
      }
      if (authMethod !== 'none') {
        throw self.oauthError('invalid_client_metadata', 'Only public clients are supported: token_endpoint_auth_method must be "none".');
      }
      if (input.client_secret != null) {
        throw self.oauthError('invalid_client_metadata', 'Only public clients are supported: a client_secret is not allowed.');
      }
      if (
        !isStringArray(grantTypes) ||
        !grantTypes.includes('authorization_code') ||
        grantTypes.some(type => !GRANT_TYPES.includes(type))
      ) {
        throw self.oauthError('invalid_client_metadata', 'grant_types must include "authorization_code" and may add only "refresh_token".');
      }
      if (!isStringArray(responseTypes) || (responseTypes.join() !== 'code')) {
        throw self.oauthError('invalid_client_metadata', 'response_types must be [ "code" ].');
      }
      if ((typeof scope !== 'string') || scope.split(' ').some(name => !self.getScopes().includes(name))) {
        throw self.oauthError('invalid_client_metadata', `scope may name only: ${self.getScopes().join(', ')}.`);
      }

      return {
        redirect_uris: [ ...new Set(redirectUris) ],
        token_endpoint_auth_method: 'none',
        grant_types: [ ...new Set(grantTypes) ],
        response_types: [ 'code' ],
        scope,
        ...optionalText('client_name'),
        ...optionalText('software_id'),
        ...optionalText('software_version'),
        ...optionalHttpsUrl('client_uri'),
        ...optionalHttpsUrl('logo_uri')
      };

      function optionalText(name) {
        const value = input[name];
        if (value == null) {
          return {};
        }
        if ((typeof value !== 'string') || (value.length > MAX_TEXT_LENGTH)) {
          throw self.oauthError('invalid_client_metadata', `${name} must be a string of at most ${MAX_TEXT_LENGTH} characters.`);
        }
        return { [name]: value };
      }

      function optionalHttpsUrl(name) {
        const value = input[name];
        if (value == null) {
          return {};
        }
        const url = (typeof value === 'string') && (value.length <= MAX_URL_LENGTH) && URL.parse(value);
        if (!url || (url.protocol !== 'https:')) {
          throw self.oauthError('invalid_client_metadata', `${name} must be an https URL.`);
        }
        return { [name]: value };
      }
    },

    // A redirect URI may be:
    //
    // - https
    // - http on a loopback host, for CLI clients (RFC 8252 section 7.3)
    // - a private-use scheme, for desktop apps (`cursor://...`, RFC 8252
    //   section 7.1), except schemes that run or show content
    //
    // and never has a fragment or credentials (RFC 6749 section 3.1.2)
    validateRedirectUri(uri) {
      const url = (typeof uri === 'string') && (uri.length <= MAX_URL_LENGTH) && URL.parse(uri);
      if (!url) {
        throw self.oauthError('invalid_redirect_uri', `Not a valid redirect URI: ${JSON.stringify(uri)}.`);
      }
      if (url.hash || uri.includes('#')) {
        throw self.oauthError('invalid_redirect_uri', `A redirect URI may not have a fragment: ${uri}.`);
      }
      if (url.username || url.password) {
        throw self.oauthError('invalid_redirect_uri', `A redirect URI may not have credentials: ${uri}.`);
      }
      if (url.protocol === 'https:') {
        return;
      }
      if (url.protocol === 'http:') {
        if (!LOOPBACK_HOSTS.includes(url.hostname)) {
          throw self.oauthError('invalid_redirect_uri', `An http redirect URI must be on a loopback host (127.0.0.1, [::1] or localhost): ${uri}.`);
        }
        return;
      }
      if (REFUSED_SCHEMES.includes(url.protocol)) {
        throw self.oauthError('invalid_redirect_uri', `The ${url.protocol} scheme is not allowed in a redirect URI: ${uri}.`);
      }
    },

    // Whether `uri` is one of the client's registered redirect URIs. The
    // match is exact, except that a loopback http URI may use any port (RFC
    // 8252 section 7.3), since a CLI client listens on whichever port is
    // free
    matchesRedirectUri(client, uri) {
      if (typeof uri !== 'string') {
        return false;
      }
      const registered = client.metadata.redirect_uris;
      if (registered.includes(uri)) {
        return true;
      }
      const requested = getLoopbackUrl(uri);
      if (!requested) {
        return false;
      }
      return registered.some(candidate => {
        const url = getLoopbackUrl(candidate);
        return url && (withoutPort(url) === withoutPort(requested));
      });

      function getLoopbackUrl(value) {
        const url = URL.parse(value);
        return (url && (url.protocol === 'http:') && LOOPBACK_HOSTS.includes(url.hostname))
          ? url
          : null;
      }

      function withoutPort(url) {
        const copy = new URL(url.href);
        copy.port = '';
        return copy.href;
      }
    }
  };
};

function isStringArray(value) {
  return Array.isArray(value) && value.length && value.every(item => typeof item === 'string');
}
