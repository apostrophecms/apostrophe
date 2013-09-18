var async = require('async');
var _ = require('underscore');
var extend = require('extend');

/**
 * tags
 * @augments Augments the apos object with methods, routes and
 * properties supporting the management of tags by Apostrophe.
 * @see static
 */

module.exports = {
  construct: function(self) {

    // Returns all tags used on pages, snippets, videos, files, etc. Accepts prefix option.
    // Sanitizes options. Use options.prefix for autocomplete. options argument is not
    // required.
    //
    // Tags are searched for in the pages, files and videos collection by default.
    // Additional collections can be added via the addTaggables option when
    // configuring Apostrophe.
    self.getTags = function(options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var prefix = self.sanitizeString(options.prefix);
      var r = new RegExp('^' + RegExp.quote(prefix.toLowerCase()));
      var results = [];
      var resultsMap = {};
      return async.eachSeries(self.getTaggables(), function(taggable, callback) {
        return taggable.distinct("tags", { tags: r }, function(err, tags) {
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
          _.each(tags, function(tag) {
            if (!_.has(resultsMap, tag)) {
              resultsMap[tag] = true;
              results.push(tag);
            }
          });
          return callback(null);
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }
        results.sort();
        return callback(null, results);
      });
    };

    // Remove a tag from all taggable collections

    self.deleteTag = function(tag, callback) {
      var criteria = { tags: { $in: [ tag ] } };
      return async.eachSeries(self.getTaggables(), function(taggable, callback) {
        return taggable.update(criteria, { $pull: { tags: tag } }, { multi: true }, callback);
      }, callback);
    };

    // Rename a tag across all taggable collections. This serves
    // as a merge operation too (double tagging is not possible with
    // addToSet)

    self.renameTag = function(tag, newTag, callback) {
      var criteria = { tags: { $in: [ tag ] } };
      return async.eachSeries(self.getTaggables(), function(taggable, callback) {
        return async.series({
          addToSet: function(callback) {
            return taggable.update(criteria, { $addToSet: { tags: newTag } }, { multi: true }, callback);
          },
          pull: function(callback) {
            return taggable.update(criteria, { $pull: { tags: tag } }, { multi: true }, callback);
          }
        }, callback);
      }, callback);
    };

    // Accept tags as a comma-separated string and sanitize them,
    // returning an array of zero or more nonempty strings. Must match
    // browser side implementation. Useful on the server side for
    // import implementations
    self.tagsToArray = function(tags) {
      if (typeof(tags) === 'number') {
        tags += '';
      }
      if (typeof(tags) !== 'string') {
        return [];
      }
      tags += '';
      tags = tags.split(/,\s*/);
      // split returns an array of one empty string for an empty source string ):
      tags = _.filter(tags, function(tag) { return tag.length > 0; });
      // Make them all strings
      tags = _.map(tags, function(tag) {
        // Tags are always lowercase otherwise they will not compare
        // properly in MongoDB. If you want to change this then you'll
        // need to address that deeper issue
        return (tag + '').toLowerCase();
      });
      return tags;
    };

    self.getTaggables = function() {
      if (!self._taggables) {
        self._taggables = [ self.pages, self.files, self.videos ];
        if (self.options.addTaggables) {
          self._taggables = self._taggables.concat(self.options.addTaggables);
        }
      }
      return self._taggables;
    };
  },

  init: function(self) {
    // Fetch all tags. Accepts options supported by apos.getTags
    // as query parameters. Useful for creating tag admin tools.
    self.app.get('/apos/tags', function(req, res) {
      return self.getTags(req.query, function(err, tags) {
        if (err) {
          console.error(err);
          return res.send({ status: 'error' });
        }
        return res.send({ status: 'ok', tags: tags });
      });
    });

    self.app.post('/apos/delete-tag', function(req, res) {
      if (!(req.user && req.user.permissions.admin)) {
        res.statusCode = 403;
        return res.send('forbidden');
      }
      var tag = self.sanitizeString(req.body.tag);
      if (!tag.length) {
        return res.send({ status: 'error' });
      }
      return self.deleteTag(tag, function(err) {
        if (err) {
          console.error(err);
          return res.send({ status: 'error' });
        }
        return res.send({ status: 'ok' });
      });
    });

    self.app.post('/apos/rename-tag', function(req, res) {
      if (!(req.user && req.user.permissions.admin)) {
        res.statusCode = 403;
        return res.send('forbidden');
      }
      var tag = self.sanitizeString(req.body.tag);
      if (!tag.length) {
        return res.send({ status: 'error' });
      }
      var newTag = self.sanitizeString(req.body.newTag);
      if (!newTag.length) {
        return res.send({ status: 'error' });
      }
      return self.renameTag(req.body.tag, req.body.newTag, function(err) {
        if (err) {
          console.error(err);
          return res.send({ status: 'error' });
        }
        return res.send({ status: 'ok' });
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

      return self.getTags({ prefix: req.query.term }, function(err, tags) {
        if (err) {
          return self.fail(req, res);
        }
        tags = _.map(tags, function(tag) {
          return { value: tag, label: tag };
        });
        if (tags.length > 100) {
          tags = tags.slice(0, 100);
        }
        return res.send(tags);
      });
    });
  }
};

