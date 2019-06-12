module.exports = function(self, options) {

  self.apiRoute('post', 'lock', async function(req) {
    await self.lock(
      req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId,
      {
        force: !!req.body.force
      }
    );
  });

  self.apiRoute('post', 'verify-lock', async function(req) {
    await self.verifyLock(
      req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId
    );
  });

  self.apiRoute('post', 'unlock', async function(req) {
    await self.unlock(
      req,
      self.apos.launder.id(req.body._id),
      req.htmlPageId
    );
  });

  // Determine if a particular slug is available. Since the slug namespace
  // is shared by all doc types, you only need to be a user to access this
  // route. No other information about the document with that slug is returned
  self.apiRoute('post', 'slug-taken', async function(req) {
    if (!req.user) {
      throw 'notfound';
    }
    const slug = self.apos.launder.string(req.body.slug);
    const _id = self.apos.launder.id(req.body._id);
    const criteria = {
      slug: slug
    };
    if (_id) {
      criteria._id = { $ne: _id };
    }
    const doc = await self.find(req, criteria).permission(false).trash(null).published(null).projection({ slug: 1 }).toObject();
    if (doc) {
      return {
        status: 'taken'
      };
    } else {
      return {
        status: 'ok'
      };
    }
  });

  self.apiRoute('post', 'deduplicate-slug', async function(req) {
    if (!req.user) {
      throw 'notfound';
    }
    const _id = self.apos.launder.id(req.body._id);
    let slug = self.apos.launder.string(req.body.slug);
    let counter = 1;
    let suffix = '';
    slug = await deduplicate(slug);
    return {
      status: 'ok',
      slug: slug
    };

    async function deduplicate(slug) {
      const criteria = {
        slug: slug
      };
      if (_id) {
        criteria._id = { $ne: _id };
      }
      const doc = await self.find(req, criteria).permission(false).trash(null).published(null).projection({ slug: 1 }).toObject();
      if (doc) {
        counter++;
        suffix = '-' + counter;
        slug = slug.replace(/-\d+$/, '') + suffix;
        return deduplicate(slug);
      } else {
        return slug;
      }
    }
  });
};
