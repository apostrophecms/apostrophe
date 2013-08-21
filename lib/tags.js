
var _ = require('underscore');
var extend = require('extend');

/**
 * tags
 * @augments Augments the apos object with methods, routes and
 * properties supporting the management of tags by Apostrophe.
 * @see static
 */

module.exports = function(self) {
  // Returns all tags used on pages, snippets, etc. Accepts prefix and
  // limit options (neither is required). Sanitizes options.
  // Use options.prefix for autocomplete. options argument is not
  // required.

  self.getTags = function(options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }
    var prefix = self.sanitizeString(options.prefix);
    var r = new RegExp('^' + RegExp.quote(prefix.toLowerCase()));
    return self.pages.distinct("tags", { tags: r }, function(err, tags) {
      if (err) {
        return callback(err);
      }
      // "Why do we have to apply the regular expression twice?"
      // The query above just limits the documents whose distinct tags are
      // returned. If one of the documents that has at least one tag
      // starting with "m" also has other tags not starting with "m," we
      // still have them at this point. The query is still worthwhile
      // because it cuts back the number of documents examined.
      tags = _.filter(tags, function(tag) {
        return tag.toString().match(r);
      });
      tags.sort();
      if (options.limit) {
        var limit = self.sanitizeInteger(options.limit);
        tags = tags.slice(0, limit);
      }
      return callback(null, tags);
    });
  };

  // Remove a tag from all pages. The optional criteria argument can
  // be used to limit the pages from which it is removed
  // (example: { type: 'person' })
  self.removeTag = function(tag, criteria, callback) {
    if (!callback) {
      callback = criteria;
      criteria = {};
    }
    var mergedCriteria = {};
    extend(true, mergedCriteria, criteria);
    mergedCriteria.tags = { $in: [ tag ] };
    return self.pages.update(mergedCriteria, { $pull: { tags: tag } }, { multi: true }, callback);
  };

  // Fetch all tags. Accepts options supported by apos.getTags
  // as query parameters. Useful for creating tag admin tools.
  self.app.get('/apos/tags', function(req, res) {
    return self.getTags(req.query, function(err, tags) {
      if (err) {
        return self.fail(req, res);
      }
      return res.send(tags);
    });
  });

  // Provides tag autocomplete in the format expected by jquery selective.
  self.app.get('/apos/autocomplete-tag', function(req, res) {
    // Special case: selective is asking for complete objects with
    // label and value properties for existing values. For tags these
    // are one and the same so just do a map call
    if (req.query.values) {
      return res.send(_.map(req.query.values, function(value) {
        return { value: value, label: value };
      }));
    }

    return self.getTags({ prefix: req.query.term, limit: 100 }, function(err, tags) {
      if (err) {
        return self.fail(req, res);
      }
      tags = _.map(tags, function(tag) {
        return { value: tag, label: tag };
      });
      return res.send(tags);
    });
  });
};

