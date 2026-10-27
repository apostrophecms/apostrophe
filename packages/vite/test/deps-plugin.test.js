const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Fixture packages: `owner` stands in for apostrophe (or an extension) and
// depends on the others. `shared` is used by two of them.
const packages = {
  owner: {
    files: { 'index.js': 'export default "OWNER";' },
    deps: [ 'dep-a', 'dep-b', 'deduped', '@scope/scoped', 'sass-dep' ]
  },
  'dep-a': {
    pkg: {
      exports: {
        '.': './index.js',
        './sub': './lib/sub.js'
      }
    },
    files: {
      'index.js': 'import shared from "shared"; export default "DEP_A:" + shared;',
      'lib/sub.js': 'export default "DEP_A_SUB";'
    },
    deps: [ 'shared' ]
  },
  'dep-b': {
    files: { 'index.js': 'import shared from "shared"; export default "DEP_B:" + shared;' },
    deps: [ 'shared' ]
  },
  shared: {
    files: { 'index.js': 'export default "SHARED_MARKER";' }
  },
  deduped: {
    files: { 'index.js': 'export default "DEDUPED";' }
  },
  '@scope/scoped': {
    files: { 'index.js': 'export default "SCOPED";' }
  },
  'sass-dep': {
    pkg: { sass: 'scss/main.scss' },
    files: {
      'scss/main.scss': '$main: #c0ffee;',
      'scss/_sub.scss': '$sub: #bada55;'
    }
  }
};

const entry = `
import a from 'dep-a';
import sub from 'dep-a/sub';
import b from 'dep-b';
import d from 'deduped';
import s from '@scope/scoped';
export default [ a, sub, b, d, s ];
`;

