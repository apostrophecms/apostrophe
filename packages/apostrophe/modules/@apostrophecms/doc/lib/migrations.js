module.exports = (self) => {
  return {
    addMigrations() {
      self.addCacheFieldMigration();
      self.addSetPreviousDocsAposModeMigration();
      self.addSetDocumentModesMigration();
      self.addFieldIdsMigration();
    },

    addCacheFieldMigration() {
      self.apos.migration.add('add-cache-invalidated-at-field', self.setCacheField);
    },

    async addSetPreviousDocsAposModeMigration () {
      self.apos.migration.add('set-previous-docs-apos-mode', async () => {
        await self.apos.doc.db.updateMany({
          _id: { $regex: ':previous$' },
          aposMode: { $ne: 'previous' }
        }, {
          $set: {
            aposMode: 'previous'
          }
        });
      });
    },

    addSetDocumentModesMigration() {
      self.apos.migration.add('set-document-modes', async () => {
        return self.apos.migration.eachDoc({}, 5, async (doc) => {
          const manager = self.getManager(doc.type);
          if (!manager?.isLocalized()) {
            return;
          }
          const idMode = doc._id.split(':').pop(); ;
          const [ locale, localeMode ] = doc.aposLocale.split(':');
          const aposMode = doc.aposMode;

          if (idMode !== localeMode || idMode !== aposMode) {
            await self.apos.doc.db.updateOne({ _id: doc._id }, {
              $set: {
                aposLocale: `${locale}:${idMode}`,
                aposMode: idMode
              }
            });
          }
        });
      });
    },

    // Array items and objects stored before arrayFieldId and objectFieldId
    // existed have only a flat scoped name, which is ambiguous when a nested
    // array or object shares the name of its parent. Add the field ids. Only
    // new properties are set, so processes still running older code during a
    // deployment are unaffected
    addFieldIdsMigration() {
      self.apos.migration.add('add-array-and-object-field-ids', () => {
        return self.apos.migration.eachDoc({}, 5, self.addFieldIdsToDoc);
      });
    },

    // Implementation detail of the add-array-and-object-field-ids migration.
    // The update addresses array items and widgets by index, so it applies
    // only if each of them is still where `doc` says it is. If not, the doc
    // changed since it was read, so read it again and retry
    async addFieldIdsToDoc(doc) {
      const { _id } = doc;
      try {
        for (let attempt = 0; doc && (attempt < 5); attempt++) {
          const { $set, criteria } = self.getFieldIdsUpdate(doc);
          if (!Object.keys($set).length) {
            return;
          }
          const { matchedCount } = await self.db.updateOne({
            ...criteria,
            _id
          }, { $set });
          if (matchedCount) {
            return;
          }
          doc = await self.db.findOne({ _id });
        }
      } catch (e) {
        // Unexpected content the update can't be applied to. The doc goes on
        // working by its flat scoped names as before, so don't hold up the
        // other migrations over it
        self.logWarn('add-field-ids-failed', `Could not add field ids to ${_id}`, {
          docId: _id,
          error: e.message
        });
      }
    },

    // Add arrayFieldId and objectFieldId wherever they are missing from
    // `doc`, which is modified in place. For copies of docs stored
    // elsewhere, such as document versions. Returns true if anything changed
    addFieldIds(doc) {
      const { $set } = self.getFieldIdsUpdate(doc);
      for (const [ path, value ] of Object.entries($set)) {
        self.apos.util.set(doc, path, value);
      }
      return Object.keys($set).length > 0;
    },

    // Returns `{ $set, criteria }`. `$set` adds the missing arrayFieldId and
    // objectFieldId properties of `doc` by dot path. `criteria` matches only
    // if every array item and widget addressed by index is still at that
    // index. Array items and widgets with no _id can't be checked that way
    // and are skipped, along with everything inside them
    getFieldIdsUpdate(doc) {
      const $set = {};
      const criteria = {};
      const manager = self.getManager(doc.type);
      if (manager) {
        forSchema(manager.schema, doc, '');
      }
      return {
        $set,
        criteria
      };

      function forSchema(schema, object, path) {
        for (const field of schema) {
          const value = object[field.name];
          const fieldPath = `${path}${field.name}`;
          if (field.type === 'area') {
            (Array.isArray(value?.items) ? value.items : []).forEach((widget, i) => {
              const widgetManager = self.apos.area.getWidgetManager(widget?.type);
              if (widgetManager && forItem(widget, `${fieldPath}.items.${i}`)) {
                forSchema(widgetManager.schema, widget, `${fieldPath}.items.${i}.`);
              }
            });
          } else if (field.type === 'array') {
            (Array.isArray(value) ? value : []).forEach((item, i) => {
              const itemPath = `${fieldPath}.${i}`;
              if (forItem(item, itemPath)) {
                if (item.arrayFieldId !== field._id) {
                  $set[`${itemPath}.arrayFieldId`] = field._id;
                }
                forSchema(field.schema, item, `${itemPath}.`);
              }
            });
          } else if (field.type === 'object') {
            if (value && ((typeof value) === 'object') && !Array.isArray(value)) {
              if (value.objectFieldId !== field._id) {
                $set[`${fieldPath}.objectFieldId`] = field._id;
              }
              forSchema(field.schema, value, `${fieldPath}.`);
            }
          }
        }
      }

      function forItem(item, itemPath) {
        if (((typeof item) !== 'object') || !item?._id) {
          return false;
        }
        criteria[`${itemPath}._id`] = item._id;
        return true;
      }
    },

    // Add the "cacheInvalidatedAt" field to the documents that do not have it
    // yet, and set it to equal doc.updatedAt.
    setCacheField() {
      return self.apos.migration.eachDoc(
        { cacheInvalidatedAt: { $exists: 0 } },
        5,
        async doc => {
          await self.apos.doc.db.updateOne({ _id: doc._id }, {
            $set: { cacheInvalidatedAt: doc.updatedAt }
          });
        }
      );
    }
  };
};
