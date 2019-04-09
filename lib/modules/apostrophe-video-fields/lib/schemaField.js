module.exports = function(self, options) {

  self.addFieldType = function() {
    self.apos.schemas.addFieldType({
      name: self.name,
      convert: async function(req, field, data, object) {
        if ((typeof data[field.name]) === 'string') {
          object[field.name] = {
            url: self.apos.launder.url(data[field.name])
          };
        } else if (data[field.name]) {
          object[field.name] = {
            url: self.apos.launder.url(data[field.name].url),
            title: self.apos.launder.string(data[field.name].title),
            thumbnail: self.apos.launder.url(data[field.name].thumbnail)
          };
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

};
