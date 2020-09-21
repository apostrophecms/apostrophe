const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/widget-type',
  cascades: [ 'filters' ],
  fields: {
    add: {
      selection: {
        label: 'Selection',
        type: 'select',
        required: true,
        choices: [
          {
            label: 'Select Individually',
            value: 'individually',
            showFields: [ '_pieces' ]
          },
          {
            label: 'Show Most Recent',
            value: 'automatically',
            showFields: [ 'shown' ]
          }
        ]
      },
      _pieces: {
        label: 'Your Choices',
        type: 'relationship'
      },
      shown: {
        label: 'Number Shown',
        type: 'integer',
        required: true,
        def: 5
      }
    }
  },
  extendMethods(self, options) {
    return {
      composeSchema(_super) {
        console.log('** extending composeSchema');
        self.pieceModuleName = self.options.pieceModuleName || self.__meta.name.replace(/-widget$/, '');
        self.pieceModule = self.apos.modules[self.pieceModuleName];
        const filterNames = Object.keys(self.filters);
        for (const name of filterNames) {
          const field = self.pieceModule.schema.find(field => field.name === name);
          console.log(field);
          self.fields[name] = _.cloneDeep(field);
          Object.assign(self.fields[name], self.filters[name]);
          console.log(self.fields[name]);
        }
        const showFields = self.fields.selection.choices.find(choice => choice.value === 'automatically').showFields;
        for (const key of Object.keys(self.filters)) {
          showFields.push(key);
        }
        self.fields._pieces.withType = self.pieceModule.name;
        return _super();
      },
      async load(_super, req, widgets) {
        console.log('** in load');
        console.log('widgets:', widgets);
        const individually = widgets.filter(widget => widget.selection === 'individually');
        for (const widget of individually) {
          // Don't let the base class waste time trying to load relationships
          // in filter fields that are not in play
          for (const name of Object.keys(self.filters)) {
            delete widget[name];
          }
        }
        await _super(req, individually);
        const automatically = widgets.filter(widget => widget.selection === 'automatically');
        console.log('I:', individually, 'A:', automatically);
        for (const widget of automatically) {
          // Don't let the base class waste time trying to load old individual
          // choices that are not in play
          widget.piecesIds = [];
        }
        // In case there is other functionality added to the base class
        // beyond the normal loading by piecesIds
        await _super(req, automatically);

        for (const widget of automatically) {
          const filters = {};
          console.log('FETCHING:', widget);
          for (const name of Object.keys(self.filters)) {
            console.log(`considering ${name}`);
            if (widget[name] != null) {
              // Relationship filters want just the _id, if we
              // have docs map to the _id
              if (_.get(widget[name], '[0]._id')) {
                filters[name] = widget[name].map(value => value._id);
              } else {
                filters[name] = widget[name];
              }
            }
          }
          console.log('FILTERS:', filters);
          widget._pieces = await self.pieceModule.find(req).applyBuilders(filters).limit(widget.shown).toArray();
          console.log('PIECES:', widget._pieces);
        }
      }
    };
  }
};
