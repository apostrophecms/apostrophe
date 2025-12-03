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

  Object.defineProperty(
    baseClass.prototype,
    toEmulate,
    {
      enumerable: false,
      value: function () {
        Object.setPrototypeOf(this, EmulateFindCursor.prototype);
        return this;
      }
    }
  );

  return EmulateFindCursor;
};
