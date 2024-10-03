const _ = require('lodash');
const { klona } = require('klona');

module.exports = (self) => {
  return {
    async addMissingSchemaFields() {
      let scans = 0; let updates = 0;
      const lastPropLists = await self.getLastPropLists();
      const propLists = self.getPropLists();
      let changesToPropLists = false;
      for (const name of Object.keys(propLists)) {
        if (!_.isEqual(lastPropLists?.[name], propLists[name])) {
          changesToPropLists = true;
          scans++;
          updates += await self.addMissingSchemaFieldsForDocType(name);
        }
      }
      if (changesToPropLists) {
        await self.updateLastPropLists(propLists);
      }
      // Returned for tests
      return {
        scans,
        updates
      };
    },
    async addMissingSchemaFieldsForDocType(name) {
      let updates = 0;
      const schema = (self.apos.doc.managers[name] || {}).schema;
      if (!schema) {
        return;
      }
      await self.eachDoc({
        type: name
      }, async doc => {
        const changes = {};
        await self.addMissingSchemaFieldsFor(doc, schema, '', changes);
        if (doc.type === '@apostrophecms/user') {
          // In an abundance of caution we should leave permissions-related
          // properties alone. The role will only be missing if transitioning
          // from advanced permissions back to regular and there is a right
          // way to do that (via a task) so we should not interfere. There
          // should be no default for the password, but don't chance it;
          // also leave advanced permission group data alone just for good measure
          delete changes.password;
          delete changes.role;
          delete changes.groupsIds;
          delete changes.groupsFields;
        }
        if (Object.keys(changes).length > 0) {
          updates++;
          const seen = new Set();
          const keep = {};
          for (const key of Object.keys(changes)) {
            // MongoDB won't tolerate $set for both
            // a parent key and a subkey, which makes sense
            // because we set the entire value for the
            // parent key anyway. Filter out subkeys
            // when the parent key is also being set
            const components = key.split('.');
            let path = '';
            let preempted = false;
            for (const component of components) {
              path = path ? `${path}.${component}` : component;
              if (seen.has(path)) {
                preempted = true;
                break;
              }
            }
            if (preempted) {
              continue;
            }
            keep[key] = changes[key];
            seen.add(key);
          }
          return self.apos.doc.db.updateOne({
            _id: doc._id
          }, {
            $set: keep
          });
        }
      });
      return updates;
    },
    // Adds changes to the object "changes" so that a single
    // $set call can be made at the end. Use of a single
    // object passed by reference also avoids creating many
    // unnecessary objects in memory during a time-sensitive
    // operation
    addMissingSchemaFieldsFor(doc, schema, dotPath, changes) {
      for (const field of schema) {
        const newDotPath = dotPath ? `${dotPath}.${field.name}` : field.name;
        // Supply the default if a field is undefined, and also in the
        // edge case where due to a past bug an object field was falsy
        if ((doc[field.name] === undefined) ||
          ((field.type === 'object') && !doc[field.name])) {
          // Only undefined should fall back here
          const def = klona((field.def === undefined) ? self.apos.schema.fieldTypes[field.type]?.def : field.def);
          if (def !== undefined) {
            if (!Object.hasOwn(changes, dotPath)) {
              changes[newDotPath] = def;
            }
            // Also change it in memory so that if this is a subproperty of a
            // new object, the change for that new object will have this
            // subproperty too, plus we don't get crashes above when testing the
            // subproperties' current values
            doc[field.name] = def;
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
          for (let i = 0; (i < (doc[field.name] || []).length); i++) {
            const itemPath = `${newDotPath}.${i}`;
            const item = doc[field.name][i];
            self.addMissingSchemaFieldsFor(item, field.schema, itemPath, changes);
          }
        } else if (field.type === 'relationship') {
          for (const [ key, item ] of Object.entries(doc[field.fieldsStorage] || {})) {
            // Careful, newDotPath contains the relationship name, we are storing
            // in the fieldsStorage property for this relationship
            const storageDotPath = dotPath ? `${dotPath}.${field.fieldsStorage}` : field.fieldsStorage;
            const itemPath = `${storageDotPath}.${key}`;
            self.addMissingSchemaFieldsFor(item, field.schema, itemPath, changes);
          }
        }
      }
      return changes;
    },
    getPropLists() {
      const schema = {};
      for (const [ name, module ] of Object.entries(self.apos.doc.managers)) {
        if (!module.__meta?.name) {
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
  };
};
