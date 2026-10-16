// The migrations of a project upgrading to this module: records and
// documents as they were stored before it

const { createId } = require('@paralleldrive/cuid2');

module.exports = (self) => {
  return {
    // Converts the records written before this module: `doc` a plain
    // object, `docId` the document's full `_id`, no `mode`, `locale`,
    // `authorId` or `ai`. The author is the document's `updatedBy`, the
    // user whose save recorded the version. A converted record has `mode`,
    // so a rerun resumes where the last one stopped. Returns the number of
    // records converted.
    async convertLegacyVersions() {
      let converted = 0;
      await self.apos.migration.each(
        self.db,
        { mode: { $exists: false } },
        5,
        async version => {
          const packed = typeof version.doc === 'string';
          const doc = packed
            ? await self.unpack(version.doc)
            : version.doc;
          await self.db.updateOne({ _id: version._id }, {
            $set: {
              ...self.getTimelineCriteria(doc),
              mode: self.getMode(doc),
              authorId: doc.updatedBy?._id ?? null,
              ai: false,
              doc: packed
                ? version.doc
                : await self.pack(doc)
            }
          });
          converted++;
        }
      );
      return converted;
    },
    // Gives Unpublish something to return to right after the upgrade.
    // Before this module the previous publication was kept as a document
    // in `previous` mode, not as a version. For every timeline without a
    // publication point, records what is published now and what its
    // `previous` document holds. Returns the number of records written.
    async seedPublicationPoints() {
      const req = self.apos.task.getReq({ mode: 'published' });
      let seeded = 0;
      await self.apos.migration.each(
        self.apos.doc.db,
        { aposMode: 'published' },
        5,
        async published => {
          if (!self.isVersioned(published) && !self.isPublishedOnly(published)) {
            return;
          }
          const existing = await self.db.countDocuments({
            ...self.getTimelineCriteria(published),
            mode: 'published'
          });
          if (existing) {
            return;
          }
          const stored = await self.apos.doc.db.findOne({
            _id: published._id.replace(':published', ':previous')
          });
          const previous = stored && await asPublishedDoc(stored);
          const publishedAt = publicationTime(published);
          if (previous) {
            await insertPublicationPoint(previous, new Date(Math.min(
              publicationTime(previous).getTime(),
              publishedAt.getTime() - 1
            )));
            seeded++;
          }
          await insertPublicationPoint(published, publishedAt, previous);
          seeded++;
        }
      );
      return seeded;

      // When a document became what it is now. Publication points seeded
      // from documents have no record of their own to date them
      function publicationTime(doc) {
        const at = new Date(doc.lastPublishedAt || doc.updatedAt || doc.createdAt);
        return isNaN(at) ? new Date() : at;
      }

      // A `previous` mode document as the published document it was: its
      // identity restored, and the slug and other conflicting fields back
      // to the values they had while it was live
      async function asPublishedDoc(previous) {
        const manager = self.apos.doc.getManager(previous.type);
        const reduplicated = manager
          ? await manager.getRevertDeduplicationSet(req, previous)
          : null;
        return {
          ...previous,
          ...reduplicated || {},
          _id: previous._id.replace(':previous', ':published'),
          aposLocale: previous.aposLocale.replace(':previous', ':published'),
          aposMode: 'published'
        };
      }

      // Record `doc` as a publication point made at `createdAt`, attributed
      // to whoever last saved it. Counts its changes against `previousDoc`
      // when one is given
      async function insertPublicationPoint(doc, createdAt, previousDoc) {
        const content = self.apos.util.clonePermanent(doc);
        const version = {
          _id: createId(),
          metaType: 'version',
          createdAt,
          docId: doc.aposDocId,
          mode: 'published',
          locale: self.getLocale(doc),
          author: doc.updatedBy?.title || doc.updatedBy?.username || 'SYSTEM',
          authorId: doc.updatedBy?._id ?? null,
          ai: false,
          changeCount: previousDoc
            ? self.getChangeCount(req, content, previousDoc)
            : 0,
          doc: await self.pack(content)
        };
        await self.insert(req, version);
        return self.updateReferencesFor(req, version._id);
      }
    },
    // Drop the `previous` mode documents the store now replaces, releasing
    // the attachment references they hold. Returns the number removed.
    async removePreviousModeDocs() {
      let removed = 0;
      await self.apos.migration.each(
        self.apos.doc.db,
        { aposMode: 'previous' },
        5,
        async doc => {
          await self.apos.attachment.updateDocReferences(doc, { deleted: true });
          await self.apos.doc.db.deleteOne({ _id: doc._id });
          removed++;
        }
      );
      return removed;
    }
  };
};
