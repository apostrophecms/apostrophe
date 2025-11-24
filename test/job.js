const { strict: assert } = require('node:assert');
const t = require('../test-lib/test.js');

describe('Job module', function() {
  const logged = [];
  let apos;
  let jar;
  let jobModule;

  this.timeout(t.timeout);
  this.slow(2000);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type'
        }
      }
    });

    jobModule = apos.modules['@apostrophecms/job'];

    await t.createAdmin(apos);
    jar = await t.getUserJar(apos);
  });

  after(function() {
    return t.destroy(apos);
  });

  afterEach(async function () {
    await apos.doc.db.deleteMany({ type: 'article' });
    await apos.modules['@apostrophecms/job'].db.deleteMany({});
    await apos.lock.db.deleteMany({});
  });

  it('has a related database collection', function () {
    assert(jobModule.db);
  });

  it('jobOne: should create a new job + end a job and mark it as successful + should access a job via REST API GET request', async function () {
    const jobOne = await jobModule.start({});

    {
      const found = await jobModule.db.findOne({ _id: jobOne._id });

      const actual = found;
      const expected = {
        ...found,
        _id: jobOne._id,
        status: 'running',
        ended: false
      };

      assert.deepEqual(actual, expected, 'should create a new job');
    }

    {
      const result = await jobModule.end(jobOne, 'success', { testing: 'testing' });

      const found = await jobModule.db.findOne({ _id: jobOne._id });

      const actual = {
        count: result.result.nModified,
        job: found
      };
      const expected = {
        count: 1,
        job: {
          ...found,
          status: 'completed',
          ended: true
        }
      };

      assert.deepEqual(actual, expected, 'end a job and mark it as successful');
    }

    {
      const job = await apos.http.get(`/api/v1/@apostrophecms/job/${jobOne._id}`, {
        jar
      });

      const actual = job._id;
      const expected = jobOne._id;

      assert.equal(actual, expected, 'should access a job via REST API GET request');
    }
  });

  it('should add a notification when the job finished with some failures', async function () {
    const articleIds = await insertArticles(500);

    const req = apos.task.getReq({
      body: {
        messages: {
          completed: 'Tested {{ count }} {{ type }}.',
          completedWithFailures: 'Tested {{ count }} {{ type }} ({{ bad }} of {{ total }} failed).',
          failed: 'Testing {{ type }} failed.',
          progress: 'Testing {{ type }}...'
        }
      }
    });
    const { jobId } = await jobModule.runBatch(
      req,
      articleIds,
      async function(_req, id) {
        const article = await apos.doc.db.findOne({ _id: id });
        if (article.title.endsWith('5')) {
          throw new Error('It ends with a 5');
        }

        await apos.doc.db.updateOne(
          {
            _id: id
          },
          {
            $set: {
              checked: true
            }
          }
        );
      }
    );

    await pollJob(
      { route: `${jobModule.action}/${jobId}` },
      { jar }
    );
    const job = await jobModule.db.findOne({ _id: jobId });

    const notifications = await apos.notification.db
      .find({
        'context._id': job._id,
        message: /^Tested/
      })
      .toArray();

    const actual = {
      job,
      notifications: notifications.map(notification => ({
        interpolate: notification.interpolate,
        message: notification.message,
        type: notification.type
      }))
    };
    const expected = {
      job: {
        _id: job._id,
        bad: 50,
        ended: true,
        good: 450,
        processed: 500,
        results: job.results,
        status: 'completed',
        total: 500,
        when: job.when
      },
      notifications: [
        {
          interpolate: {
            bad: 50,
            count: null,
            good: 450,
            processed: 500,
            total: 500,
            type: 'document'
          },
          message: 'Tested {{ count }} {{ type }} ({{ bad }} of {{ total }} failed).',
          type: 'success'
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should add a notification when the job finished with failures only', async function () {
    const articleIds = await insertArticles(50);

    const req = apos.task.getReq({
      body: {
        messages: {
          completed: 'Tested {{ count }} {{ type }}.',
          completedWithFailures: 'Tested {{ count }} {{ type }} ({{ bad }} of {{ total }} failed).',
          failed: 'Testing {{ type }} failed.',
          progress: 'Testing {{ type }}...'
        }
      }
    });
    const { jobId } = await jobModule.runBatch(
      req,
      articleIds,
      function(_req, id) {
        throw new Error('It fails');
      }
    );

    await pollJob(
      { route: `${jobModule.action}/${jobId}` },
      { jar }
    );
    const job = await jobModule.db.findOne({ _id: jobId });

    const notifications = await apos.notification.db
      .find({
        'context._id': job._id,
        message: /^Testing.*failed\.$/
      })
      .toArray();

    const actual = {
      job,
      notifications: notifications.map(notification => ({
        interpolate: notification.interpolate,
        message: notification.message,
        type: notification.type
      }))
    };
    const expected = {
      job: {
        _id: job._id,
        bad: 50,
        ended: true,
        good: 0,
        processed: 50,
        results: job.results,
        status: 'completed',
        total: 50,
        when: job.when
      },
      notifications: [
        {
          interpolate: {
            bad: 50,
            count: null,
            good: 0,
            processed: 50,
            total: 50,
            type: 'document'
          },
          message: 'Testing {{ type }} failed.',
          type: 'success'
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  describe('jobTwo: can run a batch job + ', async function() {
    const articleIds = await insertArticles(500);
    let jobTwo;

    {
      const req = apos.task.getReq();

      jobTwo = await jobModule.runBatch(
        req,
        articleIds,
        async function(_req, id) {
          await apos.doc.db.updateOne({
            _id: id
          }, {
            $set: {
              checked: true
            }
          });
        }
      );

      assert(!!jobTwo.jobId, 'can run a batch job');
    };

    {
      const { completed } = await pollJob({
        route: `${jobModule.action}/${jobTwo.jobId}`
      }, {
        jar
      });

      const index = Math.floor(Math.random() * (articleIds.length - 1));

      const article = await apos.http.get(`/api/v1/article/${articleIds[index]}`, {
        jar
      });

      const actual = {
        checked: article.checked,
        count: completed
      };
      const expected = {
        checked: true,
        count: articleIds.length
      };

      assert.deepEqual(actual, expected, 'can follow the second job as it works');
    };
  });

  it('jobThree: can run a generic job + can follow the third job as it works', async function() {
    const articleIds = await insertArticles(500);
    let jobThree;

    {
      const req = apos.task.getReq();

      jobThree = await jobModule.run(
        req,
        async function(_req, reporters) {
          let count = 1;
          reporters.setTotal(articleIds.length);

          for (const id of articleIds) {
            await delay(3);
            logged.push(id);
            if (count % 2) {
              reporters.success();
            } else {
              reporters.failure();
            }
            count++;
          }
        }
      );

      assert(!!jobThree.jobId, 'can run a generic job');
    };

    {
      const route = `${jobModule.action}/${jobThree.jobId}`;
      const { total } = await apos.http.get(route, { jar });

      const {
        completed,
        good,
        bad
      } = await pollJob({
        route
      }, {
        jar
      });

      const actual = {
        total,
        completed,
        good,
        bad
      };
      const expected = {
        total: articleIds.length, // Tests setTotal()
        completed: articleIds.length,
        good: articleIds.length / 2, // Tests success()
        bad: articleIds.length / 2 // Tests failure()
      };

      assert.deepEqual(actual, expected, 'can follow the third job as it works');
    };
  });

  function padInteger (i, places) {
    let s = i + '';
    while (s.length < places) {
      s = '0' + s;
    }
    return s;
  }

  async function insertArticles(count = 500) {
    const req = apos.task.getReq();
    const promises = [];

    for (let i = 1; i <= count; i++) {
      promises.push(
        apos.modules.article.insert(
          req,
          {
            ...apos.modules.article.newInstance(),
            title: `article #${padInteger(i, 5)}`,
            slug: `article-${padInteger(i, 5)}`
          }
        )
      );
    }

    const inserted = await Promise.all(promises);
    const articleIds = inserted.map(doc => doc._id);

    assert.equal(inserted.length, count);

    return articleIds;
  };

  async function pollJob(job, { jar }) {
    const {
      processed,
      total,
      good,
      bad
    } = await apos.http.get(job.route, { jar });

    if (processed < total) {
      await delay(100);

      return await pollJob(job, { jar });
    } else {
      return {
        completed: processed,
        good,
        bad
      };
    }
  }

  function delay(ms) {
    return new Promise(function(resolve, reject) {
      setTimeout(() => resolve(true), ms);
    });
  }
});
