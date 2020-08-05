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
    name: 'video',
    oembedType: 'video',
    alias: 'videoFields'
  },
  init(self, options) {
    self.name = options.name;
    self.oembedType = options.oembedType;
    self.addFieldType();
    self.enableBrowserData();
  },
  methods(self, options) {
    return {
      addFieldType() {
        self.apos.schema.addFieldType({
          name: self.name,
          convert: async function (req, field, data, object) {
            if (typeof data[field.name] === 'string') {
              object[field.name] = { url: self.apos.launder.url(data[field.name]) };
            } else if (data[field.name]) {
              object[field.name] = {
                url: self.apos.launder.url(data[field.name].url),
                title: self.apos.launder.string(data[field.name].title),
                thumbnail: self.apos.launder.url(data[field.name].thumbnail)
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
