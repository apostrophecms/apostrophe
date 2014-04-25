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

    // Returns all tags used on pages, snippets, videos, files, etc.
    // Sanitizes options. Use `options.prefix` for autocomplete. The `options` argument
    // may be skipped.
    //
    // Tags are searched for in the pages, files and videos collections by default.
    // Additional collections can be added via the `addTaggables` option when
    // configuring Apostrophe.
    self.getTags = function(options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var prefix = self.sanitizeString(options.prefix);
      // Fixed a bug: we should use this site's tag filter, if any,
      // and not assume coercion to lowercase in this one place. -Tom
      var r = new RegExp('^' + RegExp.quote(self.filterTag(prefix)));
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

    // Remove a tag from all taggable collections.

    self.deleteTag = function(tag, callback) {
      var criteria = { tags: { $in: [ tag ] } };
      return async.eachSeries(self.getTaggables(), function(taggable, callback) {
        return taggable.update(criteria, { $pull: { tags: tag } }, { multi: true }, callback);
      }, callback);
    };

    // Rename a tag across all taggable collections. This serves
    // as a merge operation too; double-tagging will not occur if you
    // rename a tag to match another tag.

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
    // returning an array of zero or more nonempty strings. Although our
    // browser-side code submits tags as arrays, this is still useful for
    // import operations.
    //
    // If a filterTag function is passed as an option when initializing
    // Apostrophe, then all tags are passed through it (as individual
    // strings, one per call) and the return value is used instead. This
    // is useful if you wish to force all-uppercase or all-lowercase
    // tags for a particular project. Be sure to update any existing
    // database entries for tags before making such a change.

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
        return tag.toString();
      });
      if (self.options.filterTag) {
        tags = _.map(tags, self.options.filterTag);
      }
      return tags;
    };

    // Returns an array of collections which should be considered taggable
    // by the `apos.getTags` method, etc. This list can be expanded by
    // setting the `addTaggables` option when initializing the Apostrophe module.

    self.getTaggables = function() {
      if (!self._taggables) {
        self._taggables = [ self.pages, self.files, self.videos ];
        if (self.options.addTaggables) {
          self._taggables = self._taggables.concat(self.options.addTaggables);
        }
      }
      return self._taggables;
    };

    // Pass a tag through the currently configured filter function, if any,
    // otherwise return it unmodified. Useful if you do your own tag validation

    self.filterTag = function(tag) {
      if (self.options.filterTag) {
        return self.options.filterTag(tag);
      }
      return tag;
    };
  },

  init: function(self) {
    // Fetch all tags. Accepts options supported by `apos.getTags`
    // as query parameters. Useful for creating tag admin tools.
    // Always responds with a JSON object. If the `status` property
    // is `ok` then the `tags` property will contain the retrieved tags.
    self.app.get('/apos/tags', function(req, res) {
      return self.getTags(req.query, function(err, tags) {
        if (err) {
          console.error(err);
          return res.send({ status: 'error' });
        }
        return res.send({ status: 'ok', tags: tags });
      });
    });

    // Delete a tag. The tag should be the `tag` POST parameter.
    // Always responds with a JSON object. If the `status` property
    // is `ok` then the tag was deleted.

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

    // Rename a tag. The old tag name should be the `tag` POST parameter,
    // and the new tag name should be the `newTag parameter.
    //
    // Always responds with a JSON object. If the `status` property
    // is `ok` then the tag was renamed.

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

    // Provides tag autocomplete in the format expected by jQuery selective.

    // If the `values` parameter is present, it is expected to be an array
    // of tags already selected, and the response simply pushes that array
    // back to the browser in JSON format with the tag name as both the
    // `value` and `label` properties as jQuery selective expects.
    //
    // If the `term` parameter is present, the response is a JSON array of
    // tags beginning with that string; again, each is represented as an
    // object with `value` and `label` properties both set to the name of
    // the tag.

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

