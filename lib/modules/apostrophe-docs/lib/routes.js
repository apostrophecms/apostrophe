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

  // Determine if a particular slug is available. Since the slug namespace
  // is shared by all doc types, you only need to be a user to access this
  // route. No other information about the document with that slug is returned
  self.route('post', 'slug-taken', function(req, res) {
    if (!req.user) {
      return res.status(404).send('notfound');
    }
    var slug = self.apos.launder.string(req.body.slug);
    var _id = self.apos.launder.id(req.body._id);
    var criteria = {
      slug: slug
    };
    if (_id) {
      criteria._id = { $ne: _id };
    }
    return self.find(req, criteria).permission(false).trash(null).published(null).projection({ slug: 1 }).toObject().then(function(doc) {
      if (doc) {
        return res.send({ status: 'taken' });
      } else {
        return res.send({ status: 'ok' });
      }
    }).catch(function(err) {
      self.apos.utils.error(err);
      return res.send({ status: 'error' });
    });
  });

  self.route('post', 'slug-deconflict', function(req, res) {
    if (!req.user) {
      return res.status(404).send('notfound');
    }
    var _id = self.apos.launder.id(req.body._id);
    var slug = self.apos.launder.string(req.body.slug);
    var counter = 1;
    var suffix;
    return deconflict(slug).then(function(slug) {
      return res.send({ status: 'ok', slug: slug });
    }).catch(function(err) {
      self.apos.utils.error(err);
      return res.send({ status: 'error' });
    });

    function deconflict(slug) {
      var criteria = {
        slug: slug
      };
      if (_id) {
        criteria._id = { $ne: _id };
      }
      return self.find(req, criteria).permission(false).trash(null).published(null).projection({ slug: 1 }).toObject().then(function(doc) {
        if (doc) {
          counter++;
          suffix = '-' + counter;
          slug = slug.replace(/-\d+$/, '') + suffix;
          return deconflict(slug);
        } else {
          return slug;
        }
      });
    }
  });
};
