module.exports = function(self, options) {

  self.apiRoute('post', 'lock', function(req, res, next) {
    const result = self.lock(req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      {
        force: !!req.body.force
      },
      function(err, message) {
        if (err) {
          console.error('error is', err);
          return next(err, null, { message: message });
        }
        console.error('trying to have no error');
        return next(null);
      }
    );
    console.log(result);
    return result;
  });

  self.apiRoute('post', 'verify-lock', function(req, res, next) {
    return self.verifyLock(req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      function(err, message) {
        if (err) {
          return next(err, null, { message: message });
        }
        return next(null);
      }
    );
  });

  self.apiRoute('post', 'unlock', function(req, res, next) {
    return self.unlock(req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      next
    );
  });

  // Determine if a particular slug is available. Since the slug namespace
  // is shared by all doc types, you only need to be a user to access this
  // route. No other information about the document with that slug is returned
  self.apiRoute('post', 'slug-taken', function(req, res, next) {
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
        return next('taken');
      } else {
        return next(null);
      }
    }).catch(function(err) {
      return next(err);
    });
  });

  self.apiRoute('post', 'slug-deconflict', function(req, res, next) {

    if (!req.user) {
      throw 'notfound';
    }
    var _id = self.apos.launder.id(req.body._id);
    var slug = self.apos.launder.string(req.body.slug);
    var counter = 1;
    var suffix;

    return deconflict(slug).then(function(slug) {
      return next(null, { slug: slug });
    }).catch(next);

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
