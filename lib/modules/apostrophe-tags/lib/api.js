
var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {
  self.listTags = function(req, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }

    var criteria = {};
    if (options.prefix && options.prefix.length) {
      criteria.tags = new RegExp('^' + self.apos.utils.regExpQuote(options.prefix));
    } else if (options.contains && options.contains.length) {
      criteria.tags = new RegExp(self.apos.utils.regExpQuote(options.contains));
    } else if (options.all) {
      // Get all the documents, no criteria needed.
    } else if (options.tags) {
      criteria.tags = { $in: options.tags };
    }

    // TODO This logic makes it so we can only retrieve (and thus autocomplete)
    // tags that are saved in the 'tags' field of docs. Should we instead,
    // on startup, walk the schema to find all tag fields and construct
    // a query from that? That might need to be multiple queries though,
    // which could be a performance hit. Worthy of further consideration - Jimmy
    self.apos.docs.find(req, criteria).toDistinct('tags', function(err, tags) {
      if (err) {
        return callback(err);
      }
      // "Why do we have to apply the criteria twice?"
      // The query above just limits the documents whose distinct tags are
      // returned. If one of the documents that has at least one tag
      // starting with "m" also has other tags not starting with "m," we
      // still have them at this point. The query is still worthwhile
      // because it cuts back the number of documents examined.
      if ((options.prefix && options.prefix.length) || (options.contains && options.contains.length)) {
        tags = _.filter(tags, function(tag) {
          return tag.toString().match(criteria.tags);
        });
      } else if (options.all) {
        // Keep all tags
      } else if (options.tags) {
        tags = _.intersection(options.tags, tags);
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

  self.launder = function(tag) {
    return self.apos.launder.filterTag(self.apos.launder.string(tag));
  }

};
