const { toEmulate, wrapMaybeCallback } = require('./utils.js');

module.exports = function (baseClass) {
  class EmulateMongoClient extends baseClass {
    constructor(connectionString, options) {
      const {
        useUnifiedTopology,
        useNewUrlParser,
        autoReconnect,
        reconnectTries,
        reconnectInterval,
        ...v6Options
      } = options || {};

      super(connectionString, v6Options);
    }

    static connect(url, options, callback) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
            ? options
            : undefined;
      options = typeof options !== 'function' ? options : undefined;

      try {
        const client = new this(url, options);

        return client.connect(callback);
      } catch (error) {
        return wrapMaybeCallback(Promise.reject(error), callback);
      }
    }

    connect(callback) {
      return wrapMaybeCallback(
        super.connect().then(() => this),
        callback
      );
    }

    db(dbName, options) {
      return super.db(dbName, options)[toEmulate]();
    }
  }

  return EmulateMongoClient;
};
