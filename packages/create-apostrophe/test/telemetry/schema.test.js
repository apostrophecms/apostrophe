import assert from 'node:assert/strict';
import {
  buildPayload, allowedFields, EVENT_NAMES, DB_CHOICES, PACKAGE_MANAGERS,
  FAIL_STAGES, ERROR_CODES, SchemaError
} from '../../src/telemetry/schema.js';
import { KIT_IDS } from '../../src/core/kits.js';

const VALID = Object.freeze({
  cliVersion: '0.1.0',
  anonymousId: '11111111-1111-1111-1111-111111111111',
  kitId: 'apostrophe-astro-demo',
  dbChoice: 'sqlite',
  packageManager: 'npm',
  durationMs: 1234
});

describe('telemetry/schema — enum exports', function () {
  it('event names: success + fail only', function () {
    assert.deepEqual([ ...EVENT_NAMES ], [ 'install_success', 'install_fail' ]);
  });

  it('dbChoices: single mongodb (no atlas/local split)', function () {
    assert.deepEqual([ ...DB_CHOICES ], [ 'sqlite', 'mongodb', 'postgres' ]);
  });

  it('packageManagers includes unknown', function () {
    assert.deepEqual(
      [ ...PACKAGE_MANAGERS ],
      [ 'npm', 'pnpm', 'yarn', 'unknown' ]
    );
  });

  it('failStages include admin + preflight null', function () {
    assert.ok(FAIL_STAGES.includes('admin'));
    assert.ok(FAIL_STAGES.includes(null));
  });

  it('failStages include sample_data (demo-data seed import)', function () {
    assert.ok(FAIL_STAGES.includes('sample_data'));
  });

  it('errorCodes include the seed_* codes', function () {
    for (const code of [
      'seed_manifest_invalid', 'seed_download_failed', 'seed_checksum_failed',
      'seed_unpack_failed', 'seed_restore_failed', 'seed_uploads_failed'
    ]) {
      assert.ok(ERROR_CODES.includes(code), code);
    }
  });

  it('errorCodes refine db_connect into reachable/auth/drop verdicts', function () {
    for (const code of [
      'db_unreachable', 'db_auth_failed', 'db_connect_failed', 'db_drop_failed'
    ]) {
      assert.ok(ERROR_CODES.includes(code), code);
    }
  });

  it('every kit-registry id is a valid kitId enum value', function () {
    for (const id of KIT_IDS) {
      const p = buildPayload('install_success', {
        ...VALID,
        kitId: id
      });
      assert.equal(p.kitId, id);
    }
  });
});

describe('telemetry/schema — buildPayload (success)', function () {
  it('returns exactly the §7 fields, in order', function () {
    const p = buildPayload('install_success', VALID);
    assert.deepEqual(Object.keys(p), [
      'event', 'cliVersion', 'kitId', 'dbChoice',
      'packageManager', 'durationMs', 'anonymousId'
    ]);
    assert.equal(p.event, 'install_success');
    assert.equal(p.cliVersion, VALID.cliVersion);
    assert.equal(p.anonymousId, VALID.anonymousId);
    assert.equal(p.kitId, VALID.kitId);
    assert.equal(p.dbChoice, VALID.dbChoice);
    assert.equal(p.packageManager, VALID.packageManager);
    assert.equal(p.durationMs, VALID.durationMs);
  });

  it('omits anonymousId when not supplied', function () {
    const { anonymousId, ...noId } = VALID;
    const p = buildPayload('install_success', noId);
    assert.equal('anonymousId' in p, false);
  });

  it('drops every field outside the allowlist (PII firewall)', function () {
    const p = buildPayload('install_success', {
      ...VALID,
      // Anything that could leak — paths, names, secrets, env, content.
      shortName: 'top-secret-project',
      dbUri: 'mongodb://admin:pw@db.internal/secret',
      'admin.username': 'ceo@company.com',
      cwd: '/home/secret/path',
      env: { APOS_SECRET: 'xxx' },
      headers: { authorization: 'Bearer leaked' }
    });
    for (const k of [
      'shortName', 'dbUri', 'admin.username', 'cwd', 'env', 'headers'
    ]) {
      assert.equal(k in p, false, `${k} must not appear in payload`);
    }
  });
});

