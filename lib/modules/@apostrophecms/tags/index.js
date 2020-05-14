const _ = require('lodash');
// The `@apostrophecms/tags` module provides administration tools for managing
// tags on the site. This module subclasses pieces in order to provide a way
// to store tags that were created directly in the tag administration interface
// and do not appear on any other types of pieces yet. This ensures that they
// are visible when autocompleting tags.

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'tags',
    name: 'tag',
    label: 'Tag',
    adminOnly: true
  },
  init(self, options) {
    self.routes = {};
  },
  methods(self, options) {
    return {
      // Obtain a list of tags beginning with `options.prefix`, or containing
      // `options.contains`, or all tags if `options.all` is set, or specific tags
      // if `options.tags` is set. On success, returns an array of tags.
      //
      // `options.tags` is useful because tags may no longer be available and
      // this is one way to filter out removed tags.
      async list(req, options) {
        options = options || {};
        const criteria = {};
        if (options.prefix && options.prefix.length) {
          criteria.tags = new RegExp('^' + self.apos.utils.regExpQuote(options.prefix));
        } else if (options.contains && options.contains.length) {
          criteria.tags = new RegExp(self.apos.utils.regExpQuote(options.contains));
        } else if (options.all) {
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
        if (options.prefix && (options.prefix.length || (options.contains && options.contains.length))) {
          tags = _.filter(tags, function (tag) {
            return tag.toString().match(criteria.tags);
          });
        } else if (options.all) {
        } else if (options.tags) {
          tags = _.intersection(options.tags, tags);
        }
        const results = _.filter(tags, function (tag) {
          return tag !== null && tag !== undefined;
        });
        results.sort();
        return results;
      },
      // Add a tag, as submitted via the tags admin interface. Other modules
      // do not need to call this method; they can just add the tag to the
      // `tags` property of any doc.
      async add(req, tag) {
        const piece = {
          title: tag,
          slug: self.apos.utils.slugify('tag-' + tag),
          tags: [tag],
          published: true
        };
        return self.insert(req, piece);
      },
      // Rename an existing tag throughout Apostrophe.
      async rename(req, tag, newTag) {
        const criteria = { tags: { $in: [tag] } };
        await self.apos.docs.db.updateMany(criteria, { $addToSet: { tags: newTag } });
        await self.apos.docs.db.updateMany(criteria, { $pull: { tags: tag } });
        const piece = await self.find(req, { slug: self.apos.utils.slugify('tag-' + tag) }).toObject();
        if (piece) {
          piece.title = newTag;
          piece.slug = self.apos.utils.slugify('tag-' + newTag);
          return self.update(req, { _id: piece._id });
        }
      },
      // Delete an existing tag throughout Apostrophe.
      async delete(req, tag) {
        const criteria = { tags: { $in: [tag] } };
        await self.apos.docs.db.updateMany(criteria, { $pull: { tags: tag } });
        const piece = await self.find(req, { slug: self.apos.utils.slugify('tag-' + tag) }).toObject();
        if (piece) {
          return self.apos.docs.db.deleteMany({ _id: piece._id });
        }
      },
      // Launder (sanitize) a tag. The default behavior is to call the
      // `filterTag` method of `launder`, which converts to lowercase and
      // trims whitespace.
      //
      // Fair warning: if you disable conversion to a consistent case, you will have
      // a lot more trouble with duplicate tags.
      launder(tag) {
        return self.apos.launder.filterTag(self.apos.launder.string(tag));
      }
    };
  },
  apiRoutes(self, options) {
    return {
      async all(req) {
        const options = {
          contains: self.launder(req.body.contains),
          prefix: self.launder(req.body.prefix),
          tags: self.apos.launder.tags(req.body.tags),
          all: self.apos.launder.boolean(req.body.all)
        };
        const data = {};
        data.tags = await self.list(req, options);
        return data;
      },
      getOne(req, id) {
        self.apiRoute('post', 'list', self.routes.listTags);
        self.apiRoute('post', 'add', self.routes.addTag);
        self.apiRoute('post', 'rename', self.routes.renameTag);
        self.apiRoute('post', 'delete', self.routes.deleteTag);
      },
      // API returns an object with a `tags` array property.
      //
      // You may filter the list via `req.body.contains`,
      // `req.body.prefix`, `req.body.tags` (which will return
      // the same tags, less any that no longer exist in
      // the system) or `req.body.all` (the default).
      //
      // Useful for "manage tags" implementations and for
      // autocomplete.
      async listTags(req) {
      },
      // Adds the tag in `req.body.tag` if it does not already exist.
      async addTag(req) {
        const tag = self.launder(req.body.tag);
        if (!tag.length) {
          throw self.apos.error('invalid');
        }
        await self.emit('beforeAddTag', req, tag);
        await self.addTag(req, tag);
        await self.emit('afterAddTag', req, tag);
      },
      // Renames `req.body.tag` to `req.body.newTag`.
      async renameTag(req, res) {
        let tag = self.launder(req.body.tag);
        let newTag = self.launder(req.body.newTag);
        if (!tag.length || !newTag.length) {
          throw self.apos.error('invalid');
        }
        await self.emit('beforeRenameTag', req, tag, newTag);
        await self.renameTag(req, tag, newTag);
        await self.emit('afterRenameTag', req, tag, newTag);
      },
      // Deletes tag specified by `req.body.tag`.
      async deleteTag(req) {
        const tag = self.launder(req.body.tag);
        if (!tag.length) {
          throw self.apos.error('invalid');
        }
        await self.emit('beforeDeleteTag', req, tag);
        await self.deleteTag(req, tag);
        await self.emit('afterDeleteTag', req, tag);
      }
    };
  },
  helpers(self, options) {
    return {
      menu: function () {
        return self.partial('menu', { options: options });
      }
    };
  }
};
