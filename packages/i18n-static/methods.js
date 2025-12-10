module.exports = self => {
  return {
    getNamespaces() {
      return (
        Object.keys(self.apos.i18n.namespaces)
          .filter(ns => !self.options.excludeNamespaces.includes(ns))
          .map(ns => ({
            label: ns,
            value: ns
          })) || [ {
          label: 'default',
          value: 'default'
        } ]
      );
    },

    formatPieces(pieces) {
      return pieces.reduce(
        (acc, cur) => ({
          ...acc,
          [`${cur.title}`]: cur.valueSingular,
          ...(cur.valuePlural && { [`${cur.title}_plural`]: cur.valuePlural }),
          ...(cur.valueZero && { [`${cur.title}_zero`]: cur.valueZero }),
          ...(cur.valuePluralTwo && { [`${cur.title}_two`]: cur.valuePluralTwo }),
          ...(cur.valuePluralFew && { [`${cur.title}_few`]: cur.valuePluralFew }),
          ...(cur.valuePluralMany && { [`${cur.title}_many`]: cur.valuePluralMany })
        }),
        {}
      );
    },

    async findPiecesAndGroupByNamespace(aposLocale) {
      const pipeline = [
        {
          $match: {
            aposLocale,
            type: '@apostrophecms/i18n-static'
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            namespace: 1,
            valueZero: 1,
            valuePlural: 1,
            valueSingular: 1,
            valuePluralTwo: 1,
            valuePluralFew: 1,
            valuePluralMany: 1
          }
        },
        {
          $group: {
            _id: '$namespace',
            pieces: {
              $push: '$$ROOT'
            }
          }
        }
      ];

      return self.apos.doc.db.aggregate(pipeline).toArray();
    },

    async generateNewGlobalIdAndUpdateCache(req) {
      const aposLocale = `${req.locale}:${req.mode}`;
      const i18nStaticPiecesByNamespace = await self.findPiecesAndGroupByNamespace(aposLocale);
      await self.apos.cache.set(req.locale, 'i18n-static', i18nStaticPiecesByNamespace);

      const i18nStaticId = self.apos.util.generateId();
      req.data?.global && await self.apos.global.update(
        req,
        {
          ...req.data.global,
          i18nStaticId
        }
      );

      return i18nStaticId;
    }
  };
};
