const _ = require('lodash');

module.exports = {
  options: {
    alias: 'http'
  },
  init(self, options) {
    self.errors = {
      'invalid': 400,
      'notfound': 404,
      'required': 422,
      'conflict': 409,
      'locked': 409,
      'unprocessable': 422
    };
    _.merge(self.errors, self.options.addErrors);
  },
  methods(self, options) {
    return {
      // Add another error name to http status code mapping so you
      // can throw `name` and get the status code `code`
      addError(name, code) {
        self.errors[name] = code;
      },
      // Returns an object you can `throw` to respond with the http
      // status code associated with `name`, and the JSON-friendly
      // object `data` as a response body
      error(name, data) {
        if (!data) {
          return name;
        }
        return {
          type: 'apostrophe-http-error',
          name: name,
          data: data
        };
      }
    };
  }
};  