describe('vite-plugin-apostrophe-deps', function () {
  this.timeout(60000);

  let deps;
  let vite;
  let tmp;

  before(async function () {
    deps = await import('../lib/vite-plugin-apostrophe-deps.mjs');
    vite = await import('vite');
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'apos-vite-deps-')));
  });

  after(function () {
    fs.rmSync(tmp, {
      recursive: true,
      force: true
    });
  });

  describe('getPackageName', function () {
    it('should return the package name of bare imports', function () {
      assert.equal(deps.getPackageName('vue'), 'vue');
      assert.equal(deps.getPackageName('tiny-emitter/instance'), 'tiny-emitter');
      assert.equal(deps.getPackageName('@tiptap/core'), '@tiptap/core');
      assert.equal(deps.getPackageName('@tiptap/pm/state'), '@tiptap/pm');
      assert.equal(deps.getPackageName('dayjs/plugin/advancedFormat'), 'dayjs');
    });

    it('should return null for anything else', function () {
      for (const source of [
        './foo.js',
        '../foo',
        '/abs/foo.js',
        'C:/abs/foo.js',
        'C:\\abs\\foo.js',
        '\0virtual',
        'virtual:thing',
        'node:fs',
        '#internal',
        'Modules/@apostrophecms/ui/foo.js',
        '@',
        '@scope',
        '@/foo',
        ''
      ]) {
        assert.equal(deps.getPackageName(source), null, source);
      }
    });
  });

  describe('pnpm layout', function () {
    let root;
    let ownerDir;

    before(function () {
      root = path.join(tmp, 'pnpm');
      ownerDir = createPnpmLayout(root);
    });

    it('should find dependencies installed as siblings', function () {
      const found = deps.findPackageDir('dep-a', ownerDir);
      assert.equal(
        found,
        fs.realpathSync(path.join(store(root, 'dep-a'))).replaceAll('\\', '/')
      );
      assert.equal(deps.findPackageDir('not-installed', ownerDir), null);
    });

    it('should fail to build without the plugin (sanity check)', async function () {
      await assert.rejects(
        build(root, { plugin: false }),
        /dep-a/
      );
    });

    it('should resolve from the owner, honouring exports and dedupe', async function () {
      const code = await build(root, { getSearchDirs: () => [ ownerDir ] });
      for (const marker of [ 'DEP_A:', 'DEP_A_SUB', 'DEP_B:', 'DEDUPED', 'SCOPED' ]) {
        assert.ok(code.includes(marker), `missing ${marker}`);
      }
    });

    it('should bundle a package used by several others once', async function () {
      const code = await build(root, { getSearchDirs: () => [ ownerDir ] });
      assert.equal(code.split('SHARED_MARKER').length - 1, 1);
    });

    it('should try the search directories in order', async function () {
      const empty = path.join(tmp, 'empty');
      fs.mkdirSync(empty, { recursive: true });
      const code = await build(root, { getSearchDirs: () => [ empty, ownerDir ] });
      assert.ok(code.includes('DEP_A_SUB'));
    });

    it('should resolve Sass imports from the owner', async function () {
      const scss = `
@use 'sass-dep' as main;
@use 'sass-dep/scss/sub' as sub;
.a { color: main.$main; }
.b { color: sub.$sub; }
`;
      await assert.rejects(
        build(root, {
          plugin: false,
          entryCode: 'import "./style.scss";',
          files: { 'style.scss': scss }
        }),
        /Can't find stylesheet/
      );
      const css = await build(root, {
        getSearchDirs: () => [ ownerDir ],
        entryCode: 'import "./style.scss";',
        files: { 'style.scss': scss }
      });
      assert.match(css, /#c0ffee/);
      assert.match(css, /#bada55/);
    });

    it('should leave unresolvable imports to Vite', async function () {
      await assert.rejects(
        build(root, {
          getSearchDirs: () => [ ownerDir ],
          entryCode: 'import x from "not-installed"; export default x;'
        }),
        /not-installed/
      );
    });
  });

  describe('flat (npm) layout', function () {
    it('should not change the output', async function () {
      const root = path.join(tmp, 'flat');
      createFlatLayout(root);
      const getSearchDirs = () => {
        throw new Error('should not be called when imports resolve');
      };
      const without = await build(root, { plugin: false });
      const withPlugin = await build(root, { getSearchDirs });
      assert.equal(withPlugin, without);
    });
  });

  // Build `src/entry.js` (plus any other `files` in `src/`) under `root`
  // the way our base config does (`preserveSymlinks`) and return the
  // output code and CSS.
  async function build(root, {
    plugin = true, getSearchDirs, entryCode = entry, files = {}
  } = {}) {
    const entryFile = path.join(root, 'src/entry.js');
    fs.mkdirSync(path.dirname(entryFile), { recursive: true });
    fs.writeFileSync(entryFile, entryCode);
    for (const [ file, content ] of Object.entries(files)) {
      fs.writeFileSync(path.join(root, 'src', file), content);
    }
    const result = await vite.build({
      root,
      configFile: false,
      envFile: false,
      logLevel: 'silent',
      mode: 'production',
      resolve: {
        preserveSymlinks: true,
        dedupe: [ 'deduped' ]
      },
      plugins: plugin ? deps.default({ getSearchDirs }) : [],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: entryFile,
          // Keep the unused default export
          preserveEntrySignatures: 'strict'
        }
      }
    });
    const output = Array.isArray(result) ? result[0].output : result.output;
    return output.map((chunk) => chunk.code ?? chunk.source ?? '').join('\n');
  }
});

function store(root, name) {
  return path.join(
    root,
    'node_modules/.pnpm',
    `${name.replace('/', '+')}@1.0.0`,
    'node_modules',
    name
  );
}

// pnpm's default (isolated) layout: real packages in the store, each with
// its dependencies linked next to it. Only `owner` is linked at the root.
// Returns the real path of `owner`.
function createPnpmLayout(root) {
  for (const [ name, def ] of Object.entries(packages)) {
    writePackage(store(root, name), name, def);
    for (const dep of def.deps ?? []) {
      link(store(root, dep), path.join(path.dirname(store(root, name)), dep));
    }
  }
  link(store(root, 'owner'), path.join(root, 'node_modules/owner'));
  return fs.realpathSync(store(root, 'owner'));
}

// npm's layout: everything hoisted to the root.
function createFlatLayout(root) {
  for (const [ name, def ] of Object.entries(packages)) {
    writePackage(path.join(root, 'node_modules', name), name, def);
  }
}

function writePackage(dir, name, def) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name,
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    ...def.pkg
  }));
  for (const [ file, content ] of Object.entries(def.files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
}

function link(target, linkPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  // Junctions need no special rights on Windows
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}
