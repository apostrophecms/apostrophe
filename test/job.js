const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Job module', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  let jobModule;

  it('should be a property of the apos object', async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await t.create({
      root: module,
      modules: {}
    });
    jobModule = apos.modules['@apostrophecms/job'];
    assert(apos.modules['@apostrophecms/job']);
  });

  it('has a related database collection', async function () {
    assert(jobModule.db);
    const stats = await jobModule.db.stats();
    assert(stats);
    assert(stats.ns.match(/aposJobs$/));
  });

  let jobOne;

  it('should create a new job', async function () {
    jobOne = await jobModule.start({});

    assert(jobOne._id);

    const found = await jobModule.db.findOne({ _id: jobOne._id });

    assert(found);
    assert(found.status === 'running');
    assert(found.ended === false);
  });

  it('should end a job and mark it as successful', async function () {
    const result = await jobModule.end(jobOne, 'success', { testing: 'testing' });

    assert(result.result.nModified === 1);

    const found = await jobModule.db.findOne({ _id: jobOne._id });

    assert(found);
    assert(found.status === 'completed');
    assert(found.ended === true);
  });
});
