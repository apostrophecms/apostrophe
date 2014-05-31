var _ = require('lodash');
var async = require('async');

/**
 * workflow
 * @augments Augments the apos object with methods which provide
 * workflow-related services. See also pages.js.
 * @see pages
 */

module.exports = function(self) {
  // On the first call, figure out which properties are
  // not suitable for workflow-based editing
  if (!self._nonWorkflowProperties) {
    self._nonWorkflowProperties = [ '_id', 'title', 'permissions', 'path', 'slug', 'level', 'trash', 'orphan', 'lowSearchText', 'highSearchText', 'highSearchWords', 'searchSummary' ];
    // Let modules push on more properties that are
    // not suitable for workflow
    self.emit('aposNonWorkflowProperties', self._nonWorkflowProperties);
  }

  // Given an array of pages retrieved from mongodb, return a
  // new array that represents what would be retrieved if all
  // outstanding drafts were published. The ._draft property is
  // set to true so you can distinguish the pages based on
  // outstanding drafts from those that are current.

  self.workflowGetDrafts = function(pages) {
    return _.map(pages, function(page) {
      var preserve = _.pick(page, self._nonWorkflowProperties);
      if (!page.draft) {
        return page;
      }
      var draft = page.draft;
      _.extend(draft, preserve);
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

  // Given a page slug and a page object, update its working
  // draft without modifying the publicly live content.

  self.workflowUpdatePage = function(slug, page, callback) {
    page = _.omit(page, self._nonWorkflowProperties);
    // Flag what we have in memory now as a draft, so it looks like
    // what we'd get back from workflowGetDrafts, and so that the
    // versionPage method records the draftiness
    page._draft = true;
    return self.pages.update({ slug: slug }, { $set: { draft: page } }, callback);
  };
};
