const _ = require('lodash');

module.exports = self => {
  return {
    'apostrophe:modulesRegistered': {
      async addMissingPieces() {
        return self.apos.lock.withLock('i18n-static-missing-pieces-lock', async () => {
          let modified = false;

          const i18nextNamespaces = Object.keys(self.apos.i18n.namespaces)
            .filter(ns => !self.options.excludeNamespaces.includes(ns));

          const plurals = {
            plural: 'valuePlural',
            zero: 'valueZero',
            two: 'valuePluralTwo',
            few: 'valuePluralFew',
            many: 'valuePluralMany'
          };

          for (const locale of self.apos.i18n.i18next.options.languages) {
            const req = self.apos.task.getReq({
              locale,
              mode: 'draft',
              aposStartup: true
            });
            const i18nextResources = i18nextNamespaces.reduce((acc, cur) => {
              const resources = self.apos.i18n.i18next.getResourceBundle(locale, cur);
              return {
                ...acc,
                ...(resources && { [cur]: resources })
              };
            },
            {});

            let cachedI18nStaticResources = await self.apos.cache.get(locale, 'i18n-static');
            if (!cachedI18nStaticResources) {
              cachedI18nStaticResources = await self.findPiecesAndGroupByNamespace(`${locale}:draft`);
              await self.apos.cache.set(req.locale, 'i18n-static', cachedI18nStaticResources);
            }
            const i18nStaticResources = cachedI18nStaticResources.reduce((acc, cur) => {
              const ns = cur._id;
              const resources = self.formatPieces(cur.pieces);
              acc[ns] = resources;
              return acc;
            }, {});

            const i18nextResourcesKeys = Object.entries(i18nextResources)
              .map(([ namespace, resources ]) => Object.keys(resources).map(key => `${namespace}.${key}`))
              .flat()
              .sort();
            const i18nStaticResourcesKeys = Object.entries(i18nStaticResources)
              .map(([ namespace, resources ]) => Object.keys(resources).map(key => `${namespace}.${key}`))
              .flat()
              .sort();

            // We only have to rebuild if keys existing in the JSON files do not exist as pieces
            if (_.difference(i18nextResourcesKeys, i18nStaticResourcesKeys).length > 0) {
              modified = true;

              for (const [ namespace, resources ] of Object.entries(i18nextResources)) {
                for (const [ key, value ] of Object.entries(resources || {})) {
                  const [ title, pluralType ] = key.split('_');
                  const valueToCheck = plurals[pluralType] || 'valueSingular';
                  const props = {
                    title,
                    namespace
                  };

                  const existingPiece = await self.find(req, props).toObject();

                  if (!existingPiece) {
                    // eslint-disable-next-line no-console
                    console.log(`Add missing piece ${title} in i18n-static module for locale ${locale}...`);
                    await self.insert(req, {
                      ...props,
                      [valueToCheck]: value
                    });
                  } else if (!existingPiece[valueToCheck]) {
                    // eslint-disable-next-line no-console
                    console.log(`Updating missing prop for piece ${title} in i18n-static module for locale ${locale}...`);
                    const newPiece = {
                      ...existingPiece,
                      [valueToCheck]: value
                    };
                    await self.update(req, newPiece);
                  }
                }
              }

              self.generateNewGlobalIdAndUpdateCache(req);
            }
          }

          return modified;
        });
      }

    },

    afterSave: {
      async handleSave(req, piece) {
        if (!req.aposStartup) {
          return self.apos.lock.withLock('i18n-static-after-save-lock', async () => {
            const i18nFields = self.schema.filter(field => field.i18nValue);

            for (const field of i18nFields) {
              if (piece[field.name]) {
                const updatedValue = piece[field.name];
                self.apos.i18n.i18next.addResource(req.locale, piece.namespace, piece.title, updatedValue);
                break;
              }
            }

            return self.generateNewGlobalIdAndUpdateCache(req);
          });
        }
      }
    }
  };
};
