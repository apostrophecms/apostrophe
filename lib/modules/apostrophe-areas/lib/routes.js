var async = require('async');

module.exports = function(self, options) {
  const launder = self.apos.launder;

  self.apiRoute('post', 'save-area', async function(req) {
    try {
      return self.lockSanitizeAndSaveArea(req, req.body);
    } catch (e) {
      if (Array.isArray(e)) {
        throw self.apos.http.error('unprocessable', e);
      }
    }
  });  

  // Similar to `save-area`. This route expects
  // an object with an `areas` property, and that
  // property is an array of requests in the format
  // expected by the `save-area` route. In addition to
  // saving all of the posted areas, this route
  // releases any locks held by `req.htmlPageId`.
  // property. These functions are combined for
  // best performance during performance-critical
  // `beforeunload` events.

  self.apiRoute('post', 'save-areas-and-unlock', async function(req) {
    const areas = req.body.areas;
    if (!Array.isArray(areas)) {
      throw 'invalid';
    }
    await lockSanitizeAndSaveAreas();
    await unlockAll();

    async function lockSanitizeAndSaveAreas() {
      for (let areaInfo of areas) {
        try {
          await self.lockSanitizeAndSaveArea(req, areaInfo);
        } catch (err) {
          // An error here is nonfatal because we want to give
          // other areas a chance to save if, for instance, another
          // user stole a lock on just one of them
          if (err) {
            self.apos.utils.error(err);
          }
        }
      }
    }

    async function unlockAll() {
      return self.apos.docs.unlockAll(req, req.htmlPageId);
    }
  });

  // Render an editor for a virtual area with the content
  // specified as an array of items by the req.body.content
  // property, if any. The area will not attempt to save itself periodically.
  //
  // Used to implement editing of areas within schemas.

  self.apiRoute('post', 'edit-virtual-area', async function(req) {
    const items = req.body.items || [];
    const options = req.body.options || {};
    const area = {
      type: 'area',
      _docId: 'v' + self.apos.utils.generateId(),
      _edit: true
    };
    // virtual option prevents attributes used to
    // save content from being output
    options.virtual = true;
    options.area = area;
    area.items = [];

    for (let item of items) {
      const manager = self.getWidgetManager(item.type);
      if (!manager) {
        self.warnMissingWidgetType(item.type);
        throw 'invalid';
      }
      const widgetsOptions = options.widgets || {};
      const widgetOptions = widgetsOptions[item.type] || {};
      if (!self.apos.utils.isBlessed(req, widgetOptions, 'widget', item.type)) {
        throw self.blessedError(item, widgetOptions);
      }
      req.tolerantSanitization = true;
      const widget = await manager.sanitize(req, item);
      widget._edit = true;
      area.items.push(widget);
      if (!manager.load) {
        continue;
      }
      // Hint to call nested widget loaders as if it were a doc
      widget._virtual = true;
      await manager.load(req, [ widget ]);
    }
    return await self.render(req, 'virtualArea', { options: options });
  });

  // Render a view of the widget specified by req.body.data (which contains its
  // properties) and req.body.options (treated as if they were passed to it via
  // aposSingleton). req.body.type specifies the widget type.

  self.apiRoute('post', 'render-widget', async function(req) {
    const originalData = (typeof (req.body.originalData) === 'object') ? req.body.originalData : {};
    let widget = (typeof (req.body.widget) === 'object') ? req.body.widget : {};
    const options = (typeof (req.body.options) === 'object') ? req.body.options : {};
    const type = launder.string(req.body.type);
    const docId = launder.string(req.body.docId);
    if (!(widget && options && type)) {
      throw 'invalid';
    }
    const manager = self.getWidgetManager(type);
    if (!manager) {
      self.warnMissingWidgetType(type);
      throw 'invalid';
    }
    if (!self.apos.utils.isBlessed(req, options, 'widget', type)) {
      throw self.blessedError(item, options);
    }

    widget = await sanitize(widget);
    widget._edit = true;
    self.restoreDisallowedFields(req, widget, originalData);
    await load();
    return await render();

    async function sanitize(widget) {
      return await manager.sanitize(req, widget);
    }

    async function load() {
      // Hint to call nested widget loaders as if it were a doc
      widget._virtual = true;
      await manager.load(req, [ widget ]);
    }

    async function render() {
      return self.renderWidget(req, type, widget, options);
    }

  });

};
