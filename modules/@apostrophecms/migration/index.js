const broadband = require('broadband');
const _ = require('lodash');
const addMissingSchemaFields = require('./lib/addMissingSchemaFields.js');

// Provide services for database migration. The
// `@apostrophecms/migration:migrate` task carries out all migrations that have
// been registered with this module. Migrations are used to make changes to the
// database at the time of a new code deployment, typically because we need to
// represent the data in a different way or correct errors.
//
// Migrations MUST be idempotent (it must be safe to run them twice). Apostrophe
// does remember whether they have been run before in a cache but there is
// NO guarantee that they will not run again when the cache is cleared. If this
// is difficult to guarantee, you may wish to write a task instead.

module.exports = {
  options: { alias: 'migration' },
  async init(self) {
    self.migrations = [];
    await self.enableCollection();
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        addSortifyMigrations() {
          const managers = self.apos.doc.managers;
          _.each(managers, function (manager, name) {
            const schema = manager.schema;
            if (!schema) {
              return;
            }
            _.each(schema, function (field) {
              if (field.name === 'title') {
                // Was always sortified, migration would be redundant
                return;
              }
              if (!field.sortify) {
                return;
              }
              manager.addSortifyMigration(field.name);
            });
          });
        }
      },
      before: {
        async addMissingSchemaFields() {
          await self.addMissingSchemaFields();
        }
      }
    };
  },
  methods(self) {
    return {
      // Add a migration function to be invoked when the
      // @apostrophecms/migration:migrate task is invoked. Each migration is
      // only invoked once, however they will all be invoked on a brand-new
      // site, so they must check whether a change is actually needed before
      // making a change (they must be harmless to run twice).
      //
      // Note that previous instances of the site ARE NOT STOPPED while
      // migrations are run. Migrations must minimize their impact on currently
      // running instances of older versions of the site. Copy data to new
      // properties, don't remove it (except perhaps in a later migration after
      // the initial copy is successful).
      //
      // If you absolutely must prevent requests from being executed during the
      // migration, wrap them with the `await apos.global.busy(myFunction)` API.
      // Note that this API involves a significant startup delay to allow
      // existing requests to terminate.
      add(name, migrationFn, options) {
        if (!options) {
          options = {};
        }
        self.migrations.push({
          name,
          options,
          fn: migrationFn
        });
      },
      // Invoke the iterator function once for each doc in the aposDocs
      // collection. If only two arguments are given, `limit` is assumed to be 1
      // (only one doc may be processed at a time).
      //
      // This method will never visit the same doc twice in a single call, even
      // if modifications are made.
      //
      // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
      async eachDoc(criteria, limit, iterator) {
        if (!iterator) {
          iterator = limit;
          limit = 1;
        }
        return self.each(self.apos.doc.db, criteria, limit, iterator);
      },
      // Invoke an async iterator function once for each document in the given
      // collection. If only three arguments are given, `limit` is assumed to be
      // 1 (only one doc may be processed at a time).
      //
      // This method will never visit the same document twice in a single call,
      // even if modifications are made.
      //
      // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
      async each(collection, criteria, limit, iterator) {
        if (!iterator) {
          iterator = limit;
          limit = 1;
        }
        // Sort by _id. This ensures that no document is
        // ever visited twice, even if we modify documents as
        // we go along.
        //
        // Otherwise there can be unexpected results from find()
        // in typical migrations as the changes we make can
        // affect the remainder of the query.
        //
        // https://groups.google.com/forum/#!topic/mongodb-user/AFC1ia7MHzk
        const cursor = collection.find(criteria);
        cursor.sort({ _id: 1 });
        // TODO use a variant of the code below instead
        // cursor.batchSize(limit);
        // for await (const docs of cursor) {
        //   // await iterator(docs);
        // }
        return require('util').promisify(broadband)(cursor, limit, async function (doc, cb) {
          try {
            await iterator(doc);
            return cb(null);
          } catch (err) {
            return cb(err);
          }
        });
      },
      // Invoke an async iterator function once for each area in each doc in
      // the aposDocs collection. The `iterator` function receives
      // `(doc, area, dotPath)`. `criteria` may be used to limit
      // the docs for which this is done.
      //
      // If only three arguments are given, `limit` is assumed to be 1 (only one
      // doc may be processed at a time).
      //
      // This method will never visit the same doc twice in a single call, even
      // if modifications are made.
      //
      // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
      //
      // Your iterator will be awaited.
      async eachArea(criteria, limit, iterator) {
        if (!iterator) {
          iterator = limit;
          limit = 1;
        }
        await self.eachDoc(criteria, limit, async function (doc) {
          const areaInfos = [];
          self.apos.area.walk(doc, function (area, dotPath) {
            areaInfos.push({
              area,
              dotPath
            });
          });
          for (const areaInfo of areaInfos) {
            await iterator(doc, areaInfo.area, areaInfo.dotPath);
          }
        });
      },
      // Invoke the iterator function once for each widget in each area in each
      // doc in the aposDocs collection. The `iterator` function receives `(doc,
      // widget, dotPath)` and must be an async function.
      //
      // `limit` may be completely omitted and defaults to `1`.
      //
      // This method will never visit the same doc twice in a single call, even
      // if modifications are made.
      //
      // Widget loaders are NOT called.
      //
      // THIS API IS FOR MIGRATION AND TASK USE ONLY AND HAS NO SECURITY.
      //
      // Your iterator will be awaited.
      //
      // `criteria` should be used to limit the docs for which
      // `iterator` has to be invoked, for instance
      // `{ type: 'article' }`.
      async eachWidget(criteria, limit, iterator) {
        if (!iterator) {
          iterator = limit;
          limit = 1;
        }
        await self.eachArea(criteria, limit, async function (doc, area, dotPath) {
          for (let i = 0; i < area.items.length; i++) {
            await iterator(doc, area.items[i], dotPath + '.items.' + i);
          }
        });
      },
      // Normally, this is called automatically for you. Any
      // doc type schema field marked with `sortify: true` automatically
      // gets a migration implemented via this method. Just don't forget
      // to run the `@apostrophecms/migration:migrate` task as part of
      // your normal post-deployment process.
      //
      // Adds a migration that takes the given field, such as `lastName`, and
      // creates a parallel `lastNameSortified` field, formatted with
      // `apos.util.sortify` so that it sorts and compares in a more
      // intuitive, case-insensitive way.
      //
      // The migration applies only to documents that match `criteria`.
      //
      // After adding such a migration, you can add `sortify: true` to the
      // schema field declaration for `field`, and any calls to
      // the `sort()` query builder for `lastName` will automatically
      // use `lastNameSortified`. You can also do that explicitly of course.
      //
      // Note that you want to do both things (add the migration, and
      // add `sortify: true`) because `sortify: true` guarantees that
      // `lastNameSortified` gets updated on all saves of the doc.
      //
      // `migrationNamePrefix` just helps uniquely identify this
      // migration, since different modules might contribute migrations
      // for fields of the same name.
      addSortify(migrationNamePrefix, criteria, field) {
        self.add(migrationNamePrefix + ':' + field + '-sortified', async function () {
          const clauses = [];
          const clause = {};
          clause[field + 'Sortified'] = { $exists: 0 };
          clauses.push(clause);
          clauses.push(criteria);
          await self.eachDoc({ $and: clauses }, 5, async function (doc) {
            const $set = {};
            $set[field + 'Sortified'] = self.apos.util.sortify(doc[field]);
            await self.apos.doc.db.updateOne({ _id: doc._id }, { $set });
          });
        });
      },
      // How we now track migrations performed: a mongodb collection
      // (persistent)
      async enableCollection() {
        self.db = await self.apos.db.collection('aposMigrations');
      },
      // Perform the actual migrations. Implementation of
      // the @apostrophecms/migration:migrate task
      async migrate(options) {
        await self.emit('before');
        if (self.apos.isNew) {
          // Since the site is brand new (zero documents), we may assume
          // it requires no migrations. Mark them all as "done" but note
          // that they were skipped, just in case we decide that's an issue
          // later
          const at = new Date();
          // Just in case the db has no documents but did
          // start to run migrations on a previous attempt,
          // which causes an occasional unique key error if not
          // corrected for here.
          //
          // Other migration-related facts that are not migration
          // names are stored with a leading *, leave them alone
          await self.db.removeMany({
            _id: /^[^*]/
          });
          await self.db.insertMany(self.migrations.map(migration => ({
            _id: migration.name,
            at,
            skipped: true
          })));
        } else {
          for (const migration of self.migrations) {
            await self.runOne(migration);
          }
        }
        // In production, this event is emitted only at the end of the migrate
        // command line task. In dev it is emitted at every startup after the
        // automatic migration.
        //
        // Intentionally emitted regardless of whether the site is new or not.
        //
        // This is the right time to park pages, for instance, because the
        // database is guaranteed to be in a stable state, whether because the
        // site is new or because migrations ran successfully.
        await self.emit('after');
      },
      async runOne(migration) {
        const info = await self.db.findOne({ _id: migration.name });
        if (info) {
          // We don't need to run it again
          return;
        }
        self.apos.util.log('Running database migration: ' + migration.name);
        try {
          await migration.fn();
          await self.db.insertOne({
            _id: migration.name,
            at: new Date()
          });
        } catch (err) {
          if (err) {
            self.apos.util.error(err);
            throw err;
          }
        }
      },
      ...addMissingSchemaFields(self)
    };
  },
  tasks(self) {
    return {
      migrate: {
        usage: 'Apply any necessary migrations to the database.',
        // Migrations actually run on every invocation
        // and automatically detect whether any work
        // must be done
        task: () => {}
      }
    };
  }
};
