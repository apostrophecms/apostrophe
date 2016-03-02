var async = require('async');
var _ = require('lodash');
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
    // Sanitizes options. Use `options.prefix` for autocomplete
    // with prefix only (fastest) or `options.contains` for
    // autocomplete matching at any point in the tag. Use
    // `options.tags` to limit results to an array of tag names of
    // interest. You may not combine these options. The `options`
    // argument may be skipped.
    //
    // Tags are searched for in the pages, files, videos, and
    // allowedTags collections.
    //
    // Additional collections can be added via the `addTaggables`
    // option when configuring Apostrophe.
    //
    // All of this probably suggests we should have normalized tags.

    self.getTags = function(options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var prefix = self.sanitizeString(options.prefix);
      var contains = self.sanitizeString(options.contains);
      var results = [];
      var resultsMap = {};
      return async.eachSeries(self.getTaggables(), function(taggable, callback) {
        var criteria = {};
        if (prefix.length) {
          criteria.tags = new RegExp('^' + RegExp.quote(self.filterTag(prefix)));
        } else if (contains.length) {
          criteria.tags = new RegExp(RegExp.quote(self.filterTag(contains)));
        } else if (options.tags) {
          criteria.tags = { $in: options.tags };
        }
        return taggable.distinct("tags", criteria, function(err, tags) {
          if (err) {
            return callback(err);
          }
          // "Why do we have to apply the criteria twice?"
          // The query above just limits the documents whose distinct tags are
          // returned. If one of the documents that has at least one tag
          // starting with "m" also has other tags not starting with "m," we
          // still have them at this point. The query is still worthwhile
          // because it cuts back the number of documents examined.
          if (prefix.length || contains.length) {
            tags = _.filter(tags, function(tag) {
              return tag.toString().match(criteria.tags);
            });
          } else if (options.tags) {
            tags = _.intersection(options.tags, tags);
          }
          _.each(tags, function(tag) {
            if ((tag === null) || (tag === undefined)) {
              // "distinct" will return undefined for the records
              // that didn't have the property at all and null for
              // the records in which the property was empty.
              // Because that's useful, I guess, if you're expecting
              // it, which I wasn't
              return;
            }
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
      return async.series({
        taggables: function(callback) {
          return async.eachSeries(self.getTaggables(), function(taggable, callback) {
            return async.series({
              addToSet: function(callback) {
                return taggable.update(criteria, { $addToSet: { tags: newTag } }, { multi: true }, callback);
              },
              pull: function(callback) {
                return taggable.update(criteria, { $pull: { tags: tag } }, { multi: true }, callback);
              },
            }, callback);
          }, callback);
        },
        afterRenameTag: function(callback) {
          return self.afterRenameTag(tag, newTag, callback);
        }
      }, callback);
    };

    self.afterRenameTag = function(tag, newTag, callback) {
      return callback(null);
    };

    // You DON'T have to do this to add a tag on the fly when
    // inserting a snippet, page, etc. This method is used by the
    // tag admin interface to add tags without reference to a
    // particular object. It inserts an object into the allowedTags
    // collection, which exists just to house these.
    //
    // When the lockTags option is in effect throughout Apostrophe,
    // this becomes only way to add a new tag to the system. That
    // rule is enforced by the sanitizer for tag fields in schemas,
    // and by the frontend UI of course.

    self.addTag = function(tag, callback) {
      self.allowedTags.update({ tags: [ tag ] }, { tags: [ tag ] }, { upsert: true }, callback);
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
      if (self.filterTag) {
        tags = _.map(tags, self.filterTag);
      }
      return tags;
    };

    // Returns an array of collections which should be considered taggable
    // by the `apos.getTags` method, etc. This list can be expanded by
    // setting the `addTaggables` option when initializing the Apostrophe module.

    self.getTaggables = function() {
      if (!self._taggables) {
        self._taggables = [ self.pages, self.files, self.videos, self.allowedTags ];
        if (self.options.addTaggables) {
          self._taggables = self._taggables.concat(self.options.addTaggables);
        }
      }
      return self._taggables;
    };
  },

  init: function(self) {

    // Default is now to coerce tags to lowercase
    self.filterTag = self.options.filterTag || function(tag) {
      tag = tag.trim();
      return tag.toLowerCase();
    };

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
      // Don't filter the old one, let them fix things
      // that used to not respect the current filter
      var tag = self.sanitizeString(req.body.tag);
      if (!tag.length) {
        return res.send({ status: 'error' });
      }
      var newTag = self.filterTag(self.sanitizeString(req.body.newTag));
      if (!newTag.length) {
        return res.send({ status: 'error' });
      }
      return self.renameTag(tag, newTag, function(err) {
        if (err) {
          console.error(err);
          return res.send({ status: 'error' });
        }
        return res.send({ status: 'ok', oldTag: tag, newTag: newTag });
      });
    });

    // Add a tag.
    //
    // Always responds with a JSON object. If the `status` property
    // is `ok` then the tag was added.

    self.app.post('/apos/add-tag', function(req, res) {
      if (!(req.user && req.user.permissions.admin)) {
        res.statusCode = 403;
        return res.send('forbidden');
      }
      var tag = self.filterTag(self.sanitizeString(req.body.tag));
      if (!tag.length) {
        console.log('no tag in body');
        return res.send({ status: 'error' });
      }
      return self.addTag(tag, function(err) {
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

    self.app.all('/apos/autocomplete-tag', function(req, res) {
      // Special case: selective is asking for complete objects with
      // label and value properties for existing values. For tags these
      // are one and the same so just do a map call
      var data = (req.method === 'POST') ? req.body : req.query;
      if (data.values) {
        return res.send(_.map(data.values, function(value) {
          return { value: value, label: value };
        }));
      }

      return self.getTags({ contains: data.term }, function(err, tags) {
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

    // Prior to 2014-08-05 Apostrophe had no filterTag function by
    // default. Beginning with 2014-08-05 lowercase is the default.
    // This migration runs the current filterTag function on all
    // widely used tag properties. If you have others in schema fields
    // in an existing site from prior to this point, you should
    // convert those to lowercase yourself.

    self.addMigration('filterTags', function filterTags(callback) {
      var needed = false;
      return async.eachSeries(self.getTaggables(), function(taggable, callback) {
        return self.forEachDocumentInCollection(taggable, {}, function(doc, callback) {
          var changed = false;
          var properties = [ 'tags', 'notTags', 'withTags' ];
          _.each(properties, function(property) {
            if (!Array.isArray(doc[property])) {
              return;
            }
            var tags = _.map(doc[property], self.filterTag);
            if (JSON.stringify(doc[property]) !== JSON.stringify(tags)) {
              changed = true;
              doc[property] = tags;
            }
          });
          if (!changed) {
            return callback(null);
          }
          if (!needed) {
            needed = true;
            console.log('Filtering tags');
          }
          return taggable.update({ _id: doc._id }, doc, callback);
        }, callback);
      }, callback);
    });
  }
};

