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
      modules: {
        article: {
          extend: '@apostrophecms/piece-type'
        }
      }
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
  let jar;
  it('should get admin jar', async () => {
    await t.createAdmin(apos);

    jar = await t.getUserJar(apos);

    assert(jar);
  });

  it('should access a job via REST API GET request', async function () {
    const job = await apos.http.get(`/api/v1/@apostrophecms/job/${jobOne._id}`, {
      jar
    });

    assert(job._id === jobOne._id);
  });

  let articleIds;

  it('can insert many test articles', async function () {
    const req = apos.task.getReq();

    const promises = [];

    for (let i = 1; i <= 500; i++) {
      promises.push(insert(req, apos.modules.article, 'article', {}, i));
    }

    const inserted = await Promise.all(promises);
    articleIds = inserted.map(doc => doc._id);

    assert(inserted.length === 500);
    assert(!!inserted[0]._id);
  });

  let jobTwo;
  it('can run a batch job', async function () {
    const req = apos.task.getReq();

    jobTwo = await jobModule.runBatch(
      req,
      articleIds,
      async function(req, id) {
        await apos.doc.db.updateOne({
          _id: id
        }, {
          $set: {
            checked: true
          }
        });
      }
    );

    assert(!!jobTwo.jobId);
  });

  it('can follow job as it works', async function () {
    const completed = await pollJob({
      route: `${jobModule.action}/${jobTwo.jobId}`,
      processed: 0,
      total: articleIds.length
    }, {
      jar
    });

    assert(completed === articleIds.length);
    const index = Math.floor(Math.random() * (articleIds.length - 1));

    const article = await apos.http.get(`/api/v1/article/${articleIds[index]}`, {
      jar
    });

    assert(article.checked === true);
  });

  // 🚧 Test run
  // 🚧 Test triggerNotification
  // 🚧 Test setTotal
});

function padInteger (i, places) {
  let s = i + '';
  while (s.length < places) {
    s = '0' + s;
  }
  return s;
}

async function insert (req, pieceModule, title, data, i) {
  const docData = Object.assign(pieceModule.newInstance(), {
    title: `${title} #${padInteger(i, 5)}`,
    slug: `${title}-${padInteger(i, 5)}`,
    ...data
  });

  return pieceModule.insert(req, docData);
};

async function pollJob(job, { jar }) {
  if (!job?.total) {
    return;
  }
  const { processed } = await apos.http.get(job.route, { jar });
  if (processed < job.total) {
    await new Promise(resolve => {
      setTimeout(resolve, 100);
    });

    return await pollJob(job, { jar });
  } else {
    return processed;
  }
}
