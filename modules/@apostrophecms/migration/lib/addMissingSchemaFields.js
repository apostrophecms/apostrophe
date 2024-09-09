const _ = require('lodash');

module.exports = (self) => {
  return {
    async addMissingSchemaFields() {
      const lastPropLists = await self.getLastPropLists();
      const propLists = self.getPropLists();
      let changesToPropLists = false;
      for (const name of Object.keys(propLists)) {
        if (!_.isEqual(lastPropLists?.[name], propLists[name])) {
          if (lastPropLists) {
            console.log(JSON.stringify({
              last: lastPropLists[name],
              next: propLists[name]
            }, null, '  '));
          }
          console.log('necessary for ' + name);
          changesToPropLists = true;
          await self.addMissingSchemaFieldsForDocType(name, propLists[name]);
        }
      }
      if (changesToPropLists) {
        console.log('** UPDATING');
        await self.updateLastPropLists(propLists);
      }
    },
    async addMissingSchemaFieldsForDocType(name) {
      const schema = (self.apos.doc.managers[name] || {}).schema;
      if (!schema) {
        return;
      }
      await self.eachDoc({
        type: name
      }, async doc => {
        const changes = {};
        await self.addMissingSchemaFieldsFor(doc, schema, '', changes);
        if (Object.keys(changes).length > 0) {
          console.log('patched', changes);
          return self.apos.doc.db.updateOne({
            _id: doc._id
          }, {
            $set: changes
          });
        }
      });
    },
    // Adds changes to the object "changes" so that a single
    // $set call can be made at the end. Use of a single
    // object passed by reference also avoids creating many
    // unnecessary objects in memory during a time-sensitive
    // operation
    addMissingSchemaFieldsFor(doc, schema, dotPath, changes) {
      for (const field of schema) {
        const newDotPath = dotPath ? `${dotPath}.${field.name}` : field.name;
        // Supply the default
        if (doc[field.name] === undefined) {
          // Only undefined should fall back here
          const def = (field.def === undefined) ? self.apos.schema.fieldTypes[field.type]?.def : field.def;
          if (def !== undefined) {
            changes[newDotPath] = def;
          }
        }
        // Address defaults of subproperties
        if (field.type === 'area') {
          const basePath = `${newDotPath}.items`;
          for (let i = 0; (i < (doc[field.name]?.items || []).length); i++) {
            const widgetPath = `${basePath}.${i}`;
            const widget = doc[field.name].items[i];
            const widgetSchema = self.apos.area.getWidgetManager(widget.type)?.schema;
            if (!widgetSchema) {
              continue;
            }
            self.addMissingSchemaFieldsFor(widget, widgetSchema, widgetPath, changes);
          }
        } else if (field.type === 'object') {
          self.addMissingSchemaFieldsFor(doc[field.name], field.schema, newDotPath, changes);
        } else if (field.type === 'array') {
          for (let i = 0; (i < doc[field.name].length); i++) {
            const itemPath = `${newDotPath}.${i}`;
            const item = doc[field.name][i];
            self.addMissingSchemaFieldsFor(item, field.schema, itemPath, changes);
          }
        } else if (field.type === 'relationship') {
          for (const [ key, item ] of Object.entries(doc[field.fieldsStorage] || {})) {
            const itemPath = `${newDotPath}.${field.fieldsStorage}.${key}`;
            self.addMissingSchemaFieldsFor(item, field.schema, itemPath, changes);
          }
        }
      }
      return changes;
    },
    getPropLists() {
      const schema = {};
      for (const [ name, module ] of Object.entries(self.apos.doc.managers)) {
        if (!module.__meta.name) {
          // Just a placeholder for a type present in the
          // database but not found in the project code
          continue;
        }
        schema[name] = [];
        self.expandPropList(module.schema, schema[name], '');
      }
      return schema;
    },
    expandPropList(schema, propList, dotPath) {
      for (const field of schema) {
        const newDotPath = dotPath ? `${dotPath}.${field.name}` : field.name;
        propList.push(newDotPath);
        if (field.schema) {
          self.expandPropList(field.schema, propList, newDotPath);
        }
      }
    },
    async getLastPropLists() {
      const result = await self.db.findOne({
        _id: '*lastPropLists'
      });
      return result?.propLists;
    },
    async updateLastPropLists(propLists) {
      return self.db.updateOne({
        _id: '*lastPropLists'
      }, {
        $set: {
          propLists
        }
      }, {
        upsert: true
      });
    }
  }
};
