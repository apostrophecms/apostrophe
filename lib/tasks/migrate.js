var async = require('async');
var _ = require('underscore');
var argv = require('optimist').argv;
var fs = require('fs');
var moment = require('moment');

// Database migration - perform on deploy to address official database changes and fixes, and
// in dev after updating the Apostrophe modules. You may also tie your own migrations in
// via event listeners

module.exports = function(self, callback) {
  // There shouldn't be anyone left with this issue, and it
  // wasn't an efficient migration.
  //
  // function fixEventEnd(callback) {
  //   // ISSUE: 'end' was meant to be a Date object matching
  //   // end_date and end_time, for sorting and output purposes, but it
  //   // contained start_time instead. Fortunately end_date and end_time are
  //   // authoritative so we can just rebuild it
  //   self.forEachPage({ type: 'event' }, function(event, callback) {
  //     if (event.endTime) {
  //       event.end = new Date(event.endDate + ' ' + event.endTime);
  //     } else {
  //       event.end = new Date(event.endDate + ' 00:00:00');
  //     }
  //     self.pages.update({ _id: event._id }, { $set: { end: event.end }}, function(err, count) {
  //       return callback(err);
  //     });
  //   }, function(err) {
  //     return callback(err);
  //   });
  // }

  function addTrash(callback) {
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
  }

  function trimTitle(callback) {
    return self.forEachPage({ $or: [ { title: /^ / }, { title: / $/ } ] },
      function(page, callback) {
        return self.pages.update(
          { _id: page._id },
          { $set: { title: page.title.trim() } },
          callback);
      },
      callback);
  }

  function trimSlug(callback) {
    return self.forEachPage({ $or: [ { slug: /^ / }, { slug: / $/ } ] },
      function(page, callback) {
        return self.pages.update(
          { _id: page._id },
          { $set: { slug: page.slug.trim() } },
          callback);
      },
      callback);
  }

  function fixSortTitle(callback) {
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
  }

  // A2 uses plain strings as IDs. This allows true JSON serialization and
  // also allows known IDs to be used as identifiers which simplifies writing
  // importers from other CMSes. If someone who doesn't realize this plorps a lot
  // of ObjectIDs into the pages collection by accident, clean up the mess.

  function fixObjectId(callback) {
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
      callback);
  }

  // Reasonably certain we there are no projects left that need
  // this slow migration. -Tom
  //
  // // Early versions of Apostrophe didn't clean up their Unicode word joiner characters
  // // on save. These were present to prevent (Mac?) Chrome from selecting only half the widget
  // // when copying and pasting. To make matters worse, in Windows Chrome they turn out to
  // // show up as "I don't have this in my font" boxes. New versions use the 65279
  // // "zero-width non-break space" character, which is invisible on both platforms. And
  // // in addition they filter it out on save. Filter it out for existing pages on migrate.
  // function removeWidgetSaversOnSave(callback) {
  //   var used = false;
  //   self.forEachPage({},
  //     function(page, callback) {
  //       var modified = false;
  //       _.each(page.areas || [], function(area, name) {
  //         _.each(area.items, function(item) {
  //           if ((item.type === 'richText') && (item.content.indexOf(String.fromCharCode(8288)) !== -1)) {
  //             if (!modified) {
  //               modified = true;
  //               if (!used) {
  //                 used = true;
  //                 console.log('Removing widget-saver unicode characters');
  //               }
  //             }
  //             item.content = globalReplace(item.content, String.fromCharCode(8288), '');
  //           }
  //         });
  //       });
  //       if (modified) {
  //         return self.pages.update({ _id: page._id }, page, callback);
  //       } else {
  //         return callback(null);
  //       }
  //     }, callback
  //   );
  // }

  function explodePublishedAt(callback) {
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
  }

  function missingImageMetadata(callback) {
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
  }

  function missingFileSearch(callback) {
    var n = 0;
    return self.forEachFile({ searchText: { $exists: 0 } }, function(file, callback) {
      n++;
      if (n === 1) {
        console.log('Adding searchText to files...');
      }
      file.searchText = self.fileSearchText(file);
      self.files.update({ _id: file._id }, file, callback);
    }, callback);
  }

  // If there are any pages whose tags property is defined but set
  // to null, due to inadequate sanitization in the snippets module,
  // fix them to be empty arrays so templates don't crash
  function fixNullTags(callback) {
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
  }

  // Tags that are numbers can be a consequence of an import.
  // Clean that up so they match regexes properly.
  function fixNumberTags(callback) {
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
  }

  function fixTimelessEvents(callback) {
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
  }

  // Moved page rank of trash and search well beyond any reasonable
  // number of legit kids of the home page
  function moveTrash(callback) {
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
  }

  function moveSearch(callback) {
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
  }

  function fixButtons(callback) {
    var count = 0;
    // There was briefly a bug in our re-normalizer where the hyperlink and
    // hyperlinkTitle properties were concerned. We can fix this, but
    // we can't detect whether the fix is necessary, and we don't want
    // to annoy people who have gone on with their lives and deliberately
    // removed hyperlinks. So we do this only if --fix-buttons is on the
    // command line

    if (!argv['fix-buttons']) {
      return callback(null);
    }
    return self.forEachItem(function(page, name, area, n, item, callback) {
      self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
      if (!_.contains(self.slideshowTypes, item.type)) {
        return callback(null);
      }
      var ids = [];
      var extras = {};
      if (!item.legacyItems) {
        // This was created after the migration we're fixing so it's OK
        return callback(null);
      }
      count++;
      if (count === 1) {
        console.log('Fixing buttons damaged by buggy normalizer');
      }
      var interesting = 0;
      async.each(item.legacyItems, function(file, callback) {
        ids.push(file._id);
        var extra = {};
        extra.hyperlink = file.hyperlink;
        extra.hyperlinkTitle = file.hyperlinkTitle;
        if (extra.hyperlink || extra.hyperlinkTitle) {
          extras[file._id] = extra;
          interesting++;
        }
        return callback(null);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        item.extras = extras;
        if (!interesting) {
          return callback(null);
        }
        var value = { $set: {} };
        // ♥ dot notation
        value.$set['areas.' + name + '.items.' + n + '.extras'] = item.extras;
        return self.pages.update({ _id: page._id }, value, callback);
      });
    }, callback);
  }

  function fixCrops(callback) {
    var count = 0;
    // There was briefly a bug in our re-normalizer where the hyperlink and
    // hyperlinkTitle properties were concerned. We can fix this, but
    // we can't detect whether the fix is necessary, and we don't want
    // to annoy people who have gone on with their lives and deliberately
    // redone crops. So we do this only if --fix-crops is on the
    // command line

    if (!argv['fix-crops']) {
      return callback(null);
    }
    return self.forEachItem(function(page, name, area, n, item, callback) {
      self.slideshowTypes = self.slideshowTypes || [ 'slideshow', 'marquee', 'files', 'buttons' ];
      if (!_.contains(self.slideshowTypes, item.type)) {
        return callback(null);
      }
      var ids = [];
      var extras = {};
      if (!item.legacyItems) {
        // This was created after the migration we're fixing so it's OK
        return callback(null);
      }
      count++;
      if (count === 1) {
        console.log('Fixing crops damaged by buggy normalizer');
      }
      var interesting = 0;
      async.each(item.legacyItems, function(file, callback) {
        var value;
        if (file.crop) {
          var extra = item.extras[file._id];
          if (!extra) {
            extra = {};
          }
          if (!extra.crop) {
            extra.crop = file.crop;
            value = { $set: {} };
            value.$set['areas.' + name + '.items.' + n + '.extras.' + file._id] = extra;
            return self.pages.update({ _id: page._id }, value, callback);
          }
        }
        return callback(null);
      }, callback);
    }, callback);
  }

  function normalizeFiles(callback) {
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
      if (item.ids || (!item.items)) {
        // Already migrated or otherwise unsuitable
        return callback(null);
      }
      var ids = [];
      var extras = {};
      count++;
      if (count === 1) {
        console.log('Normalizing file references in slideshows etc.');
      }
      async.each(item.items, function(file, callback) {
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
        value.$set['areas.' + name + '.items.' + n] = item;
        return self.pages.update({ _id: page._id }, value, callback);
      });
    }, callback);
  }

  function migrateEventDescrToBody(callback) {
    var used = false;
    return self.forEachPage({ type: 'mapLocation', 'areas.body.items.0.content': 'undefined' }, function(page, callback) {
      page.areas.body = self.textToArea(page.descr || '');
      if (!used) {
        console.log('Migrating plaintext event descriptions to the body area. The descr property will continue to be available as a read only plaintext version for use in map location boxes.');
      }
      used = true;
      return self.pages.update({ _id: page._id }, { $set: { 'areas.body': page.areas.body } }, callback);
    }, callback);
  }

  async.series([ addTrash, moveTrash, moveSearch, trimTitle, trimSlug, fixSortTitle, fixObjectId, explodePublishedAt, missingImageMetadata, missingFileSearch, fixNullTags, fixNumberTags, fixTimelessEvents, normalizeFiles, fixButtons, fixCrops, migrateEventDescrToBody ], function(err) {
    return callback(err);
  });
};

