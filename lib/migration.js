var async = require('async');
var _ = require('lodash');
var extend = require('extend');
var moment = require('moment');
var fs = require('fs');

/**
 * migration
 * @augments Augments the apos object with methods for
 * adding migrations to be run by the apostrophe:migrate task.
 */

module.exports = function(self) {
  self._migrations = {};

  // Add a migration method to be invoked when the
  // apostrophe:migrate task is run. Migrations are run
  // in the order registered. If a migration has been
  // run before for this database, it is not run again.
  // Migrations are not for routine cleanup, use a separate
  // task for that.
  //
  // Migrations MUST tolerate being run more than once with
  // NO ill effects.
  //
  // All migrations WILL run once on brand-new sites the first
  // time the task is run.
  //
  // The cache check which eliminates running a migration
  // again based on its name should be regarded as a
  // performance optimization only.
  //
  // The `options` object is not required.
  //
  // if your migration is time-consuming, and is also safe to run
  // while a previous deployment of the site is already up, set
  // `options.safe` to `true`. This allows it to be run by
  // `apostrophe:migrate --safe`, which is run before
  // the previous deployment is shut down. This shortens
  // downtime during deployments.
  //
  // Your function is invoked with a callback, which expects
  // the usual err parameter. If you do not do any asynchronous
  // work, then you MUST wait until next tick before invoking the
  // callback or use setImmediate(callback).

  self.addMigration = function(name, fn, options) {
    self._migrations[name] = { fn: fn, options: options || {} };
  };

  // Perform all migrations when the apostrophe:migrate task is run
  self.migrate = function(argv, callback) {
    console.log('Migrating...');
    var cache = self.getCache('migrations');
    return async.eachSeries(_.keys(self._migrations), function(name, migrationCallback) {

      if (argv['force-one'] && (argv['force-one'] !== name)) {
        return setImmediate(migrationCallback);
      }

      var migration = self._migrations[name];

      if (argv.safe && (!migration.options.safe)) {
        return setImmediate(migrationCallback);
      }

      return async.series({
        cacheCheck: function(callback) {
          if (argv.force || argv['force-one']) {
            // Run them all if --force is specified
            return setImmediate(callback);
          }
          return cache.get(name, function(err, val) {
            if (err) {
              console.log(err);
              return callback(err);
            }
            if (val) {
              return setImmediate(migrationCallback);
            }
            // Cache miss
            return setImmediate(callback);
          });
        },
        runMigration: function(callback) {
          console.log('Running migration: ' + name);
          return migration.fn(callback);
        },
        cacheSet: function(callback) {
          return cache.set(name, true, callback);
        }
      }, migrationCallback);
    }, function(err) {
      if (!err) {
        console.log('Done.');
      }
      return callback(err);
    });
  };

  // Add the core migrations now so they get on the list before
  // any module and project-specific migrations

  self.addMigration('addTrash', function addTrash(callback) {
    // ISSUE: old sites might not have a trashcan page as a parent for trashed pages.
    self.pages.findOne({ type: 'trash', trash: true }, function (err, trash) {
      if (err) {
        return callback(err);
      }
      if (!trash) {
        console.log('No trash, adding it');
        return self.insertSystemPage({
          _id: 'trash',
          path: 'home/trash',
          slug: '/trash',
          type: 'trash',
          title: 'Trash',
          // Max home page direct kids on one site: 1 million. Max special
          // purpose admin pages: 999. That ought to be enough for
          // anybody... I hope!
          rank: 1000999,
          trash: true,
        }, callback);
      }
      return callback(null);
    });
  });

  self.addMigration('trimTitle', function trimTitle(callback) {
    return self.forEachPage({ $or: [ { title: /^ / }, { title: / $/ } ] },
      function(page, callback) {
        return self.pages.update(
          { _id: page._id },
          { $set: { title: page.title.trim() } },
          callback);
      },
      callback);
  });

  self.addMigration('trimSlug', function trimSlug(callback) {
    return self.forEachPage({ $or: [ { slug: /^ / }, { slug: / $/ } ] },
      function(page, callback) {
        return self.pages.update(
          { _id: page._id },
          { $set: { slug: page.slug.trim() } },
          callback);
      },
      callback);
  });

  self.addMigration('fixSortTitle', function fixSortTitle(callback) {
    return self.forEachPage({ $or: [ { sortTitle: { $exists: 0 } }, { sortTitle: /^ / }, { sortTitle: / $/} ] },
      function(page, callback) {
        if (!page.title) {
          // Virtual pages will do this. Don't crash.
          return callback(null);
        }
        return self.pages.update(
          { _id: page._id },
          { $set: { sortTitle: self.sortify(page.title.trim()) } },
          callback);
      },
      callback);
  });

  // A2 uses plain strings as IDs. This allows true JSON serialization and
  // also allows known IDs to be used as identifiers which simplifies writing
  // importers from other CMSes. If someone who doesn't realize this plorps a lot
  // of ObjectIDs into the pages collection by accident, clean up the mess.

  self.addMigration('fixObjectId', function fixObjectId(callback) {
    return self.forEachPage({},
      function(page, callback) {
        var id = page._id;
        // Convert to an actual hex string, see if that makes it different, if so
        // save it with the new hex string as its ID. We have to remove and reinsert
        // it, unfortunately.
        page._id = id.toString();
        if (id !== page._id) {
          return self.pages.remove({ _id: id }, function(err) {
            if (err) {
              return callback(err);
            }
            return self.pages.insert(page, callback);
          });
        } else {
          return callback(null);
        }
      },
      callback
    );
  });

  self.addMigration('explodePublishedAt', function explodePublishedAt(callback) {
    // the publishedAt property of articles must also be available in
    // the form of two more easily edited fields, publicationDate and
    // publicationTime
    var used = false;
    self.forEachPage({ type: 'blogPost' }, function(page, callback) {
      if ((page.publishedAt !== undefined) && (page.publicationDate === undefined)) {
        if (!used) {
          console.log('setting publication date and time for posts');
          used = true;
        }
        page.publicationDate = moment(page.publishedAt).format('YYYY-MM-DD');
        page.publicationTime = moment(page.publishedAt).format('HH:mm');
        return self.pages.update(
          { _id: page._id },
          { $set: { publicationDate: page.publicationDate, publicationTime: page.publicationTime } },
          callback);
      } else {
        return callback(null);
      }
    }, callback);
  });

  self.addMigration('missingImageData', function missingImageMetadata(callback) {
    var n = 0;
    return self.forEachFile({ $or: [
        { md5: { $exists: 0 } },
        { $and:
          [
            { extension: { $in: [ 'jpg', 'gif', 'png' ] } },
            { width: { $exists: 0 } }
          ]
        }
      ] }, function(file, callback) {
      var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
      var tempFile = self.uploadfs.getTempPath() + '/' + self.generateId() + '.' + file.extension;
      n++;
      if (n === 1) {
        console.log('Adding metadata for files (may take a while)...');
      }
      async.series([
        function(callback) {
          self.uploadfs.copyOut(originalFile, tempFile, callback);
        },
        function(callback) {
          return self.md5File(tempFile, function(err, result) {
            if (err) {
              return callback(err);
            }
            file.md5 = result;
            return callback(null);
          });
        },
        function(callback) {
          if (_.contains(['gif', 'jpg', 'png'], file.extension) && (!file.width)) {
            return self.uploadfs.identifyLocalImage(tempFile, function(err, info) {
              if (err) {
                return callback(err);
              }
              file.width = info.width;
              file.height = info.height;
              if (file.width > file.height) {
                file.landscape = true;
              } else {
                file.portrait = true;
              }
              return callback(null);
            });
          } else {
            return callback(null);
          }
        },
        function(callback) {
          self.files.update({ _id: file._id }, file, { safe: true }, callback);
        },
        function(callback) {
          fs.unlink(tempFile, callback);
        }
      ], function(err) {
        if (err) {
          // Don't give up completely if a file is gone or bad
          console.log('WARNING: error on ' + originalFile);
        }
        return callback(null);
      });
    }, callback);
  });

  self.addMigration('missingFileSearch', function missingFileSearch(callback) {
    var n = 0;
    return self.forEachFile({ searchText: { $exists: 0 } }, function(file, callback) {
      n++;
      if (n === 1) {
        console.log('Adding searchText to files...');
      }
      file.searchText = self.fileSearchText(file);
      self.files.update({ _id: file._id }, file, callback);
    }, callback);
  });

  // If there are any pages whose tags property is defined but set
  // to null, due to inadequate sanitization in the snippets module,
  // fix them to be empty arrays so templates don't crash
  self.addMigration('fixNullTags', function fixNullTags(callback) {
    return self.pages.findOne({ $and: [ { tags: null }, { tags: { $exists: true } } ] }, function(err, page) {
      if (err) {
        return callback(err);
      }
      if (!page) {
        return callback(null);
      }
      console.log('Fixing pages whose tags property is defined and set to null');
      return self.pages.update({ $and: [ { tags: null }, { tags: { $exists: true } } ] }, { $set: { tags: [] }}, { multi: true }, callback);
    });
  });

  // Tags that are numbers can be a consequence of an import.
  // Clean that up so they match regexes properly.
  self.addMigration('fixNumberTags', function fixNumberTags(callback) {
    return self.pages.distinct("tags", {}, function(err, tags) {
      if (err) {
        return callback(err);
      }
      return async.eachSeries(tags, function(tag, callback) {
        if (typeof(tag) === 'number') {
          return self.forEachPage({ tags: { $in: [ tag ] } }, function(page, callback) {
            page.tags = _.without(page.tags, tag);
            page.tags.push(tag.toString());
            return self.pages.update({ slug: page.slug }, { $set: { tags: page.tags } }, callback);
          }, callback);
        } else {
          return callback(null);
        }
      }, callback);
    });
  });

  self.addMigration('fixTimelessEvents', function fixTimelessEvents(callback) {
    var used = false;
    return self.forEachPage({ type: 'event' }, function(page, callback) {
      if ((page.startTime === null) || (page.endTime === null)) {
        // We used to construct these with just the date, which doesn't
        // convert to GMT, so the timeless events were someodd hours out
        // of sync with the events that had explicit times
        var start = new Date(page.startDate + ' ' + ((page.startTime === null) ? '00:00:00' : page.startTime));
        var end = new Date(page.endDate + ' ' + ((page.endTime === null) ? '00:00:00' : page.endTime));
        if ((page.start.getTime() !== start.getTime()) || (page.end.getTime() !== end.getTime())) {
          if (!used) {
            console.log('Fixing timeless events');
          }
          used = true;
          return self.pages.update({ _id: page._id }, { $set: { start: start, end: end } }, { safe: true }, callback);
        } else {
          return callback(null);
        }
      } else {
        return callback(null);
      }
    }, callback);
  });

  // Moved page rank of trash and search well beyond any reasonable
  // number of legit kids of the home page
  self.addMigration('moveTrash', function moveTrash(callback) {
    return self.pages.findOne({ type: 'trash' }, function(err, page) {
      if (!page) {
        return callback(null);
      }
      if (page.rank !== 1000999) {
        page.rank = 1000999;
        return self.pages.update({ _id: page._id }, page, callback);
      }
      return callback(null);
    });
  });

  self.addMigration('moveSearch', function moveSearch(callback) {
    return self.pages.findOne({ type: 'search' }, function(err, page) {
      if (!page) {
        return callback(null);
      }
      if (page.path !== 'home/search') {
        // This is some strange search page we don't know about and
        // probably shouldn't tamper with
        return callback(null);
      }
      if (page.rank !== 1000998) {
        page.rank = 1000998;
        return self.pages.update({ _id: page._id }, page, callback);
      }
      return callback(null);
    });
  });

  // This migration was argv dependent which was a bad idea.
  // There should be no projects left which need it

  // self.addMigration('fixButtons', function fixButtons(callback) {
  //   var count = 0;
  //   // There was briefly a bug in our re-normalizer where the hyperlink and
  //   // hyperlinkTitle properties were concerned. We can fix this, but
  //   // we can't detect whether the fix is necessary, and we don't want
  //   // to annoy people who have gone on with their lives and deliberately
  //   // removed hyperlinks. So we do this only if --fix-buttons is on the
  //   // command line

  //   if (!argv['fix-buttons']) {
  //     return callback(null);
  //   }
  //   return self.forEachItem(function(page, name, area, n, item, callback) {
  //     self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
  //     if (!_.contains(self.slideshowTypes, item.type)) {
  //       return callback(null);
  //     }
  //     var ids = [];
  //     var extras = {};
  //     if (!item.legacyItems) {
  //       // This was created after the migration we're fixing so it's OK
  //       return callback(null);
  //     }
  //     count++;
  //     if (count === 1) {
  //       console.log('Fixing buttons damaged by buggy normalizer');
  //     }
  //     var interesting = 0;
  //     async.each(item.legacyItems, function(file, callback) {
  //       ids.push(file._id);
  //       var extra = {};
  //       extra.hyperlink = file.hyperlink;
  //       extra.hyperlinkTitle = file.hyperlinkTitle;
  //       if (extra.hyperlink || extra.hyperlinkTitle) {
  //         extras[file._id] = extra;
  //         interesting++;
  //       }
  //       return callback(null);
  //     }, function(err) {
  //       if (err) {
  //         return callback(err);
  //       }
  //       item.extras = extras;
  //       if (!interesting) {
  //         return callback(null);
  //       }
  //       var value = { $set: {} };
  //       // ♥ dot notation
  //       value.$set[name + '.items.' + n + '.extras'] = item.extras;
  //       return self.pages.update({ _id: page._id }, value, callback);
  //     });
  //   }, callback);
  // });

  // This migration was argv dependent which was a bad idea.
  // There should be no projects left which need it

  // self.addMigration('fixCrops', function fixCrops(callback) {
  //   var count = 0;
  //   // There was briefly a bug in our re-normalizer where the hyperlink and
  //   // hyperlinkTitle properties were concerned. We can fix this, but
  //   // we can't detect whether the fix is necessary, and we don't want
  //   // to annoy people who have gone on with their lives and deliberately
  //   // redone crops. So we do this only if --fix-crops is on the
  //   // command line

  //   if (!argv['fix-crops']) {
  //     return callback(null);
  //   }
  //   return self.forEachItem(function(page, name, area, n, item, callback) {
  //     self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
  //     if (!_.contains(self.slideshowTypes, item.type)) {
  //       return callback(null);
  //     }
  //     var ids = [];
  //     var extras = {};
  //     if (!item.legacyItems) {
  //       // This was created after the migration we're fixing so it's OK
  //       return callback(null);
  //     }
  //     count++;
  //     if (count === 1) {
  //       console.log('Fixing crops damaged by buggy normalizer');
  //     }
  //     var interesting = 0;
  //     async.each(item.legacyItems, function(file, callback) {
  //       var value;
  //       if (file.crop) {
  //         var extra = item.extras[file._id];
  //         if (!extra) {
  //           extra = {};
  //         }
  //         if (!extra.crop) {
  //           extra.crop = file.crop;
  //           value = { $set: {} };
  //           value.$set[name + '.items.' + n + '.extras.' + file._id] = extra;
  //           return self.pages.update({ _id: page._id }, value, callback);
  //         }
  //       }
  //       return callback(null);
  //     }, callback);
  //   }, callback);
  // });

  self.addMigration('normalizeFiles', function normalizeFiles(callback) {
    var count = 0;
    // We used to store denormalized copies of file objects in slideshow
    // widgets. This made it difficult to tell if a file was in the trash.
    // At some point we might bring it back but only if we have a scheme
    // in place to keep backreferences so the denormalized copies can be
    // efficiently found and updated.
    //
    // Migrate the truly slideshow-specific parts of that data to
    // .ids and .extras, and copy any titles and descriptions and credits
    // found in .items to the original file object (because they have
    // been manually edited and should therefore be better than what is in
    // the global object).
    //
    // This means two placements can't have different titles, but that
    // feature was little used and only lead to upset when users couldn't
    // change the title globally for an image.
    return self.forEachItem(function(page, name, area, n, item, callback) {
      self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
      if (!_.contains(self.slideshowTypes, item.type)) {
        return callback(null);
      }
      if (item.ids) {
        // Already migrated
        return callback(null);
      }
      var ids = [];
      var extras = {};
      count++;
      if (count === 1) {
        console.log('Normalizing file references in slideshows etc.');
      }
      async.each(item.items || [], function(file, callback) {
        ids.push(file._id);
        var extra = {};
        item.showTitles = !!(item.showTitles || (file.title));
        item.showCredits = !!(item.showCredits || (file.credit));
        item.showDescriptions = !!(item.showDescriptions || (file.description));
        extra.hyperlink = file.hyperlink;
        extra.hyperlinkTitle = file.hyperlinkTitle;
        extra.crop = file.crop;
        extras[file._id] = extra;
        if (!(file.title || file.credit || file.description)) {
          return callback(null);
        }
        // Merge the metadata found in this placement back to
        // the global file object
        return self.files.findOne({ _id: file._id }, function(err, realFile) {
          if (err) {
            return callback(err);
          }
          if (!realFile) {
            return callback(null);
          }
          if ((file.title === realFile.title) && (file.description === realFile.description) && (file.credit === realFile.credit)) {
            // We have values but they are not more exciting than what's
            // already in the file object
            return callback(null);
          }
          var value = { $set: {} };
          if (file.title) {
            value.$set.title = file.title;
          }
          if (file.description) {
            value.$set.description = file.description;
          }
          if (file.credit) {
            value.$set.credit = file.credit;
          }
          return self.files.update({ _id: file._id }, value, callback);
        });
      }, function(err) {
        if (err) {
          return callback(err);
        }
        item.ids = ids;
        item.extras = extras;
        // Just in case we didn't get this migration quite so right
        item.legacyItems = item.items;
        // Removed so we don't keep attempting this migration and
        // smooshing newer data
        delete item.items;
        var value = { $set: {} };
        // ♥ dot notation
        value.$set[name + '.items.' + n] = item;
        return self.pages.update({ _id: page._id }, value, callback);
      });
    }, callback);
  });

  self.addMigration('migrateTypeSettings', function migrateTypeSettings(callback) {
    return self.forEachPage({ typeSettings: { $exists: 1 } }, function(page, callback) {
      page.preMigrationTypeSettings = page.typeSettings;
      // Avoid conflict with the tags of the page itself
      if (_.has(page.typeSettings, 'tags')) {
        page.typeSettings.withTags = page.typeSettings.tags;
        delete page.typeSettings.tags;
      }
      extend(true, page, page.typeSettings);
      delete page.typeSettings;
      return self.pages.update({ _id: page._id }, page, callback);
    }, callback);
  });

  // function unmigrateAreas(callback) {
  //   return self.forEachPage({ preMigrationAreas: { $exists: 1 } }, function(page, callback) {
  //     page.areas = page.preMigrationAreas;
  //     console.log('unmigrating areas for ' + page.slug);
  //     return self.pages.update({ _id: page._id }, page, callback);
  //   }, callback);
  // }

  self.addMigration('migrateAreas', function migrateAreas(callback) {
    return self.forEachPage({ areas: { $exists: 1 } }, function(page, callback) {
      page.preMigrationAreas = page.areas;
      _.extend(page, page.areas);
      _.each(page.areas, function(val, key) {
        page[key].type = 'area';
      });
      delete page.areas;
      console.log('migrating areas for ' + page.slug);
      return self.pages.update({ _id: page._id }, page, callback);
    }, callback);
  });

  self.addMigration('addPermissionsProperty', function addPermissionsProperty(callback) {
    var needed = false;
    var silos = [
      {
        name: 'viewPersonIds',
        privilege: 'view'
      },
      {
        name: 'viewGroupIds',
        privilege: 'view'
      },
      {
        name: 'editPersonIds',
        privilege: 'edit'
      },
      {
        name: 'editGroupIds',
        privilege: 'group'
      }
    ];

    var or = [];

    var legacyPermissions = {};

    _.each(silos, function(silo) {
      var clause = {};
      clause[silo.name] = { $exists: 1 };
      or.push(clause);
    });
    return self.forEachPage({ $or: or }, function(page, callback) {
      var unset = {};
      if (!needed) {
        needed = true;
        console.log('migrating pagePermissions information to new pagePermissions property');
      }

      var pagePermissions = [];
      _.each(silos, function(silo) {
        legacyPermissions[silo.name] = page[silo.name];
        unset[silo.name] = 1;
        _.each(page[silo.name], function(id) {
          pagePermissions.push(silo.privilege + '-' + id);
        });
      });
      return self.pages.update({ _id: page._id }, { $set: { legacyPermissions: legacyPermissions, pagePermissions: pagePermissions }, $unset: unset }, callback);
    }, callback);
  });

  self.addMigration('fixStringifiedAreas', function(callback) {
    // Somehow we managed to get some areas whose "items" property is
    // an array of characters which, if joined, are a JSON
    // representation of what we should have had in "items"
    self.forEachArea(function(page, areaName, area, callback) {
      var used = false;
      if (area.items && area.items[0] === '[') {
        area.items = JSON.parse(area.items.join(''));
        var set = {};
        set[areaName + '.items'] = area.items;
        used = true;
        console.log('Fixing stringified areas...');
        return self.pages.update({ _id: page._id }, { $set: set }, callback);
      }
      return setImmediate(callback);
    }, callback);
  });

  // Do this again, because we mucked it up the first time by
  // not making the words unique
  self.addMigration('addHighSearchWordsUniquely', function addHighSearchWords(callback) {
    var needed = false;
    return self.forEachPage({ highSearchText: { $exists: 1 }, highSearchWords: { $exists: 0 } }, function(page, callback) {
      if (!needed) {
        needed = true;
        console.log('Adding highSearchWords index for fast autocomplete');
      }
      page.highSearchWords = _.uniq(page.highSearchText.split(/ /));
      return self.pages.update({ _id: page._id }, { $set: { highSearchWords: page.highSearchWords } }, callback);
    }, callback);
  });

  // Do this again, because we mucked it up the first time by
  // not making the words unique
  self.addMigration('pruneTemporaryProperties', function addHighSearchWords(callback) {
    var needed = false;
    return self.forEachPage({}, function(page, callback) {
      if (!needed) {
        needed = true;
        console.log('Pruning temporary properties of legacy pages...');
      }
      self.pruneTemporaryProperties(page);
      return self.pages.update({ _id: page._id }, page, callback);
    }, callback);
  });

  // multi: true was missing from the logic for making sure
  // descendants of a page in the trash are also marked as trash
  self.addMigration('recursiveTrash', function addHighSearchWords(callback) {
    return self.pages.findOne({ path: /^home\/trash\//, trash: { $exists: 0 } }, function(err, badTrash) {
      if (err) {
        return callback(err);
      }
      if (!badTrash) {
        return callback(null);
      }
      console.log('Marking all descendants of trashcan as trash');
      return self.pages.update({ path: /^home\/trash\// }, { $set: { trash: true } }, { multi: true }, callback);
    });
  });

  self.addMigration('videoType', function addVideoType(callback) {
    var needed = false;
    return self.forEachDocumentInCollection(self.videos, { type: { $exists: 0 } }, function(video, callback) {
      if (!needed) {
        needed = true;
        console.log('Adding type property to videos');
      }
      return self.videos.update({ _id: video._id }, { $set: { type: 'video' } }, callback);
    }, callback);
  });

  self.addMigration('removeVideoSearchTextIndex', function removeVideoSearchTextIndex(callback) {
    // This index was a dumb idea. It can't be used
    // (it would have to be a $text index to work), and
    // it imposes a hard cap on the length of the searchText,
    // crashing FM import
    return self.videos.dropIndex({ searchText: 1 }, function(err) {
      // Unfortunately you can't reliably distinguish due to
      // the lack of an error code, but this usually means the
      // index was already removed. That can happen because
      // A2 does not guarantee migrations won't run again.
      // So just allow it. -Tom
      return callback(null);
    });
  });

  self.addMigration('addSearchBoostToTextIndex', function addSearchBoostToTextIndex(callback) {
    // This first call will fail if the indexable properties
    // have changed
    return self.ensureTextIndex(function(err) {
      if (!err) {
        return callback(null);
      }
      console.log('Dropping and recreating text index to account for new searchable fields...');
      var info;
      return async.series({
        info: function(callback) {
          return self.pages.indexInformation(function(err, _info) {
            if (err) {
              return callback(err);
            }
            info = _info;
            return callback(null);
          });
        },
        drop: function(callback) {
          var key;
          _.each(info, function(val, _key) {
            if (_.some(val, function(field) {
              return field[1] === 'text';
            })) {
              key = _key;
              return false;
            }
          });
          if (!key) {
            console.error('Unable to ensure text index, but there is no existing one. Stumped.');
            return callback('notfound');
          }
          console.log('Dropping an obsolete text index...');
          return self.pages.dropIndex(key, callback);
        },
        retry: function(callback) {
          console.log('Creating a new text index...');
          return self.ensureTextIndex(callback);
        }
      }, callback);
    });
  });

  self.addMigration('addSortName', function sortName(callback) {
    var used = false;
    return self.forEachPage({ type: 'person', sortFirstName: { $exists: 0 } }, function(page, callback) {
      if (!used) {
        used = true;
        console.log('Adding case insensitive denormalization of first and last name');
      }
      return self.pages.update({
        _id: page._id
      }, {
        $set: {
          sortFirstName: self.sortify(page.firstName) || null,
          sortLastName: self.sortify(page.lastName) || null
        }
      }, callback);
    }, callback);
  }, { safe: true });
};
