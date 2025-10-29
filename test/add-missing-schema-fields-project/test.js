import { strict as assert } from 'node:assert';
import path from 'node:path';
import util from 'node:util';
import { exec } from 'node:child_process';
import t from '../../test-lib/test.js';
import app from './app.js';

describe('Apostrophe - add-missing-schema-fields task', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    await util.promisify(exec)('npm install', { cwd: path.resolve(process.cwd(), 'test/add-missing-schema-fields-project') });
  });

  afterEach(function() {
    return t.destroy(apos);
  });

  it.only('should not run migrations when running the task', async function() {
    await util.promisify(exec)('node app.js @apostrohecms/migration:add-missing-schema-fields', { cwd: path.resolve(process.cwd(), 'test/add-missing-schema-fields-project') });

    apos = await t.create({
      ...app,
      argv: {
        _: [ '@apostrophecms/migration:add-missing-schema-fields' ]
        // _: [ '@apostrophecms/migration:force-skip-migration' ]
      },
      root: import.meta
      // modules: {
      //   ...app.modules
      //   // '@apostrophecms/migration': {
      //   //   async init(self) {
      //   //     self.apos.skipMigration = true;
      //   //     console.log('skip true');
      //   //   },
      //   //   tasks(self) {
      //   //     return {
      //   //       'force-skip-migration': {
      //   //         usage: 'Force skip migration',
      //   //         task: async () => {
      //   //           self.apos.skipMigration = true;
      //   //           const migrations = await self.apos.migration.db.find().toArray();
      //   //           console.log({ migrations });
      //   //         }
      //   //       }
      //   //     };
      //   //   }
      //   // }
      // }
    });

    const migrations = await apos.migration.db.find().toArray();

    const actual = {
      migrations: migrations.map(migration => migration._id)
    };
    const expected = {
      migrations: []
    };

    assert.deepEqual(actual, expected);
  });

  it('should run migrations when running @apostrophecms/migration:migrate task', async function() {
    await util.promisify(exec)('node app.js @apostrohecms/migration:migrate', { cwd: path.resolve(process.cwd(), 'test/add-missing-schema-fields-project') });

    apos = await t.create({
      ...app,
      isTask() {
        return true;
      },
      skipMigration: true,
      root: import.meta
    });

    const migrations = await apos.migration.db.find().toArray();

    const actual = {
      migrations: migrations.map(migration => migration._id)
    };
    const expected = {
      migrations: [
        '*lastPropLists',
        'fix-length-property',
        '@apostrophecms/attachment.docReferencesContained',
        'svg-sanitization',
        'retire-published-field',
        'duplicate-or-missing-widget-id',
        'add-draft-published',
        'add lastPublishedAt to all published drafts without it',
        'add-last-published-to-published-docs',
        'add-apos-mode',
        'store-relationship-ids-as-apos-doc-ids',
        'add-cache-invalidated-at-field',
        'set-previous-docs-apos-mode',
        'set-document-modes',
        'remove-polymorphic-type-alias',
        'deduplicate-archive-rank',
        'fix-home-page-path',
        'rename-trash-to-archived',
        'misreplicated-parked-pages',
        'duplicate-parked-pages',
        'deduplicateRanks2',
        'missingLastPublishedAt',
        'search-index-fix',
        'deduplicate-widget-ids',
        'add-role-to-user',
        'add-first-product',
        'add-copyright-notice'
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should run migrations when starting apostrophe', async function() {
    apos = await t.create({
      ...app,
      root: import.meta
    });

    const migrations = await apos.migration.db.find().toArray();

    const actual = {
      migrations: migrations.map(migration => migration._id)
    };
    const expected = {
      migrations: [
        '*lastPropLists',
        'fix-length-property',
        '@apostrophecms/attachment.docReferencesContained',
        'svg-sanitization',
        'retire-published-field',
        'duplicate-or-missing-widget-id',
        'add-draft-published',
        'add lastPublishedAt to all published drafts without it',
        'add-last-published-to-published-docs',
        'add-apos-mode',
        'store-relationship-ids-as-apos-doc-ids',
        'add-cache-invalidated-at-field',
        'set-previous-docs-apos-mode',
        'set-document-modes',
        'remove-polymorphic-type-alias',
        'deduplicate-archive-rank',
        'fix-home-page-path',
        'rename-trash-to-archived',
        'misreplicated-parked-pages',
        'duplicate-parked-pages',
        'deduplicateRanks2',
        'missingLastPublishedAt',
        'search-index-fix',
        'deduplicate-widget-ids',
        'add-role-to-user',
        'add-first-product',
        'add-copyright-notice'
      ]
    };

    assert.deepEqual(actual, expected);
  });
});
