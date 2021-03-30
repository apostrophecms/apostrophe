var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.apiRoute('post', 'lock', function(req, res, next) {
    if (!req.user) {
      return next('forbidden');
    }
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
    if (!req.user) {
      return next('forbidden');
    }
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
    if (!req.user) {
      return next('forbidden');
    }
    return self.unlock(req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      next
    );
  });

  // Determine if a particular slug is available. Since the slug namespace
  // is shared by all doc types, you only need to be a user to access this
  // route. No other information about the document with that slug is returned
  self.apiRoute('post', 'slug-taken', async (req, res, next) => {
    if (!req.user) {
      return res.status(404).send('notfound');
    }
    const slug = self.apos.launder.string(req.body.slug);
    const _id = self.apos.launder.id(req.body._id);
    let original;
    if (_id) {
      original = self.apos.docs.db.findOne({ _id });
      if (!original) {
        return next(null);
      }
    }
    const criteria = {
      slug: slug
    };
    if (_id) {
      criteria._id = { $ne: _id };
      // We should worry only if workflowLocale is the same, including
      // both being null/undefined (considered strictly equal in mongodb).
      // Otherwise we detect false slug conflicts between exempt and
      // nonexempt types.
      criteria.workflowLocale = original.workflowLocale || null;
    }
    try {
      const doc = await self.find(req, criteria).permission(false).trash(null).published(null).projection({ _url: 1, title: 1 }).toObject();
      if (doc) {
        const pageType = _.find(self.apos.pages.options.types, { name: doc.type });
        const label = (pageType && pageType.label) || self.apos.docs.getManager(doc.type).options.label || doc.type;
        const hint = req.__ns('apostrophe', 'The slug you want to use is currently claimed by the %s %s. Do you want to edit that document in order to change its slug?', req.__ns('apostrophe', label), doc.title);
        return next('taken', null, { doc: doc, hint: hint });
      } else {
        return next(null);
      }
    } catch (e) {
      return next(e);
    }
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