describe('telemetry/schema — buildPayload (fail)', function () {
  const FAIL_INPUT = Object.freeze({
    ...VALID,
    failStage: /** @type {const} */ ('dependency_install'),
    errorCode: 'install_failed'
  });

  it('adds failStage and a known errorCode', function () {
    const p = buildPayload('install_fail', FAIL_INPUT);
    assert.equal(p.event, 'install_fail');
    assert.equal(p.failStage, 'dependency_install');
    assert.equal(p.errorCode, 'install_failed');
  });

  it('accepts failStage: sample_data with a seed errorCode', function () {
    const p = buildPayload('install_fail', {
      ...FAIL_INPUT,
      failStage: 'sample_data',
      errorCode: 'seed_checksum_failed'
    });
    assert.equal(p.failStage, 'sample_data');
    assert.equal(p.errorCode, 'seed_checksum_failed');
  });

  it('accepts failStage: null (preflight)', function () {
    const p = buildPayload('install_fail', {
      ...FAIL_INPUT,
      failStage: null,
      errorCode: 'unsupported_pm'
    });
    assert.equal(p.failStage, null);
    assert.equal(p.errorCode, 'unsupported_pm');
  });

  it('drops an unknown errorCode (allowlist), never raw error strings', function () {
    const p = buildPayload('install_fail', {
      ...FAIL_INPUT,
      errorCode: 'EACCES: permission denied at /home/x/.npm-cache'
    });
    assert.equal('errorCode' in p, false);
    // The rest of the payload still goes through.
    assert.equal(p.failStage, FAIL_INPUT.failStage);
  });

  it('omits errorCode when undefined', function () {
    const { errorCode, ...noCode } = FAIL_INPUT;
    const p = buildPayload('install_fail', noCode);
    assert.equal('errorCode' in p, false);
  });

  it('every allowlisted code roundtrips', function () {
    for (const code of ERROR_CODES) {
      const p = buildPayload('install_fail', {
        ...FAIL_INPUT,
        errorCode: code
      });
      assert.equal(p.errorCode, code, code);
    }
  });
});

describe('telemetry/schema — validators reject bad input', function () {
  /** @type {Array<[string, object]>} */
  const cases = [
    [ 'invalid event', { event: 'install_started' } ],
    [ 'empty cliVersion', { cliVersion: '' } ],
    [ 'missing cliVersion', { cliVersion: undefined } ],
    [ 'unknown kitId', { kitId: 'apostrophe-multisite' } ],
    [ 'unknown dbChoice', { dbChoice: 'mongodb-atlas' } ],
    [ 'unknown packageManager', { packageManager: 'bun' } ],
    [ 'non-number durationMs', { durationMs: '1234' } ],
    [ 'Infinite durationMs', { durationMs: Infinity } ],
    [ 'empty anonymousId', { anonymousId: '' } ]
  ];
  for (const [ label, override ] of cases) {
    it(`rejects: ${label}`, function () {
      const input = {
        ...VALID,
        ...override
      };
      const event = ('event' in override) ? override.event : 'install_success';
      assert.throws(
        () => buildPayload(event, input),
        SchemaError,
        label
      );
    });
  }

  it('rejects unknown failStage on install_fail', function () {
    assert.throws(
      () => buildPayload('install_fail', {
        ...VALID,
        failStage: 'docker_failed',
        errorCode: 'install_failed'
      }),
      SchemaError
    );
  });
});

describe('telemetry/schema — allowedFields', function () {
  it('install_success: 7 fields, no failStage/errorCode', function () {
    const f = [ ...allowedFields('install_success') ];
    assert.deepEqual(f.sort(), [
      'anonymousId', 'cliVersion', 'dbChoice', 'durationMs',
      'event', 'kitId', 'packageManager'
    ]);
  });

  it('install_fail: 9 fields with failStage + errorCode', function () {
    const f = [ ...allowedFields('install_fail') ];
    assert.deepEqual(f.sort(), [
      'anonymousId', 'cliVersion', 'dbChoice', 'durationMs',
      'errorCode', 'event', 'failStage', 'kitId', 'packageManager'
    ]);
  });

  it('every built-payload key is in allowedFields()', function () {
    const success = buildPayload('install_success', VALID);
    for (const k of Object.keys(success)) {
      assert.ok(
        allowedFields('install_success').includes(k),
        `success key ${k} not in allowedFields`
      );
    }
    const fail = buildPayload('install_fail', {
      ...VALID,
      failStage: 'clone',
      errorCode: 'git_clone_failed'
    });
    for (const k of Object.keys(fail)) {
      assert.ok(
        allowedFields('install_fail').includes(k),
        `fail key ${k} not in allowedFields`
      );
    }
  });
});
