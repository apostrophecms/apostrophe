// Implements the ["video" apostrophe schema field type](../../tutorials/getting-started/schema-guide.html).
//
// The value of the field is an object with `url`, `title` and `thumbnail` properties, the latter
// two being as obtained by `oembetter` at the time the URL was originally pasted and fetched
// via the `oembed` protocol.
//
// This field type is locked down to accept only URLs whose oembed response type
// is `video`.
//
// Videos are not actually hosted or stored by Apostrophe. They are displayed via
// oembed-capable third party services like Vimeo and YouTube.

module.exports = {
  options: {
    name: 'oembed',
    alias: 'oembedFields'
  },
  init(self) {
    self.name = self.options.name;
    self.oembedType = self.options.oembedType;
    self.addFieldType();
    self.enableBrowserData();
  },
  methods(self) {
    return {
      addFieldType() {
        self.apos.schema.addFieldType({
          name: self.name,
          async convert(req, field, data, destination) {
            if (typeof data[field.name] === 'string') {
              destination[field.name] = {
                url: self.apos.launder.url(data[field.name], null, true)
              };
            } else if (data[field.name]) {
              destination[field.name] = {
                url: self.apos.launder.url(data[field.name].url, null, true),
                title: self.apos.launder.string(data[field.name].title),
                thumbnail: self.apos.launder.url(data[field.name].thumbnail, null, true)
              };
            }
          },
          diffable: function (value) {
            // URLs are fine to diff and display
            if (typeof value === 'object') {
              return value.url;
            }
            // always return a valid string
            return '';
          }
        });
      },
      getBrowserData(req) {
        return {
          name: self.name,
          action: self.action,
          oembedType: self.options.oembedType
        };
      }
    };
  }
};
