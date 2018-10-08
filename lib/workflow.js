var _ = require('lodash');
var async = require('async');

/**
 * workflow
 * @augments Augments the apos object with methods which provide
 * workflow-related services. See also pages.js.
 * @see pages
 */

module.exports = function(self) {

  // Given an array of pages retrieved from mongodb, return a
  // new array that represents what would be retrieved if all
  // outstanding drafts were published. The ._draft property is
  // set to true so you can distinguish the pages based on
  // outstanding drafts from those that are current.

  self.workflowGetDrafts = function(pages) {
    return _.map(pages, function(page) {
      if (!page.draft) {
        return page;
      }
      var draft = {};
      _.extend(draft, page);
      _.extend(draft, page.draft);
      delete draft.draft;
      // So we can distinguish drafts from live pages with no outstanding edits
      draft._draft = true;
      return draft;
    });
  };

  // Given an array of pages retrieved from mongodb, modify
  // each page object by removing any information about drafts.
  // This does not modify the database.
  self.workflowCleanPages = function(pages) {
    _.each(pages, function(page) {
      if (page.draft) {
        delete page.draft;
      }
    });
  };

  // Update the specified properties of the current draft of
  // the page in the database. If those properties do not exist on the page
  // object provided, they are unset rather than set. Also
  // adds ._draft = true to the passed page object as a reminder
  // that it contains drafts rather than final content.
  //
  // It's your responsibility not to call this with dangerous
  // property names in "props", like slug, path, level, _id, pagePermissions

  self.workflowUpdatePage = function(req, page, props, callback) {
    if (arguments.length === 3) {
      // for bc we tolerate a missing req on this method,
      // it is only used to set draftAuthoredById
      req = { user: { title: 'unknown', _id: 'unknown' } };
      page = arguments[0];
      props = arguments[1];
      callback = arguments[2];
    }
    // Flag what we have in memory now as a draft, so it looks like
    // what we'd get back from workflowGetDrafts, and so that the
    // versionPage method records the draftiness
    page._draft = true;
    var work = {};
    var $set = {
      draftAuthoredById: (req.user && req.user._id) || 'unknown'
    };
    var $unset = {};
    _.each(props, function(prop) {
      if (page[prop] !== undefined) {
        $set['draft.' + prop] = page[prop];
      } else {
        $unset['draft.' + prop] = 1;
      }
    });
    if (!_.isEmpty($set)) {
      work.$set = $set;
    }
    if (!_.isEmpty($unset)) {
      work.$unset = $unset;
    }
    if (_.isEmpty(work)) {
      return setImmediate(callback);
    }
    return self.pages.update({ _id: page._id }, work, callback);
  };

  // Given a page object, update its live content to match
  // its draft.

  self.workflowApproveChanges = function(req, page, callback) {
    if (!page.draft) {
      return setImmediate(callback);
    }
    // TODO this won't know what to do if the draft change consisted
    // of deleting a property. We should move toward
    // true/false rather than true/nonexistent for boolean properties
    _.extend(page, page.draft);
    // Not a draft anymore
    delete page.draft;
    delete page.submitDraft;
    return async.series({
      beforePutPage: function(callback) {
        // Invoke this so that code intended for use
        // without workflow can still react when a
        // change is finally approved
        return self.beforePutPage(req, page, callback);
      },
      update: function(callback) {
        return self.pages.update({ _id: page._id }, page, callback);
      },
      indexPage: function(callback) {
        return self.indexPage(req, page, callback);
      },
      afterPutPage: function(callback) {
        // Invoke this so that code intended for use
        // without workflow can still react when a
        // change is finally approved
        return self.afterPutPage(req, page, callback);
      }
    }, callback);
  };

  self.workflowRequestApproval = function(req, page, callback) {
    // Make someone with suitable privileges aware that
    // this page is ready for approval
    page.submitDraft = new Date();
    return self.pages.update({ _id: page._id },
      { $set: { submitDraft: page.submitDraft, draftSubmittedBy: req.user && req.user.title } },
      callback);
  };

  // Called with req.extras by renderPage
  // to shut off the _edit flag for any editable pages when we are looking
  // at the public view. Returns true if any of the pages would have been
  // editable. Also sets _contribute to true on those pages.

  self.workflowPreventEditInPublicMode = function(possiblePages) {
    var contribute = false;
    _.each(possiblePages, function(value, key) {
      if (value && value._edit) {
        contribute = true;
        value._contribute = true;
        value._edit = false;
      }
    });
    return contribute;
  };

  self.app.post('/apos/workflow-mode', function(req, res) {
    if (!self.options.workflow) {
      // Politely ignore
      return res.send({ status: 'ok' });
    }
    req.session.workflowMode = self.sanitizeSelect(req.body.mode, [ 'draft', 'public' ], 'public');
    return res.send({ status: 'ok' });
  });

  self.app.post('/apos/workflow-approve-changes', function(req, res) {
    var submitted = 0;
    var published = 0;
    if (!self.options.workflow) {
      // Politely ignore
      return res.send({ status: 'ok' });
    }
    var slugs = self.sanitizeStrings(req.body.slugs);
    // A page is the fundamental unit of publication, so
    // reduce the page:areaname slugs to just the unique
    // page slugs
    slugs = _.uniq(_.map(slugs, function(slug) {
      return slug.replace(/\:\w+$/, '');
    }));
    var page;
    return async.eachSeries(slugs, function(slug, mainCallback) {
      return async.series({
        getPage: function(callback) {
          // Get the raw mongo document, with the draft property
          return self.pages.findOne({ slug: slug }, function(err, _page) {
            if (err) {
              return callback(err);
            }
            if (!_page) {
              // Not there any more
              return mainCallback(null);
            }
            if (!_page.draft) {
              // Has not been modified
              return mainCallback(null);
            }
            if (!self.permissions.can(req, 'edit-page', _page)) {
              // Not ours. It's a pain for the browser to detect which
              // are ours, so just gracefully ignore it
              return mainCallback(null);
            }
            page = _page;
            return callback(null);
          });
        },
        putPage: function(callback) {
          if (((!(self.options.workflow && self.options.workflow.forPublishers)) || (page.draftAuthoredById !== req.user._id)) && self.permissions.can(req, 'publish-page', page)) {
            published++;
            return self.workflowApproveChanges(req, page, callback);
          } else {
            submitted++;
            return self.workflowRequestApproval(req, page, callback);
          }
        }
      }, mainCallback);
    }, function(err) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok', submitted: submitted, published: published });
    });
  });
};
