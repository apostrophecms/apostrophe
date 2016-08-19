var _ = require('lodash');
var async = require('async');

module.exports = {

  afterConstruct: function(self) {

    if (!self.options.label) {
      throw new Error('You must specify the label option when subclassing apostrophe-widgets');
    }
    self.label = self.options.label;
    self.name = self.options.name || self.__meta.name.replace(/\-widgets$/, '');
    self.apos.areas.setWidgetManager(self.name, self);

    self.apos.push.browserMirrorCall('user', self);
    self.apos.push.browserMirrorCall('user', self, { tool: 'editor' });

   self.apos.tasks.add(self.__meta.name, 'list',
    'Run this task to list all widgets of this type in the project.\n' +
    'Useful for testing.\n',
    self.list);

    self.pushAssets();
    self.pushDefineSingleton();
  },

  construct: function(self, options) {

    self.template = options.template || 'widget';
    self.schema = self.apos.schemas.compose(options);

    // Outputs the widget. Invoked by
    // apos.widget in Nunjucks.

    self.output = function(widget, options) {
      var result = self.partial(self.template, { widget: widget, options: options, manager: self });
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
      return async.series([ join, area ], callback);
      function join(callback) {
        return self.apos.schemas.join(req, self.schema, widgets, undefined, callback);
      }
      function area(callback) {

        // If this is a virtual widget (a widget being edited or previewed in the
        // editor), any nested areas, etc. inside it haven't already been loaded as
        // part of loading a doc. Do that now by creating a cursor and then feeding
        // it our widgets as if they were docs.

        if (!(widgets.length && widgets[0]._virtual)) {
          return setImmediate(callback);
        }

        // Get a doc cursor so that we can interpose the widgets as our docs and have the
        // normal things happen after the docs have been "loaded," such as calling loaders
        // of widgets in areas. -Tom and Matt

        // Shut off joins because we already did them and the cursor would try to do them
        // again based on `type`, which isn't really a doc type. -Tom
        var cursor = self.apos.docs.find(req).joins(false);

        // Call .after with our own results
        return cursor.after(widgets, callback);
      }
    };

    self.sanitize = function(req, input, callback) {
      var output = {};
      output._id = self.apos.launder.id(input._id);
      return self.apos.schemas.convert(req, self.schema, 'form', input, output, function(err) {
        if (err) {
          return callback(err);
        }
        output.type = self.name;
        return callback(null, output);
      });
    };

    // Remove all properties of a widget that are the results of joins
    // or otherwise dynamic (_) for use in stuffing the
    // "data" attribute of the widget. If we don't do a
    // good job here we get 1MB+ of markup! So if you override
    // this, play nice! - Tom and Sam

    self.filterForDataAttribute = function(widget) {
      return self.apos.utils.clonePermanent(widget);
    };

    // Filter options passed from template to widget before stuffing
    // them into JSON for use by the widget editor. If we don't do a
    // good job here we get 1MB+ of markup! So if you override
    // this, play nice! - Tom and Sam

    self.filterOptionsForDataAttribute = function(options) {
      return self.apos.utils.clonePermanent(options);
    };

    self.pushAssets = function() {
      self.pushAsset('script', 'always', { when: 'always' });
      self.pushAsset('script', 'user', { when: 'user' });
      self.pushAsset('script', 'editor', { when: 'user' });
    };

    self.pushDefineSingleton = function() {
      self.apos.push.browserMirrorCall('always', self, { stop: 'apostrophe-widgets' });
    };

    self.pageBeforeSend = function(req) {
      self.pushCreateSingleton(req, 'always');
    };

    self.getCreateSingletonOptions = function(req) {
      return _.defaults(options.browser || {}, {
          name: self.name,
          label: self.label,
          action: self.action,
          schema: self.schema,
          contextualOnly: self.options.contextualOnly
        }
      );
    };

    self.list = function(apos, argv, callback) {

      return self.apos.migrations.eachWidget({}, iterator, callback);

      function iterator(doc, widget, dotPath, callback) {
        if (widget.type === self.name) {
          console.log(doc.slug + ':' + dotPath);
        }
        return setImmediate(callback);
      }

    };

    self.route('post', 'modal', function(req, res) {
      // Make sure the chooser will be allowed to edit this schema
      self.apos.schemas.bless(req, self.schema);
      return res.send(self.render(req, 'widgetEditor.html', { label: self.label, schema: self.schema }));
    });
  }
};
