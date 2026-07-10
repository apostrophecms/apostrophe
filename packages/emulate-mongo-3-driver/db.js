const { toEmulate, wrapMaybeCallback } = require('./utils.js');

module.exports = function (baseClass) {
  class EmulateDb extends baseClass {
    collections(options, callback) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
            ? options
            : undefined;
      options = typeof options !== 'function' ? options : undefined;

      return wrapMaybeCallback(
        super
          .collections(options)
          .then(collections => collections.map(collection => collection[toEmulate]())),
        callback
      );
    }

    collection(name, options, callback) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
            ? options
            : undefined;
      options = typeof options !== 'function' ? options : undefined;

      const collection = super.collection(name, options)[toEmulate]();
      if (callback) {
        callback(null, collection);
      }

      return collection;
    }

    createCollection(name, options, callback) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
            ? options
            : undefined;
      options = typeof options !== 'function' ? options : undefined;

      return wrapMaybeCallback(
        super.createCollection(name, options).then(collection => collection[toEmulate]()),
        callback
      );
    }

    ensureIndex(name, indexSpec, options, callback) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
            ? options
            : undefined;
      options = typeof options !== 'function' ? options : undefined;

      return wrapMaybeCallback(super.createIndex(name, indexSpec, options), callback);
    }

    renameCollection(from, to, options, callback) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
            ? options
            : undefined;
      options = typeof options !== 'function' ? options : undefined;

      return wrapMaybeCallback(
        super.renameCollection(from, to, options)
          .then(collection => collection[toEmulate]()),
        callback
      );
    }
  }

  // See collection.js for why this is guarded and `configurable`: multiple
  // copies of this module may patch the same shared `mongodb-legacy` prototype
  // via the global `Symbol.for()` key.
  if (!Object.prototype.hasOwnProperty.call(baseClass.prototype, toEmulate)) {
    Object.defineProperty(
      baseClass.prototype,
      toEmulate,
      {
        enumerable: false,
        configurable: true,
        value: function () {
          return Object.setPrototypeOf(this, EmulateDb.prototype);
        }
      }
    );
  }

  return EmulateDb;
};
