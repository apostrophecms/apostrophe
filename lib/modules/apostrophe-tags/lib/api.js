const _ = require('lodash');

module.exports = function(self, options) {
  // Obtain a list of tags beginning with `options.prefix`, or containing
  // `options.contains`, or all tags if `options.all` is set, or specific tags
  // if `options.tags` is set. On success, returns an array of tags.
  //
  // `options.tags` is useful because tags may no longer be available and
  // this is one way to filter out removed tags.

  self.listTags = async function(req, options) {
    options = options || {};

    const criteria = {};
    if (options.prefix && options.prefix.length) {
      criteria.tags = new RegExp('^' + self.apos.utils.regExpQuote(options.prefix));
    } else if (options.contains && options.contains.length) {
      criteria.tags = new RegExp(self.apos.utils.regExpQuote(options.contains));
    } else if (options.all) {
      // Get all the documents, no criteria needed.
    } else if (options.tags) {
      criteria.tags = { $in: options.tags };
    }

    // This logic makes it so we can only retrieve (and thus autocomplete)
    // tags that are saved in the 'tags' field of docs. Should we instead,
    // on startup, walk the schema to find all tag fields and construct
    // a query from that? That might need to be multiple queries though,
    // which could be a performance hit. Worthy of further consideration - Jimmy
    let tags = await self.apos.docs.find(req, criteria).toDistinct('tags');
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
    const results = _.filter(tags, function(tag) {
      return tag !== null && tag !== undefined;
    });
    results.sort();
    return results;
  };

  // Add a tag, as submitted via the tags admin interface. Other modules
  // do not need to call this method; they can just add the tag to the
  // `tags` property of any doc.

  self.addTag = async function(req, tag) {
    const piece = {
      title: tag,
      slug: self.apos.utils.slugify('tag-' + tag),
      tags: [ tag ],
      published: true
    };
    return self.insert(req, piece);
  };

  // Rename an existing tag throughout Apostrophe.

  self.renameTag = async function(req, tag, newTag) {
    const criteria = { tags: { $in: [ tag ] } };
    await self.apos.docs.db.update(criteria, { $addToSet: { tags: newTag } }, { multi: true });
    await self.apos.docs.db.update(criteria, { $pull: { tags: tag } }, { multi: true });
    const piece = await self.find(req, { slug: self.apos.utils.slugify('tag-' + tag) })
      .toObject();
    if (piece) {
      piece.title = newTag;
      piece.slug = self.apos.utils.slugify('tag-' + newTag);
      return self.update(req, { _id: piece._id });
    }
  };

  // Delete an existing tag throughout Apostrophe.

  self.deleteTag = async function(req, tag) {
    const criteria = { tags: { $in: [ tag ] } };
    await self.apos.docs.db.update(criteria, { $pull: { tags: tag } }, { multi: true });
    const piece = await self.find(req, { slug: self.apos.utils.slugify('tag-' + tag) }).toObject();
    if (piece) {
      return self.apos.docs.db.remove({ _id: piece._id });
    }
  };

  // Launder (sanitize) a tag. The default behavior is to call the
  // `filterTag` method of `launder`, which converts to lowercase and
  // trims whitespace.
  //
  // Fair warning: if you disable conversion to a consistent case, you will have
  // a lot more trouble with duplicate tags.

  self.launder = function(tag) {
    return self.apos.launder.filterTag(self.apos.launder.string(tag));
  };

};
