module.exports = function(self, options) {

  self.apiRoute('post', 'lock', async function(req) {
    await self.lock(
      req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      {
        force: !!req.body.force
      }
    );
  });

  self.apiRoute('post', 'verify-lock', async function(req) {
    await self.verifyLock(
      req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId
    );
  });

  self.apiRoute('post', 'unlock', async function(req) {
    await self.unlock(
      req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId
    );
  });

};
