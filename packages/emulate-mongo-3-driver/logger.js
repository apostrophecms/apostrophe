module.exports = function () {
  // https://github.com/mongodb/node-mongodb-native/blob/v5.0.0/etc/notes/CHANGES_5.0.0.md#mongoclientoptionslogger-and-mongoclientoptionsloglevel-removed
  class EmulateLogger {
    static setLevel() {
      // Do nothing
    }
  }

  return EmulateLogger;
};
