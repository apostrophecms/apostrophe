apos.define('apostrophe-polymorphic-manager', {
  extend: 'apostrophe-context',
  construct: function(self, options) {
    self.get = function(options, callback) {
      options = _.assign(
        {}, self.options, options
      );
      console.log('options are:');
      console.log(options);
      if (!callback) {
        return apos.create('apostrophe-polymorphic-chooser', options);
      }
      return apos.create('apostrophe-polymorphic-chooser', options, callback);
    };
  }
});
