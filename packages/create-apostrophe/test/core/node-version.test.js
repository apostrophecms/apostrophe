import assert from 'node:assert/strict';
import {
  requiredNodeMajor,
  parseNodeMajor,
  isNodeSupported,
  assertNodeSupported
} from '../../src/core/node-version.js';
import { KIT_IDS, getKit } from '../../src/core/kits.js';
import { UnsupportedNodeVersionError } from '../../src/core/errors.js';

describe('core/node-version', function () {
  it('Astro kits need Node 24; Standalone kits need 22', function () {
    for (const kitId of KIT_IDS) {
      const expected = getKit(kitId).frontend === 'astro' ? 24 : 22;
      assert.equal(requiredNodeMajor(kitId), expected, kitId);
    }
  });

  it('parses the major, with or without a leading v', function () {
    assert.equal(parseNodeMajor('22.23.1'), 22);
    assert.equal(parseNodeMajor('v24.4.1'), 24);
    assert.ok(Number.isNaN(parseNodeMajor(undefined)));
    assert.ok(Number.isNaN(parseNodeMajor('')));
  });

  it('every kit runs on Node 24', function () {
    for (const kitId of KIT_IDS) {
      assert.equal(isNodeSupported(kitId, '24.0.0'), true, kitId);
    }
  });

  it('Node 22 runs Standalone kits but not Astro kits', function () {
    assert.equal(isNodeSupported('apostrophe-essentials', '22.0.0'), true);
    assert.equal(isNodeSupported('apostrophe-demo-data', '22.0.0'), true);
    assert.equal(isNodeSupported('apostrophe-astro-demo', '22.23.4'), false);
    assert.equal(isNodeSupported('apostrophe-astro-essentials', '23.11.0'), false);
  });

  it('an unparseable version passes rather than blocking every install', function () {
    assert.equal(isNodeSupported('apostrophe-astro-demo', 'nightly'), true);
  });

  it('assertNodeSupported throws a preflight error with a symbolic code', function () {
    assert.throws(
      () => assertNodeSupported('apostrophe-astro-demo', '22.11.0'),
      (err) => {
        assert.ok(err instanceof UnsupportedNodeVersionError);
        assert.equal(err.errorCode, 'unsupported_node');
        assert.equal(err.requiredMajor, 24);
        assert.equal(err.nodeVersion, '22.11.0');
        return true;
      }
    );
    assert.doesNotThrow(() => assertNodeSupported('apostrophe-essentials', '22.11.0'));
  });
});
