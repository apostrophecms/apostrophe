
var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {
  // TODO reconcile this with self.get, they should be able to share code.
  self.listTags = function(req, contains, callback) {
    var criteria = {};
    if (contains.length) {
      criteria.tags = new RegExp(self.apos.utils.regExpQuote(contains));
    }
    self.apos.docs.find(req, criteria).toDistinct('tags', function(err, tags) {
      if (err) {
        return callback(err);
      }
      var results = _.filter(tags, function(tag) {
        return tag !== null && tag !== undefined;
      });
      results.sort();
      return callback(null, results);
    });
  };

  self.addTag = function(req, tag, callback) {
    var piece = {
      title: tag,
      slug: self.apos.utils.slugify('tag-' + tag),
      tags: [ tag ],
      published: true
    };
    return self.insert(req, piece, callback);
  };

  self.renameTag = function(req, tag, newTag, callback) {
    var criteria = { tags: { $in: [ tag ] } };
    return async.series({
      addToSet: function(callback) {
        return self.apos.docs.db.update(criteria, { $addToSet: { tags: newTag } }, { multi: true }, callback);
      },
      pull: function(callback) {
        return self.apos.docs.db.update(criteria, { $pull: { tags: tag } }, { multi: true }, callback);
      },
      findPiece: function(callback) {
        return self.find(req, { slug: self.apos.utils.slugify('tag-' + tag) })
          .toObject(function (err, result) {
            if (err) {
              return callback(err);
            }
            piece = result;
            return callback();
          }
        );
      },
      updatePiece: function(callback) {
        if (!piece) {
          return setImmediate(callback);
        }
        piece.title = newTag;
        piece.slug = self.apos.utils.slugify('tag-' + newTag);
        return self.update(req, { _id: piece._id }, callback);
      }
    }, function(err) {
      return callback(err);
    });
  };

  self.deleteTag = function(req, tag, callback) {
    var criteria = { tags: { $in: [ tag ] } };
    var piece;
    return async.series({
      deleteTag: function(callback) {
        return self.apos.docs.db.update(criteria, { $pull: { tags: tag } }, { multi: true }, callback);
      },
      findPiece: function(callback) {
        return self.find(req, { slug: self.apos.utils.slugify('tag-' + tag) })
          .toObject(function (err, result) {
            if (err) {
              return callback(err);
            }
            piece = result;
            return callback();
          }
        );
      },
      deletePiece: function(callback) {
        if (!piece) {
          return setImmediate(callback);
        }
        return self.apos.docs.db.remove({ _id: piece._id }, callback);
      }
    }, function(err) {
      return callback(err);
    });
  };

  // Returns all tags used on pages, snippets, videos, files, etc.
  // Sanitizes options. Use `options.prefix` for autocomplete
  // with prefix only (fastest) or `options.contains` for
  // autocomplete matching at any point in the tag. Use
  // `options.tags` to limit results to an array of tag names of
  // interest. You may not combine these options. The `options`
  // argument may be skipped.
  //
  // Tags are searched for in the pages, files, videos, and
  // allowedTags collections and anything else that registers interest.
  //
  // Additional collections can be added via the `addTaggables`
  // option when configuring this module (TODO: this ought to
  // be an event for easier registration).

  self.get = function(req, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }

    var prefix = self.apos.launder.string(options.prefix);
    var contains = self.apos.launder.string(options.contains);

    var results = [];
    var resultsMap = {};

    return async.eachSeries(self.getTaggables(), function(taggable, callback) {
      var criteria = {};
      if (prefix.length) {
        criteria.tags = new RegExp('^' + self.apos.utils.regExpQuote(self.apos.launder.filterTag(prefix)));
      } else if (contains.length) {
        criteria.tags = new RegExp(self.apos.utils.regExpQuote(self.apos.launder.filterTag(contains)));
      } else if (options.tags) {
        var tags = self.apos.launder.tags(options.tags);
        criteria.tags = { $in: tags };
      }

      // TODO This logic makes it so we can only retrieve (and thus autocomplete)
      // tags that are saved in the 'tags' field of docs. Should we instead,
      // on startup, walk the schema to find all tag fields and construct
      // a query from that? That might need to be multiple queries though,
      // which could be a performance hit. Worthy of further consideration - Jimmy
      return taggable.find(req, criteria).toDistinct('tags', function(err, tags){
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

  self.getTaggables = function() {
    if (!self._taggables) {
      // self._taggables = [ self.apos.docs, self.apos.files.db, self.apos.allowedTags.db ];
      self._taggables = [ self.apos.docs ];
      if (self.options.addTaggables) {
        self._taggables = self._taggables.concat(self.options.addTaggables);
      }
    }
    return self._taggables;
  };

  self.launder = function(tag) {
    return self.apos.launder.filterTag(self.apos.launder.string(tag));
  }

};
