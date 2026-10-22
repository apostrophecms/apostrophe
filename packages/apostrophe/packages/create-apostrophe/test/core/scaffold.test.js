import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffold } from '../../src/core/steps/scaffold.js';
import { StageError } from '../../src/core/errors.js';

const APP_JS = [
  'module.exports = {',
  '  shortName: \'PLACEHOLDER\',',
  '  modules: {},',
  '  uploadfs: { disabledFileKey: undefined }',
  '};',
  ''
].join('\n');

const PKG_JSON = '{\n  "name": "placeholder",\n  "version": "1.0.0"\n}\n';

// `external` mirrors a kit with an external frontend: app nested in backend/,
// plus a sibling frontend/ dir (unless withFrontendDir === false).
function makeProject(root, { external = false, withFrontendDir = external } = {}) {
  const appRoot = external ? join(root, 'backend') : root;
  mkdirSync(appRoot, { recursive: true });
  writeFileSync(join(appRoot, 'app.js'), APP_JS);
  writeFileSync(join(appRoot, 'package.json'), PKG_JSON);
  if (external && withFrontendDir) {
    mkdirSync(join(root, 'frontend'), { recursive: true });
  }
  return appRoot;
}

const read = (p) => readFileSync(p, 'utf8');
const hex64 = (s, key) => {
  const m = s.match(new RegExp(`^${key}=([0-9a-f]+)$`, 'm'));
  assert.ok(m, `${key} filled`);
  assert.equal(m[1].length, 64); // 32 bytes
  return m[1];
};

describe('core/steps/scaffold', function () {
  let dir;

  beforeEach(function () {
    dir = mkdtempSync(join(tmpdir(), 'ca-scaffold-'));
  });

  afterEach(function () {
    rmSync(dir, {
      recursive: true,
      force: true
    });
  });

  it('standalone (frontend:null): identity replace; .env with filled secrets', function () {
    const projectDir = join(dir, 'proj');
    makeProject(projectDir);

    const res = scaffold({
      projectDir,
      shortName: 'my_site-1'
    });
    assert.equal(res.frontend, null);
    assert.equal(res.appRoot, projectDir);
    assert.deepEqual(res.envFiles, [ join(projectDir, '.env') ]);

    const app = read(join(projectDir, 'app.js'));
    assert.match(app, /shortName: 'my_site-1',/);
    assert.match(read(join(projectDir, 'package.json')), /"name": "my_site-1",/);
    assert.match(app, /disabledFileKey: undefined/); // secret not in source

    const env = read(join(projectDir, '.env'));
    assert.notEqual(
      hex64(env, 'APOS_SESSION_SECRET'),
      hex64(env, 'APOS_UPLOADFS_DISABLED_FILE_KEY')
    );
    assert.match(env, /gitignored/);
  });

  it('lowercases the npm package name; preserves shortName casing elsewhere', function () {
    // npm package names must be lowercase; Apostrophe's own shortName is
    // case-tolerant and the user's chosen casing is kept in app.js + dir.
    const projectDir = join(dir, 'proj');
    makeProject(projectDir);

    scaffold({
      projectDir,
      shortName: 'MyProject'
    });

    assert.match(read(join(projectDir, 'app.js')), /shortName: 'MyProject',/);
    assert.match(read(join(projectDir, 'package.json')), /"name": "myproject",/);
  });

  it('frontend:\'astro\': backend/.env (secrets + dev keys) and frontend/.env', function () {
    const projectDir = join(dir, 'proj');
    const appRoot = makeProject(projectDir, { external: true });

    const res = scaffold({
      projectDir,
      shortName: 'astro-site',
      frontend: 'astro'
    });
    assert.equal(res.frontend, 'astro');
    assert.equal(res.appRoot, appRoot);
    assert.deepEqual(res.envFiles, [
      join(appRoot, '.env'),
      join(projectDir, 'frontend', '.env')
    ]);

    const backendEnv = read(join(appRoot, '.env'));
    assert.match(backendEnv, /^APOS_EXTERNAL_FRONT_KEY=dev$/m);
    assert.match(backendEnv, /^APOS_DEV=1$/m);
    hex64(backendEnv, 'APOS_SESSION_SECRET');

    const frontEnv = read(join(projectDir, 'frontend', '.env'));
    assert.match(frontEnv, /^APOS_EXTERNAL_FRONT_KEY=dev$/m);
    assert.doesNotMatch(frontEnv, /APOS_SESSION_SECRET/); // no secrets
  });

  it('frontend:\'astro\' without a frontend/ dir: backend .env only', function () {
    const projectDir = join(dir, 'proj');
    const appRoot = makeProject(projectDir, {
      external: true,
      withFrontendDir: false
    });
    const res = scaffold({
      projectDir,
      shortName: 'x',
      frontend: 'astro'
    });
    assert.deepEqual(res.envFiles, [ join(appRoot, '.env') ]);
  });

  it('rejects an unsupported frontend name', function () {
    const projectDir = join(dir, 'proj');
    makeProject(projectDir);
    assert.throws(
      () => scaffold({
        projectDir,
        shortName: 'x',
        frontend: 'nextjs'
      }),
      TypeError
    );
  });

  it('frontend:\'astro\' but no backend/ → StageError(scaffold)', function () {
    const projectDir = join(dir, 'proj');
    makeProject(projectDir); // standalone layout, no backend/
    assert.throws(
      () => scaffold({
        projectDir,
        shortName: 'x',
        frontend: 'astro'
      }),
      (err) => {
        assert.ok(err instanceof StageError);
        assert.equal(err.stage, 'scaffold');
        assert.equal(err.errorCode, 'missing_scaffold_file');
        return true;
      }
    );
  });

  it('never clobbers an existing .env, but still fills secrets', function () {
    const projectDir = join(dir, 'proj');
    makeProject(projectDir);
    writeFileSync(join(projectDir, '.env'), 'KEEP=mine\n');

    scaffold({
      projectDir,
      shortName: 'x'
    });
    const env = read(join(projectDir, '.env'));
    assert.match(env, /^KEEP=mine$/m); // preserved
    hex64(env, 'APOS_SESSION_SECRET'); // still upserted
  });

  it('throws StageError(scaffold) when app.js is missing', function () {
    const projectDir = join(dir, 'proj');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'package.json'), PKG_JSON);
    assert.throws(
      () => scaffold({
        projectDir,
        shortName: 'x'
      }),
      (err) => {
        assert.equal(err.stage, 'scaffold');
        assert.equal(err.errorCode, 'missing_scaffold_file');
        return true;
      }
    );
  });

  it('rejects an unsafe shortName before touching files', function () {
    const projectDir = join(dir, 'proj');
    makeProject(projectDir);
    assert.throws(
      () => scaffold({
        projectDir,
        shortName: '../evil'
      }),
      TypeError
    );
    assert.match(read(join(projectDir, 'app.js')), /PLACEHOLDER/);
    assert.equal(existsSync(join(projectDir, '.env')), false);
  });
});
