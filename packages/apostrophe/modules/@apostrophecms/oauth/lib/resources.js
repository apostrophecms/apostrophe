// Protected resources: the routes that accept this server's tokens. Each
// has a metadata document (RFC 9728) that names this server, and answers a
// request without a valid token with a 401 pointing at it.
//
// A resource is identified by its site-relative path, without the prefix,
// as the module's own routes are: `/api/v1/@apostrophecms/mcp`. Its
// resource identifier, which a token's audience must match (RFC 8707), is
// the absolute URL.

const WELL_KNOWN = '/.well-known/oauth-protected-resource';

module.exports = (self) => {
  return {
    // Registers the route at `path` as a protected resource. Call it from
    // the resource module's `init`. Returns false, and registers nothing,
    // when the site has turned the server off with `enabled: false`.
    //
    // `name` is shown to people (the approval page, the metadata's
    // `resource_name`)
    addResource(path, { name } = {}) {
      if (!((typeof path === 'string') && path.startsWith('/') && !path.endsWith('/'))) {
        throw new Error(`An OAuth resource's path must start with / and not end with /: "${path}".`);
      }
      if (self.options.enabled === false) {
        return false;
      }
      self.resources.set(path, { name });
      return true;
    },

    // The resource identifier for `path`
    getResourceUrl(path) {
      return `${self.getIssuer()}${path}`;
    },

    // Where the metadata for `path` is served
    getResourceMetadataUrl(path) {
      return `${self.getIssuer()}${WELL_KNOWN}${path}`;
    },

    // The metadata for the resource at `path`, or null if none is registered
    getResourceMetadata(path) {
      const resource = self.resources.get(path);
      if (!resource) {
        return null;
      }
      return {
        resource: self.getResourceUrl(path),
        authorization_servers: [ self.getIssuer() ],
        scopes_supported: self.getScopes(),
        bearer_methods_supported: [ 'header' ],
        ...(resource.name && { resource_name: resource.name })
      };
    },

    // Answers a request to the resource at `path` that has no valid token:
    // a 401 whose `WWW-Authenticate` names the resource's metadata (RFC
    // 9728) and the scope. `error` is omitted when no token was sent (RFC
    // 6750), and is `invalid_token` for one that's unknown, expired, revoked
    // or for another audience.
    //
    // Works while the server is off too, without the metadata, so a resource
    // answers the same way either way.
    challenge(res, path, { error, message } = {}) {
      const params = [];
      if (self.isEnabled() && self.resources.has(path)) {
        params.push(`resource_metadata="${self.getResourceMetadataUrl(path)}"`);
        params.push(`scope="${self.getScopes().join(' ')}"`);
      }
      if (error) {
        params.push(`error="${error}"`);
      }
      res.set('WWW-Authenticate', params.length ? `Bearer ${params.join(', ')}` : 'Bearer');
      // A browser-based client must be able to read the header to find the
      // metadata
      res.set('Access-Control-Expose-Headers', 'WWW-Authenticate');
      return res.status(401).send({
        name: 'invalid',
        message: message || (error ? 'bearer token invalid' : 'bearer token required')
      });
    }
  };
};
