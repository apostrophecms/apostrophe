module.exports = {
  options: {
    alias: 'error'
  },
  init(self, options) {
    // Aliased for brevity, encouraging use of the mechanism
    self.apos.error = self.error;
  },
  methods(self, options) {
    return {
      // Construct an Error object suitable to throw. The `name` property will
      // be the given `name`.
      //
      // `message` may be skipped completely, or given for a longer
      // description. `data` is optional and may contain data about
      // the error, safe to share with an untrusted client.
      //
      // Certain values of `name` match to certain HTTP status codes; see
      // the `http` module. If the error is caught by Apostrophe's `apiRoute`
      // or `restApiRoute` mechanism, and `name` matches to a status code, an appropriate
      // HTTP error is sent, and `data` is sent as a JSON object, with `message`
      // as an additional property if present. If it doesn't match, a plain 500 error
      // is sent to avoid disclosing inappropriate information and the error is only
      // logged by Apostrophe server-side.
      //
      // For brevity, this method is aliased as `apos.error`.
      error(name, message = null, data = {}) {
        if ((typeof message) === 'object') {
          data = message;
          message = null;
        }
        const error = new Error(message || name);
        error.name = name;
        error.data = data;
        // Establish a difference between errors built here and those elsewhere.
        error.aposError = true;
        return error;
      }
    };
  }
};
