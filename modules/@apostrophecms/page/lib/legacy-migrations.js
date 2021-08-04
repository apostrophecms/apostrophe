// Migrations relevant only to those who used early alpha and beta versions of 3.x
// are kept here for tidiness

module.exports = (self) => {
  return {
    addLegacyMigrations() {
      self.addDeduplicateRanksMigration();
      self.addFixHomePagePathMigration();
      self.addMissingLastTargetIdAndPositionMigration();
      self.addArchivedMigration();
    },
    addArchivedMigration() {
      self.apos.migration.add('rename-trash-to-archived', async () => {
        await self.apos.doc.db.updateMany({
          trash: {
            $ne: true
          },
          archived: {
            $exists: 0
          }
        }, {
          $set: {
            archived: false
          },
          $unset: {
            trash: 1
          }
        });
        await self.apos.doc.db.updateMany({
          trash: true,
          archived: {
            $exists: 0
          }
        }, {
          $set: {
            archived: true
          },
          $unset: {
            trash: 1
          }
        });
        await self.apos.doc.db.updateMany({
          parkedId: 'trash'
        }, {
          $set: {
            parkedId: 'archive',
            type: '@apostrophecms/archive-page',
            title: 'Archive'
          }
        });
        await self.apos.migration.eachDoc({
          slug: /^\/trash(\/|$)/,
          archived: true
        }, async doc => {
          return self.apos.doc.db.updateOne({
            _id: doc._id
          }, {
            $set: {
              slug: doc.slug.replace('/trash', '/archive')
            }
          });
        });
      });
    },
    addDeduplicateRanksMigration() {
      self.apos.migration.add('deduplicate-archive-rank', async () => {
        const tabs = await self.apos.doc.db.find({
          slug: /^\//,
          level: 1
        }).sort({
          archived: 1,
          rank: 1
        }).toArray();
        for (let i = 0; (i < tabs.length); i++) {
          await self.apos.doc.db.updateOne({
            _id: tabs[i]._id
          }, {
            $set: {
              rank: i
            }
          });
        }
      });
    },
    addFixHomePagePathMigration() {
      self.apos.migration.add('fix-home-page-path', async () => {
        const home = await self.apos.doc.db.findOne({
          slug: '/',
          path: '/',
          level: 0
        });
        if (!home) {
          return;
        }
        return self.apos.doc.db.updateOne({
          _id: home._id
        }, {
          $set: {
            path: home._id.replace(/:.*$/)
          }
        });
      });
    },
    addMissingLastTargetIdAndPositionMigration() {
      self.apos.migration.add('missing-last-target-id-and-position', async () => {
        await self.apos.migration.eachDoc({
          slug: /^\//,
          // Home page should not have them, that's OK
          level: {
            $gte: 0
          },
          aposLastTargetId: {
            $exists: 0
          }
        }, 5, async (doc) => {
          const parentPath = self.getParentPath(doc);
          const parentAposDocId = parentPath.split('/').pop();
          let parentId;
          if (doc.aposLocale) {
            parentId = `${parentAposDocId}:${doc.aposLocale}`;
          } else {
            parentId = parentAposDocId;
          }
          const peerCriteria = {
            path: self.matchDescendants(parentPath),
            level: doc.level
          };
          if (doc.aposLocale) {
            peerCriteria.aposLocale = doc.aposLocale;
          }
          const peers = await self.apos.doc.db.find(peerCriteria).sort({
            rank: 1
          }).project({
            _id: 1
          }).toArray();
          let targetId;
          let position;
          const index = peers.findIndex(peer => peer._id === doc._id);
          if (index === -1) {
            return;
          }
          if (index === 0) {
            targetId = parentId;
            position = 'firstChild';
          } else {
            targetId = peers[index - 1]._id;
            position = 'after';
          }
          return self.apos.doc.db.updateOne({
            _id: doc._id
          }, {
            $set: {
              aposLastTargetId: targetId,
              aposLastPosition: position
            }
          });
        });
      });
    }
  };
};
