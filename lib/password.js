var passwordHash = require('password-hash');

module.exports = function(self) {
  self.hashPassword = function(password) {
    return passwordHash.generate(password);
  };
};

