module.exports = function(self, options) {

  self.addRoutes = function() {

    self.route('post', 'cancel', function(req, res) {
      var _id = self.apos.launder.id(req.body._id);
      return self.db.update({ _id: _id }, { $set: { canceling: true } }, function(err, count) {
        if (err) {
          self.apos.utils.error(err);
          return res.send({ status: 'error' });
        }
        if (!count) {
          return res.send({ status: 'notfound' });
        }
        return res.send({ status: 'ok' });
      });
    });

    self.route('post', 'modal', function(req, res) {
      var _id = self.apos.launder.id(req.body._id);
      return self.db.findOne({ _id: _id }, function(err, job) {
        if (err) {
          self.apos.utils.error(err);
          return res.send({ status: 'error' });
        }
        return res.send(self.render(req, 'modal', { options: self.options, job: job }));
      });
    });

    self.route('post', 'progress', function(req, res) {
      var _id = self.apos.launder.id(req.body._id);
      return self.db.findOne({ _id: _id }, function(err, job) {
        if (err) {
          self.apos.utils.error(err);
          return res.send({ status: 'error' });
        }
        if (!job) {
          return respond({ notfound: true });
        }
        // % of completion rounded off to 2 decimal places
        if (!job.total) {
          job.percentage = 0;
        } else {
          job.percentage = (job.processed / job.total * 100).toFixed(2);
        }
        return respond(job);
      });

      function respond(job) {
        return res.send({ status: 'ok', job: job, html: self.render(req, 'progress', { job: job }) });
      }
    });
  };
};
