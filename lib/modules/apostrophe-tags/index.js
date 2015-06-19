var async = require('async');
var _ = require('lodash');

module.exports = {
  alias: 'tags',
  construct: function(self, options) {
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

    // localhost:XXXX/modules/apostrophe-tags/autocomplete
    self.route('all', 'autocomplete', function(req, res) {
      var data = (req.method === 'POST') ? req.body : req.query;

      // Special case: selective is asking for complete objects with
      // label and value properties for existing values. For tags these
      // are one and the same so just do a map call

      if (data.values) {
        return res.send(_.map(data.values, function(value) {
          return { value: value, label: value };
        }));
      }

      var criteria = {}
      if(data.prefix) {
        criteria = { prefix: data.term };
      } else {
        criteria = { contains: data.term };
      }

      return self.get(req, criteria, function(err, tags) {
        if (err) {
          return callback(err);
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
}
