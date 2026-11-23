const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const { createMcpApos } = require('./utils/mcp.js');

// MCP change log entries expire `changeLogExpireAfter` seconds after the
// write, by a sweep that deletes MCP entries only: the assistant's are
// kept however old they are. A changed window applies from the next sweep.

const DAY = 24 * 60 * 60;

describe('MCP: change log retention', function () {
  this.timeout(t.timeout);

  let apos;
  let mcp;
  let changes;

  before(async function () {
    apos = await createMcpApos(module, {
      options: {
        changeLogExpireAfter: 30 * DAY
      }
    });
    mcp = apos.modules['@apostrophecms/mcp'];
    changes = apos.harness.changes;
  });

  after(async function () {
    await t.destroy(apos);
  });

  beforeEach(async function () {
    await changes.deleteMany({});
    mcp.options.changeLogExpireAfter = 30 * DAY;
  });

  // One entry per door and age, in days: `mcp-40` is an MCP entry written
  // 40 days ago
  async function insertEntries(entries) {
    let sequence = 0;
    for (const [ door, days ] of entries) {
      await changes.insertOne({
        _id: `${door}-${days}`,
        requestId: `request-${door}-${days}`,
        docId: 'doc1',
        sequence: sequence++,
        door,
        chat: (door === 'assistant') ? 'chat1' : null,
        at: new Date(Date.now() - days * DAY * 1000)
      });
    }
  }

  async function remaining() {
    return (await changes.find({}).toArray()).map(({ _id }) => _id).sort();
  }

  it('keeps entries for 180 days by default', function () {
    const { options } = require('../modules/@apostrophecms/mcp/index.js');
    assert.equal(options.changeLogExpireAfter, 180 * DAY);
  });

  it('deletes MCP entries past the window, and only those', async function () {
    await insertEntries([
      [ 'mcp', 40 ],
      [ 'mcp', 31 ],
      [ 'mcp', 29 ],
      [ 'mcp', 1 ],
      [ 'assistant', 400 ],
      [ 'assistant', 1 ]
    ]);
    assert.equal(await mcp.expireChanges(), 2);
    assert.deepEqual(await remaining(), [
      'assistant-1',
      'assistant-400',
      'mcp-1',
      'mcp-29'
    ]);
  });

  it('applies a changed window from the next sweep', async function () {
    await insertEntries([
      [ 'mcp', 20 ],
      [ 'mcp', 5 ]
    ]);
    assert.equal(await mcp.expireChanges(), 0);
    mcp.options.changeLogExpireAfter = 10 * DAY;
    assert.equal(await mcp.expireChanges(), 1);
    assert.deepEqual(await remaining(), [ 'mcp-5' ]);
  });

  it('keeps every entry when the window is 0', async function () {
    await insertEntries([
      [ 'mcp', 5000 ]
    ]);
    mcp.options.changeLogExpireAfter = 0;
    assert.equal(await mcp.expireChanges(), 0);
    assert.deepEqual(await remaining(), [ 'mcp-5000' ]);
  });

  it('skips a round while another process sweeps', async function () {
    await insertEntries([
      [ 'mcp', 40 ]
    ]);
    await apos.lock.lock('@apostrophecms/mcp:expireChanges');
    try {
      assert.equal(await mcp.expireChanges(), null);
    } finally {
      await apos.lock.unlock('@apostrophecms/mcp:expireChanges');
    }
    assert.deepEqual(await remaining(), [ 'mcp-40' ]);
    assert.equal(await mcp.expireChanges(), 1);
  });

  it('sweeps from the task', async function () {
    await insertEntries([
      [ 'mcp', 40 ],
      [ 'mcp', 1 ]
    ]);
    await apos.task.invoke('@apostrophecms/mcp:expire-changes');
    assert.deepEqual(await remaining(), [ 'mcp-1' ]);
  });

  it('runs the sweep on an interval while the app is up', function () {
    assert(mcp.sweepInterval);
  });

  it('refuses an invalid window', function () {
    for (const value of [ -1, '30', NaN, Infinity, null ]) {
      const options = mcp.options;
      mcp.options = {
        ...options,
        changeLogExpireAfter: value
      };
      try {
        assert.throws(() => mcp.validateOptions(), /changeLogExpireAfter/);
      } finally {
        mcp.options = options;
      }
    }
  });
});
