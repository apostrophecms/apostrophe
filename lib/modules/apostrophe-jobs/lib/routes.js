module.exports = function(self, options) {

  self.addRoutes = function() {

    self.apiRoute('post', 'cancel', async function(req) {
      const _id = self.apos.launder.id(req.body._id);
      const count = await self.db.update({ _id: _id }, { $set: { canceling: true } });
      if (!count) {
        throw 'notfound';
      }
    });

    self.apiRoute('post', 'progress', async function(req) {
      let _id = self.apos.launder.id(req.body._id);
      const job = await self.db.findOne({ _id: _id });
      if (!job) {
        throw 'notfound';
      }
      // % of completion rounded off to 2 decimal places
      if (!job.total) {
        job.percentage = 0;
      } else {
        job.percentage = (job.processed / job.total * 100).toFixed(2);
      }
      return job;
    });
  };
};
