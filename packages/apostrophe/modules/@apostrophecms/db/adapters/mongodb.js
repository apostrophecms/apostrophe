// MongoDB adapter - thin wrapper around existing driver compatibility stack
const mongodbConnect = require('../../../../lib/mongodb-connect');

module.exports = {
  name: 'mongodb',
  protocols: [ 'mongodb', 'mongodb+srv' ],
  async connect(uri, options) {
    return mongodbConnect(uri, options);
  }
};
