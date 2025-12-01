module.exports = (self, query) => {
  return {
    builders: {
      namespace: {
        def: null,

        finalize() {
          const namespace = query.get('namespace');
          if (namespace === null) {
            return;
          }
          query.and({ namespace });
        },

        launder(value) {
          const choices = self.getNamespaces();
          return self.apos.launder.select(value, choices, null);
        },

        async choices() {
          const req = self.apos.task.getReq();
          const pieces = await self.find(req).toArray();

          return [ ...new Set(pieces.map(piece => JSON.stringify({
            label: piece.namespace,
            value: piece.namespace
          }))) ].map(JSON.parse);
        }
      }
    }
  };
};
