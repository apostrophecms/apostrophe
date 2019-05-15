module.exports = function(self, options) {

  self.addRoutes = function() {

    self.apiRoute('post', 'cancel', function(req, res, next) {
      var _id = self.apos.launder.id(req.body._id);
      return self.db.update({ _id: _id }, { $set: { canceling: true } }, function(err, count) {
        if (err) {
          return next(err);
        }
        if (!count) {
          return next('notfound');
        }
        return next(null);
      });
    });

    self.renderRoute('post', 'modal', function(req, res, next) {
      var _id = self.apos.launder.id(req.body._id);
      return self.db.findOne({ _id: _id }, function(err, job) {
        if (err) {
          return next(err);
        }
        return next(null, {
          template: 'modal',
          data: {
            options: self.options,
            job: job
          }
        });
      });
    });

    self.apiRoute('post', 'progress', function(req, res, next) {
      var _id = self.apos.launder.id(req.body._id);
      return self.db.findOne({ _id: _id }, function(err, job) {
        if (err) {
          return next(err);
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
        var html;
        try {
          html = self.render(req, 'progress', { job: job });
        } catch (e) {
          return next(e);
        }
        return next(null, { job: job, html: html });
      }
    });
  };
};
