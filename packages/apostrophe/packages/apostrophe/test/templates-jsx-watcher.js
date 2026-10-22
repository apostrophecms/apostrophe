const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const isWsl = require('is-wsl');

describe('Templates: JSX watcher', function () {

  let apos;
  this.timeout(t.timeout);

  // Two fixture modules. `jsx-watcher-test` is the simple case: render its
  // own template directly. `jsx-watcher-cross-test` is the realistic-page
  // case: another module renders this one's template via the qualified
  // `module:template` form (mirroring how `@apostrophecms/page` renders
  // `@apostrophecms/home-page:page` in the wild). The first surfaces a
  // bug where renderBody never arms a watcher for JSX renders; the second
  // surfaces a bug where the watcher was armed against the caller's views
  // instead of the resolved module's views.
  const ownModule = 'jsx-watcher-test';
  const ownTemplate = 'watcher-test';
  const ownPath = path.join(
    __dirname, 'modules', ownModule, 'views', `${ownTemplate}.jsx`
  );
  const ownOriginal = 'export default function () {\n  return <h1>own-original</h1>;\n}\n';
  const ownChanged = 'export default function () {\n  return <h1>own-changed</h1>;\n}\n';

  const crossModule = 'jsx-watcher-cross-test';
  const crossTemplate = 'cross-template';
  const crossPath = path.join(
    __dirname, 'modules', crossModule, 'views', `${crossTemplate}.jsx`
  );
  const crossOriginal = 'export default function () {\n  return <h1>cross-original</h1>;\n}\n';
  const crossChanged = 'export default function () {\n  return <h1>cross-changed</h1>;\n}\n';

  before(async function () {
    // Defend against poisoned fixtures from a prior failed run.
    fs.writeFileSync(ownPath, ownOriginal);
    fs.writeFileSync(crossPath, crossOriginal);
    apos = await t.create({
      root: module,
      modules: {
        [ownModule]: {},
        [crossModule]: {}
      }
    });
  });

  after(async function () {
    try {
      fs.writeFileSync(ownPath, ownOriginal);
    } catch (e) {
      // best-effort restore
    }
    try {
      fs.writeFileSync(crossPath, crossOriginal);
    } catch (e) {
      // best-effort restore
    }
    return t.destroy(apos);
  });

  // Wait for chokidar's initial scan to complete on every watcher the
  // template module has registered. If the JSX render path failed to arm
  // any watcher for our views directory, no `change` event would ever
  // fire and the caller's `waitForChange` would time out.
  async function waitForWatchersReady() {
    await Promise.all(
      (apos.template._viewWatchers || []).map(watcher => {
        if (watcher._readyEmitted) {
          return Promise.resolve();
        }
        return new Promise(resolve => watcher.on('ready', resolve));
      })
    );
  }

  function waitForChange(absolutePath) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No view-change event was observed for ${absolutePath}.`)),
        5000
      );
      apos.template.onViewChange(filePath => {
        if (filePath && path.resolve(filePath) === path.resolve(absolutePath)) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  it('should pick up edits to a .jsx template rendered through its own module', async function () {
    if (isWsl) {
      this.skip();
      return;
    }
    const req = apos.task.getAnonReq();
    const initial = await apos.modules[ownModule].render(req, ownTemplate);
    assert.match(initial, /own-original/);

    await waitForWatchersReady();
    const sawChange = waitForChange(ownPath);
    fs.writeFileSync(ownPath, ownChanged);
    await sawChange;

    const after = await apos.modules[ownModule].render(req, ownTemplate);
    assert.match(after, /own-changed/);
    assert.doesNotMatch(after, /own-original/);
  });

  it('should pick up edits when one module renders another module\'s .jsx via `module:template`', async function () {
    if (isWsl) {
      this.skip();
      return;
    }
    const req = apos.task.getAnonReq();
    // The caller is `ownModule`, but the template lives in `crossModule`.
    // This is the shape that breaks if the watcher is armed against the
    // caller's view chain instead of the resolved file's module.
    const qualified = `${crossModule}:${crossTemplate}`;
    const initial = await apos.modules[ownModule].render(req, qualified);
    assert.match(initial, /cross-original/);

    await waitForWatchersReady();
    const sawChange = waitForChange(crossPath);
    fs.writeFileSync(crossPath, crossChanged);
    await sawChange;

    const after = await apos.modules[ownModule].render(req, qualified);
    assert.match(after, /cross-changed/);
    assert.doesNotMatch(after, /cross-original/);
  });

});
