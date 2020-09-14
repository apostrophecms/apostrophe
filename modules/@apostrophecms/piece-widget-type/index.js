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
        console.log(self.schema);
        const individually = widgets.filter(widget => widget.selection === 'individually');
        await _super(req, individually);
        const automatically = widgets.filter(widget => widget.selection === 'automatically');
        for (const widget of automatically) {
          // Don't let the base class waste time trying to load old individual
          // choices that may still be present
          widget.piecesIds = [];
        }
        await _super(req, automatically);
        for (const widget of automatically) {
          const filters = {};
          for (const name of Object.keys(self.filters)) {
            if (widget[name] != null) {
              filters[name] = widget[name];
            }
          }
          widgets._pieces = await self.pieceModule.find(req).addQueryBuilders(filters).limit(widget.shown).toArray();
        }
      }
    };
  }
};
