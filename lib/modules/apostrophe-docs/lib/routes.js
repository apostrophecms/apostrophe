module.exports = function(self, options) {

  self.route('post', 'lock', function(req, res) {
    return self.lock(req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      {
        force: !!req.body.force
      },
      function(err, message) {
        if (err) {
          if (typeof (err) === 'string') {
            return res.send({ status: err, message: message });
          } else {
            return res.send({ status: 'error' });
          }
        }
        return res.send({ status: 'ok' });
      }
    );
  });

  self.route('post', 'verify-lock', function(req, res) {
    return self.verifyLock(req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      function(err, message) {
        if (err) {
          if (typeof (err) === 'string') {
            return res.send({ status: err, message: message });
          } else {
            return res.send({ status: 'error' });
          }
        }
        return res.send({ status: 'ok' });
      }
    );
  });

  self.route('post', 'unlock', function(req, res) {
    return self.unlock(req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      function(err) {
        if (err) {
          if (typeof (err) === 'string') {
            return res.send({ status: err });
          } else {
            return res.send({ status: 'error' });
          }
        }
        return res.send({ status: 'ok' });
      }
    );
  });

};
