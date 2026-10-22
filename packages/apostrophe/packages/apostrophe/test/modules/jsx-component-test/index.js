const Promise = require('bluebird');

module.exports = {
  components(self) {
    return {
      async greet(req, input) {
        await Promise.delay(20);
        return {
          who: input.who,
          afterDelay: true
        };
      }
    };
  }
};
