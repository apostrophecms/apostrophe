module.exports = function(self, options) {

  self.addFieldType = function() {
    self.apos.schemas.addFieldType({
      name: self.name,
      partial: self.fieldTypePartial,
      converters: {
        form: function(req, data, name, object, field, callback) {
          if (!data[name]) {
            if (field.required) {
              return callback('required');
            }
            object[name] = null;
            return setImmediate(callback);
          }
          object[name] = {
            url: self.apos.launder.url(data[name].url),
            title: self.apos.launder.string(data[name].title),
            thumbnail: self.apos.launder.url(data[name].thumbnail)
          };
          if ((!object[name].url) && field.required) {
            return callback('required');
          }
          return setImmediate(callback);
        },
        string: function(req, data, name, object, field, callback) {
          // TODO it would be nice to use oembed server side to populate the title
          // and thumbnail here
          object[name] = {
            url: self.apos.launder.url(data[name])
          };
          return setImmediate(callback);
        }
      },
      diffable: function(value) {
        // URLs are fine to diff and display
        if (typeof (value) === 'object') {
          return value.url;
        }
        // always return a valid string
        return '';
      }
    });
  };

  self.fieldTypePartial = function(data) {
    return self.partial('video', data);
  };

};
