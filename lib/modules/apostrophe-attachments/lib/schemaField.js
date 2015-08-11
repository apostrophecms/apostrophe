
module.exports = function(self, options) {

  self.rawPartial = self.partial;

  self.addFieldType = function() {
    self.apos.schemas.addFieldType({
      name: self.name,
      partial: self.fieldTypePartial,
      converters: self.converters
    });
  };

  self.fieldTypePartial = function(data) {
    return self.partial('attachment', data);
  };

  self.converters = {
    csv: function(req, data, name, object, field, callback) {
      // TODO would be interesting to support filenames mapped to a
      // configurable folder, with sanitization
      return setImmediate(callback);
    },
    form: function(req, data, name, object, field, callback) {
      var id = self.apos.launder.id(data[name]);
      if (!id) {
        data[name] = null;
        return setImmediate(callback);
      }
      return self.cache.get(id, function(err, info) {
        if (err) {
          return callback(err);
        }
        object[name] = info;
        return callback(null);
      });
    }
  };

  self.indexer = function(value, field, texts) {
    var silent = (field.silent === undefined) ? true : field.silent;
    texts.push({ weight: field.weight || 15, text: value.title, silent: silent });
  };

}
