// The base class for all modules that implement a widget, such as
// [@apostrophecms/rich-text-widget](../@apostrophecms/rich-text-widget/index.html) and
// [@apostrophecms/video-widget](../@apostrophecms/video-widget/index.html).
//
// All widgets have a [schema](../../tutorials/getting-started/schema-guide.html).
// Many project-specific modules that extend this module consist entirely of `fields` configuration and a `views/widget.html` file.
//
// For more information see the [custom widgets tutorial](../../tutorials/getting-started/custom-widget.html).
//
// ## Options
//
// ### `label`
//
// The label of the widget, as seen in menus for adding widgets.
//
// ### `name`
//
// The unique name of this type of widget, as seen in the `type` property in the database.
// It will be singular if it displays one thing, like `@apostrophecms/video`,
// and plural if it displays more than one thing, like `@apostrophecms/piece-type`.
// **By default, Apostrophe automatically removes `-widget` from the name
// of your module to set this option for you.** This is a good convention
// but you may set this option instead if you wish.
//
// ### `playerData`
//
// By default, all of the permanent properties of your widget's schema
// are present in the page as JSON and can be accessed via the
// `data` argument of the `play` method of your browser-side object
// (see `always.js` in `@apostrophecms/image-widget` for an example).
//
// This is often useful, but if the information is sensitive and you
// don't want it to be available in this way, set:
//
// `playerData: false`
//
// If you want the `play` method to have access to *some* of the
// properties, set:
//
// `playerData: [ 'propName1', 'propName2' ]`
//
// **When you have editing privileges, you always have access to
// 100% of the permanent properties of the widget in this way.**
// This is needed for the editing experience.
//
// ### `neverLoadSelf`
//
// If true, this widget's `load` method will never recursively invoke
// itself for the same widget type. This option defaults to `true`.
// If you set it to `false`, be aware that you are responsible
// for ensuring that the situation does not lead to an infinite loop.
//
// ### `neverLoad`
//
// If set to an array of widget type names, the load methods of the
// specified widget types will never be recursively invoked by this module's
// `load` method. By default this option is empty. See also `neverLoadSelf`,
// which defaults to `true`, resolving most performance problems.
//
// ### `scene`
//
// If your widget wishes to use Apostrophe features like schemas
// when interacting with *logged-out* users — for instance, to implement
// forms conveniently — you can set the `scene` option to `user`. Any
// page that contains the widget will then load the full javascript and stylesheet
// assets normally reserved for logged-in users. Note that if a page
// relies on AJAX calls to load more content later, the assets will not be
// upgraded. So you may wish to set the `scene` option of the appropriate
// subclass of `@apostrophecms/page-type` or `@apostrophecms/piece-page-type`, as well.
//
// ### `defer`
//
// If you set `defer: true` for a widget module, like @apostrophecms/image-widget, the relationship to
// actually fetch the images is deferred until the last possible minute, right before the
// template is rendered. This can eliminate some queries and speed up your site when there
// are many separate relationships happening on a page that ultimately result in loading images.
//
// If you wish this technique to also be applied to images loaded by content on the global doc,
// you can also set `deferWidgetLoading: true` for the `@apostrophecms/global` module. To avoid chicken
// and egg problems, there is still a separate query for all the images from the global doc and all
// the images from everything else, but you won't get more than one of each type.
//
// Setting `defer` to `true` may help performance for any frequently used widget type
// that depends on relationships and has a `load` method that can efficiently handle multiple widgets.
//
// If you need access to the results of the relationship in server-side JavaScript code, outside of page
// templates, do not use this feature. Since it defers the relationships to the last minute,
// that information will not be available yet in any asynchronous node.js code.
// It is the last thing to happen before the actual page template rendering.
//
// ## Fields
//
// You will need to configure the schema fields for your widget using
// the `fields` section.
//
// The standard options for building [schemas](../../tutorials/getting-started/schema-guide.html)
// are accepted. The widget will present a modal dialog box allowing the user to edit
// these fields. They are then available inside `widget.html` as properties of
// `data.widget`.
//
// ## Important templates
//
// You will need to supply a `views/widget.html` template for your module that
// extends this module.
//
// In `views/widget.html`, you can access any schema field as a property
// of `data.widget`. You can also access options passed to the widget as
// `data.options`.
//
// ## More
//
// If your widget requires JavaScript on the browser side, you will want
// to write a player function. TODO: document this 3.x style (lean).
//
// ## Command line tasks
//
// ```
// node app your-widget-module-name-here:list
// ```
// Lists all of the places where this widget is used on the site. This is very useful if
// you are debugging a change and need to test all of the different ways a widget has
// been used, or are wondering if you can safely remove one.

