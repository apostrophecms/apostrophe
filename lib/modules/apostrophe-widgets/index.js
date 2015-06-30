module.exports = {

  afterConstruct: function(self) {

    if (!self.options.label) {
      throw new Error('You must specify the label option when subclassing apostrophe-widgets');
    }

    self.label = self.options.label;

    self.name = self.options.name || self.__meta.name.replace(/\-widgets$/, '');
    self.apos.areas.setWidgetManager(self.name, self);

    self.pushAsset('script', 'always', { when: 'always' });

    self.pushAsset('script', 'user', { when: 'user' });

    self.pushAsset('script', 'editor', { when: 'user' });

    self.apos.push.browserCall('always', 'apos.define(?, ?)',
      self.__meta.name,
      {
        extendIfFirst: 'apostrophe-widgets',
        name: self.name,
        label: self.label,
        action: self.action,
        schema: self.schema
      }
    );

    self.apos.push.browserCall('always', 'apos.create(?, {})',
      self.__meta.name);
  },

  construct: function(self, options) {

    self.schema = self.apos.schemas.compose(options);

    // Outputs the widget. Invoked by
    // apos.widget in Nunjucks.

    self.output = function(widget, options) {
      var result = self.partial('widget', { widget: widget, options: options, manager: self });
      return result;
    };

    // Perform joins and any other necessary async
    // actions for our type of widget. Note that
    // an array of widgets is handled in a single call
    // as you can usually optimize this.
    //
    // Override this to perform custom joins not
    // specified by your schema, talk to APIs, etc.

    self.load = function(req, widgets, callback) {
      return self.apos.schemas.join(req, self.schema, widgets, undefined, callback);
    };

    self.sanitize = function(req, input, callback) {
      var output = {};
      return self.apos.schemas.convert(req, self.schema, 'form', input, output, function(err) {
        if (err) {
          return callback(err);
        }
        output.type = self.name;
        return callback(null, output);
      });
    };

    self.route('post', 'modal', function(req, res) {
      return res.send(self.render(req, 'widgetEditor.html', { label: self.label, schema: self.schema }));
    });
  }
};
