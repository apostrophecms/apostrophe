module.exports = function(self, options) {
  // Returns information about all versions of the doc indicated by `req.body._id`,
  // as an object with `doc` and `versions` properties. `versions` are in
  // reverse chronological order.
  self.apiRoute('post', 'list', async function(req) {
    const _id = self.apos.launder.id(req.body._id);
    let doc = await self.apos.docs.find(req, { _id: _id }).published(null).permission('edit').toObject();
    if (!doc) {
      throw 'notfound';
    }
    let versions = await self.find(req, { docId: doc._id }, {});
    for (let i = 0; (i < versions.length - 1); i++) {
      // Something to diff against
      versions[i]._previous = versions[i + 1];
    }
    return {
      doc: doc,
      versions: versions
    };
  });

  // Given req.body.oldId and req.body.currentId, returns an object
  // with a `version._changes` array subproperty representing the difference between them.
  
  self.apiRoute('post', 'compare', async function(req) {
    const oldId = self.apos.launder.id(req.body.oldId);
    const currentId = self.apos.launder.id(req.body.currentId);
    let current;
    let versions = await self.find(req, { _id: { $in: [ oldId, currentId ] } }, { changes: true });
    if (versions.length !== 2) {
      throw 'notfound';
    }
    current = versions[0];
    return {
      version: current
    };
  });

  // Revert to the version identified by `req.body._id`.
  self.apiRoute('post', 'revert', async function(req) {
    const versions = await self.find(req, { _id: self.apos.launder.id(req.body._id) }, {});
    if (!versions[0]) {
      throw 'notfound';
    }
    const version = versions[0];
    return self.revert(req, version);
  });
};
