const { toEmulate, wrapMaybeCallback } = require('./utils.js');

module.exports = function (baseClass) {
  class EmulateFindCursor extends baseClass {
    count(options, callback) {
      callback =
        typeof callback === 'function'
          ? callback
          : typeof options === 'function'
            ? options
            : undefined;
      options = typeof options !== 'function' ? options : undefined;

      return wrapMaybeCallback(
        this
          .clone()
          .project({ _id: 1 })
          .sort(null)
          .toArray()
          .then(count => count.length),
        callback
      );
    }

    sort(sort, direction) {
      return super.sort(sort || {}, direction);
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
          Object.setPrototypeOf(this, EmulateFindCursor.prototype);
          return this;
        }
      }
    );
  }

  return EmulateFindCursor;
};
