module.exports = function(self, options) {
  self.route('post', 'session-lock', function(req, res) {
    console.log(req.body);
    return self.sessionLock(req, 
      self.apos.launder.id(req.body._id),
      {
        force: !!req.body.force
      },
      function(err) {
        if (err) {
          if (typeof(err) === 'string') {
            return res.send({ status: err });
          } else {
            return res.send({ status: 'error' });
          }
        }
        return res.send({ status: 'ok' });
      }
    );
  });
  self.route('post', 'session-unlock', function(req, res) {
    return self.sessionUnlock(req, 
      self.apos.launder.id(req.body._id),
      function(err) {
        if (err) {
          if (typeof(err) === 'string') {
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
