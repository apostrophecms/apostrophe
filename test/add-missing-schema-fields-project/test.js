import { strict as assert } from 'node:assert';
import process from 'node:process';
import path from 'node:path';
import util from 'node:util';
import { exec } from 'node:child_process';
import t from '../../test-lib/test.js';
import config from './config.js';

describe('Apostrophe - add-missing-schema-fields task', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    await util.promisify(exec)(
      'npm install',
      { cwd: path.resolve(process.cwd(), 'test/add-missing-schema-fields-project/') }
    );
  });

  afterEach(function() {
    return t.destroy(apos);
  });

  it('should not run migrations when running the task', async function() {
    await util.promisify(exec)(
      'node app.js @apostrophecms/migration:add-missing-schema-fields',
      { cwd: path.resolve(process.cwd(), 'test/add-missing-schema-fields-project/') }
    );

    apos = await t.create({
      ...config,
      root: import.meta,
      modules: {
        ...config.modules,
        debug: {
          handlers(self) {
            return {
              'apostrophe:modulesRegistered': {
                forceSkipMigration() {
                  self.apos.skipMigration = true;
                }
              }
            };
          }
        }
      }
    });

    const migrations = await apos.migration.db.find().toArray();

    const actual = {
      migrations: migrations.map(migration => migration._id)
    };
    const expected = {
      // NOTE: *lastPropLists is there because it always run
      // cf. before handler in the migration module
      migrations: [ '*lastPropLists' ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should run migrations when running @apostrophecms/migration:migrate task', async function() {
    await util.promisify(exec)(
      'node app.js @apostrophecms/migration:migrate',
      { cwd: path.resolve(process.cwd(), 'test/add-missing-schema-fields-project/') }
    );

    apos = await t.create({
      ...config,
      root: import.meta,
      modules: {
        ...config.modules,
        debug: {
          handlers(self) {
            return {
              'apostrophe:modulesRegistered': {
                forceSkipMigration() {
                  self.apos.skipMigration = true;
                }
              }
            };
          }
        }
      }
    });

    const migrations = await apos.migration.db.find().toArray();

    const actual = {
      migrations: migrations.map(migration => migration._id)
    };
    const expected = {
      migrations: [ '*lastPropLists' ].concat(
        apos.migration.migrations.map(migration => migration.name)
      )
    };

    assert.deepEqual(actual, expected);
  });

  it('should run migrations when starting apostrophe', async function() {
    apos = await t.create({
      ...config,
      root: import.meta
    });

    const migrations = await apos.migration.db.find().toArray();

    const actual = {
      migrations: migrations.map(migration => migration._id)
    };
    const expected = {
      migrations: [ '*lastPropLists' ].concat(
        apos.migration.migrations.map(migration => migration.name)
      )
    };

    assert.deepEqual(actual, expected);
  });
});
