var _ = require('@sailshq/lodash');

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
          return next(err, null, { message: message });
        }
        return next(null);
      }
    );
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
    return self.find(req, criteria).permission(false).trash(null).published(null).projection({ _url: 1, title: 1 }).toObject().then(function(doc) {
      if (doc) {
        var pageType = _.find(self.apos.pages.options.types, { name: doc.type });
        var label = (pageType && pageType.label) || self.apos.docs.getManager(doc.type).options.label || doc.type;
        var hint = req.__('The slug you want to use is currently claimed by the %s %s. Do you want to edit that document in order to change its slug?', req.__(label), doc.title);
        return next('taken', null, { doc: doc, hint: hint });
      } else {
        if (req.body.workflowLocale) {
          // check the live mode as well to make sure no page with same slug exists
          return self.find(req, criteria).workflowLocale(req.body.workflowLocale).permission(false).trash(null).published(null).projection({ _url: 1, title: 1, workflowGuid: 1 }).toObject().then(function(doc) {
            /*
             * If a doc exits in the live mode then find the respective draft mode version.
             * Since the slug has been de-duplicated, we are using the workflowGuid
             * to find the doc.
            */
            if (doc) {
              criteria = {};
              criteria.workflowGuid = doc.workflowGuid;
              return self.find(req, criteria).permission(false).trash(null).published(null).projection({ _url: 1, title: 1 }).toObject().then(function(doc) {
                if (doc) {
                  var pageType = _.find(self.apos.pages.options.types, { name: doc.type });
                  var label = (pageType && pageType.label) || self.apos.docs.getManager(doc.type).options.label || doc.type;
                  var hint = req.__('The slug you want to use is already being used by %s %s in live mode, i.e., someone has deleted that page but didn\'t commit the changes. Please commit those changes before re-using the slug or contact admin \n\nworkflow --> commit', req.__(label), doc.title);
                  return next('taken', null, { doc: doc, hint: hint });
                } else {
                  return next(null);
                }
              }).catch(function(err) {
                return next(err);
              });
            } else {
              return next(null);
            }
          }).catch(function(err) {
            return next(err);
          });
        } else {
          return next(null);
        }
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