const _ = require('lodash');

module.exports = {
  cascades: [ 'fields' ],
  options: {
    playerData: false,
    neverLoadSelf: true
  },
  init(self, options) {

    self.enableBrowserData();

    self.template = options.template || 'widget';

    if (!self.options.label) {
      throw new Error('You must specify the label option when subclassing @apostrophecms/widget-type in ' + self.__meta.name);
    }

    self.label = self.options.label;
    self.name = self.options.name || self.__meta.name.replace(/-widget$/, '');

    self.composeSchema();

    self.apos.area.setWidgetManager(self.name, self);

    // To avoid infinite loops and/or bad performance, the load method of
    // this widget type will never invoke itself recursively unless
    // the `loadSelf` option of the module is explicitly set to `true`.
    // In addition the `neverLoad` option can be set to provide additional
    // widget types that are not to be loaded in a nested way beneath this one

    self.neverLoad = [ ...self.options.neverLoad || [] ];
    if (self.options.neverLoadSelf) {
      self.neverLoad.push(self.name);
      self.neverLoad = [ ...new Set(self.neverLoad) ];
    }
  },
  methods(self, options) {
    return {
      composeSchema() {
        self.schema = self.apos.schema.compose({
          addFields: self.apos.schema.fieldsToArray(`Module ${self.__meta.name}`, self.fields),
          arrangeFields: self.apos.schema.groupsToArray(self.fieldsGroups)
        });
        const forbiddenFields = [
          '_id',
          'type'
        ];
        _.each(self.schema, function (field) {
          if (_.includes(forbiddenFields, field.name)) {
            throw new Error('Widget type ' + self.name + ': the field name ' + field.name + ' is forbidden');
          }
        });
      },

      // Returns markup for the widget. Invoked via `{% widget ... %}` in the
      // `@apostrophecms/area` module as it iterates over widgets in
      // an area. The default behavior is to render the template for the widget,
      // which is by default called `widget.html`, passing it `data.widget`
      // and `data.options`. The module is accessible as `data.manager`.
      //
      // async, as are all functions that invoke a nunjucks render in
      // Apostrophe 3.x.

      async output(req, widget, options) {
        return self.render(req, self.template, {
          widget: widget,
          options: options,
          manager: self
        });
      },

      // Load relationships and carry out any other necessary async
      // actions for our type of widget, as long as it is
      // not forbidden due to the `neverLoad` option or the
      // `neverLoadSelf` option (which defaults to `true`).
      //
      // Also implements the `scene` convenience option
      // for upgrading assets delivered to the browser
      // to the full set of `user` assets (TODO: are we
      // removing this in A3?)
      //
      // If you are looking to add custom loader behavior for
      // your widget type, don't extend this method, extend
      // the `load` method which just does the loading work.
      // `loadIfSuitable` is responsible for invoking that method
      // only after checking for recursion issues. Those guards
      // should apply to your code too.

      async loadIfSuitable(req, widgets) {
        if (self.options.scene) {
          req.scene = self.options.scene;
        }
        if (req.aposNeverLoad[self.name]) {
          return;
        }
        const pushing = self.neverLoad.filter(type => !req.aposNeverLoad[type]);
        for (const type of pushing) {
          req.aposNeverLoad[type] = true;
        }
        await self.apos.util.recursionGuard(req, `widget:${self.name}`, async () => {
          return self.load(req, widgets);
        });
        for (const type of pushing) {
          // Faster than the delete keyword
          req.aposNeverLoad[type] = false;
        }
      },

      // Perform relationships and any other necessary async
      // actions for our type of widget.
      //
      // Override this to perform custom actions not
      // specified by your schema, talk to APIs, etc. when a widget
      // is present.
      //
      // Note that an array of widgets is handled in a single call
      // as you can sometimes optimize for that case.
      // Do not assume there is only one. If you can't optimize it,
      // that's OK, just loop over them and handle every one.

      async load(req, widgets) {
        await self.apos.schema.relate(req, self.schema, widgets, undefined);
        // If this is a virtual widget (a widget being edited or previewed in the
        // editor), any nested areas, etc. inside it haven't already been loaded as
        // part of loading a doc. Do that now by creating a query and then feeding
        // it our widgets as if they were docs.

        if (!(widgets.length && widgets[0]._virtual)) {
          return;
        }

        // Get a doc query so that we can interpose the widgets as our docs and have the
        // normal things happen after the docs have been "loaded," such as calling loaders
        // of widgets in areas.

        // Shut off relationships because we already did them and the query would try to do them
        // again based on `type`, which isn't really a doc type.
        const query = self.apos.doc.find(req).relationships(false);
        // Call .after with our own results
        await query.after(widgets);
      },

      // Sanitize the widget. Invoked when the user has edited a widget on the
      // browser side. By default, the `input` object is sanitized via the
      // `convert` method of `@apostrophecms/schema`, creating a new `output` object
      // so that no information in `input` is blindly trusted.
      //
      // `options` will receive the widget-level options passed in
      // this area, including any `defaultOptions` for the widget type.
      //
      // Returns a new, sanitized widget object.

      async sanitize(req, input, options) {
        if (!input || typeof input !== 'object') {
          // Do not crash
          input = {};
        }
        // Make sure we get default values for contextual fields so
        // `by` doesn't go missing for `@apostrophecms/image-widget`
        const output = self.apos.schema.newInstance(self.schema);
        const schema = self.allowedSchema(req);
        output._id = self.apos.launder.id(input._id) || self.apos.util.generateId();
        await self.apos.schema.convert(req, schema, input, output);
        output.metaType = 'widget';
        output.type = self.name;
        return output;
      },

      // Return a new schema containing only fields for which the
      // current user has the permission specified by the `permission`
      // property of the schema field, or there is no `permission` property for the field.

      allowedSchema(req) {
        return _.filter(self.schema, function (field) {
          return !field.permission || self.apos.permission.can(req, field.permission.action, field.permission.type);
        });
      },

      addSearchTexts(widget, texts) {
        self.apos.schema.indexFields(self.schema, widget, texts);
      },

      // Return true if this widget should be considered
      // empty, for instance it is a rich text widget
      // with no text or meaningful formatting so far.
      // By default this method returns false, so the
      // presence of any widget of this type means
      // the area containing it is not considered empty.

      isEmpty(widget) {
        return false;
      },

      // override to add CSS classes to the outer wrapper div of the widget.
      getWidgetWrapperClasses(widget) {
        return [];
      },

      // Override to add CSS classes to the div of the widget itself.
      getWidgetClasses(widget) {
        return [];
      }
    };
  },
  extendMethods(self, options) {
    return {
      // Set the options to be passed to the browser-side singleton corresponding
      // to this module. By default they do not depend on `req`, but the availability
      // of that parameter allows subclasses to make distinctions based on permissions,
      // etc.
      //
      // If a `browser` option was configured for the module its properties take precedence
      // over the default values passed on here for `name`, `label`, `action`
      // (the base URL of the module), `schema` and `contextualOnly`.

      getBrowserData(_super, req) {
        const result = _super(req);
        const schema = self.allowedSchema(req);
        _.defaults(result, {
          name: self.name,
          label: self.label,
          action: self.action,
          schema: schema,
          contextual: self.options.contextual,
          skipInitialModal: self.options.skipInitialModal,
          className: self.options.className
        });
        return result;
      }
    };
  },

  tasks(self, options) {
    return {
      list: {
        usage: 'Run this task to list all widgets of this type in the project.\nUseful for testing.',
        async task(argv) {
          return self.apos.migration.eachWidget({}, iterator);
          async function iterator(doc, widget, dotPath) {
            if (widget.type === self.name) {
              // console.log is actually appropriate for once
              // because the purpose of this task is to
              // write something to stdout. Should
              // not become an apos.util.log call. -Tom
              // eslint-disable-next-line no-console
              console.log(doc.slug + ':' + dotPath);
            }
          }
        }
      }
    };
  }
};
