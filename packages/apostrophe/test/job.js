const { strict: assert } = require('node:assert');
const t = require('../test-lib/test.js');

describe('Job module', function() {
  const logged = [];
  let apos;
  let admin;
  let jar;
  let editorJar;
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

    admin = await t.createAdmin(apos);
    jar = await t.getUserJar(apos);
    await t.createUser(apos, 'editor');
    editorJar = await t.loginAs(apos, 'editor');
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
        cancelRequested: false,
        ended: true,
        endedAt: job.endedAt,
        good: 450,
        processed: 500,
        results: job.results,
        startedAt: job.startedAt,
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
        cancelRequested: false,
        ended: true,
        endedAt: job.endedAt,
        good: 0,
        processed: 50,
        results: job.results,
        startedAt: job.startedAt,
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
          await reporters.setTotal(articleIds.length);

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

  describe('ownership, cancellation, error payload and TTL', function() {
    it('start: stamps startedAt and cancelRequested, records opt-in userId and expireAt', async function() {
      const job = await jobModule.start({
        userId: admin._id,
        expireAfter: 3600
      });
      const found = await jobModule.db.findOne({ _id: job._id });

      const actual = {
        cancelRequested: found.cancelRequested,
        startedAt: found.startedAt,
        userId: found.userId,
        expireAt: found.expireAt
      };
      const expected = {
        cancelRequested: false,
        startedAt: found.when,
        userId: admin._id,
        expireAt: new Date(found.when.getTime() + 3600 * 1000)
      };

      assert.deepEqual(actual, expected);
    });

    it('start: jobs carry no userId or expireAt unless requested', async function() {
      const job = await jobModule.start({});
      const found = await jobModule.db.findOne({ _id: job._id });

      const actual = {
        userId: found.userId,
        expireAt: found.expireAt
      };
      const expected = {
        userId: undefined,
        expireAt: undefined
      };

      assert.deepEqual(actual, expected);
    });

    it('has a sparse index on expireAt for the expired-job sweep', async function() {
      const indexes = await jobModule.db.indexes();
      const index = indexes.find(index => index.key.expireAt === 1);

      assert.equal(index && index.sparse, true);
    });

    it('cleanupExpired: deletes only jobs whose expireAt has passed', async function() {
      const expired = await jobModule.start({ expireAfter: 0.001 });
      const kept = await jobModule.start({ expireAfter: 3600 });
      const legacy = await jobModule.start({});
      await delay(10);

      await jobModule.cleanupExpired();

      const actual = {
        expired: await jobModule.db.findOne({ _id: expired._id }),
        kept: (await jobModule.db.findOne({ _id: kept._id }))._id,
        legacy: (await jobModule.db.findOne({ _id: legacy._id }))._id
      };
      const expected = {
        expired: null,
        kept: kept._id,
        legacy: legacy._id
      };

      assert.deepEqual(actual, expected);
    });

    it('start: sweeps expired jobs', async function() {
      const expired = await jobModule.start({ expireAfter: 0.001 });
      await delay(10);

      await jobModule.start({});

      // The sweep is fire-and-forget; poll until it lands
      const deadline = Date.now() + 10000;
      while (await jobModule.db.findOne({ _id: expired._id })) {
        if (Date.now() > deadline) {
          throw new Error('Timed out waiting for the expired job to be swept');
        }
        await delay(25);
      }
    });

    it('getOne: a job with userId is visible to its owner only', async function() {
      const job = await jobModule.start({ userId: admin._id });
      const route = `${jobModule.action}/${job._id}`;

      const fetched = await apos.http.get(route, { jar });
      assert.equal(fetched._id, job._id);

      await assert.rejects(
        apos.http.get(route, { jar: editorJar }),
        { status: 404 }
      );
    });

    it('getOne: a job without userId keeps the legacy access rule', async function() {
      const job = await jobModule.start({});

      const fetched = await apos.http.get(`${jobModule.action}/${job._id}`, {
        jar: editorJar
      });

      assert.equal(fetched._id, job._id);
    });

    it('cancel route: the owner can request cancellation, others cannot', async function() {
      const job = await jobModule.start({ userId: admin._id });
      const route = `${jobModule.action}/${job._id}/cancel`;

      await assert.rejects(
        apos.http.post(route, {
          jar: editorJar,
          body: {}
        }),
        { status: 404 }
      );

      await apos.http.post(route, {
        jar,
        body: {}
      });
      const found = await jobModule.db.findOne({ _id: job._id });

      assert.equal(found.cancelRequested, true);
    });

    it('requestCancel: has no effect on an ended job', async function() {
      const job = await jobModule.start({});
      await jobModule.end(job, true);

      await jobModule.requestCancel(job._id);
      const found = await jobModule.db.findOne({ _id: job._id });

      const actual = {
        cancelRequested: found.cancelRequested,
        status: found.status
      };
      const expected = {
        cancelRequested: false,
        status: 'completed'
      };

      assert.deepEqual(actual, expected);
    });

    it('end: stamps endedAt and a cancelled status when cancellation was requested', async function() {
      const job = await jobModule.start({});
      await jobModule.requestCancel(job._id);

      await jobModule.end(job, true, { partial: true });
      const found = await jobModule.db.findOne({ _id: job._id });

      const actual = {
        status: found.status,
        ended: found.ended,
        results: found.results,
        endedAt: found.endedAt instanceof Date
      };
      const expected = {
        status: 'cancelled',
        ended: true,
        results: { partial: true },
        endedAt: true
      };

      assert.deepEqual(actual, expected);
    });

    it('run: a cooperatively cancelled job ends cancelled with partial results', async function() {
      const req = apos.task.getReq();

      const { jobId } = await jobModule.run(req, async function(_req, reporting) {
        reporting.setTotal(20);
        for (let i = 0; i < 20; i++) {
          if (await reporting.isCanceling()) {
            reporting.setResults({ stoppedAt: i });
            return;
          }
          reporting.success();
          await delay(25);
        }
        reporting.setResults({ stoppedAt: null });
      });
      await jobModule.requestCancel(jobId);
      const job = await waitForEnded(jobId);

      const actual = {
        status: job.status,
        stoppedEarly: job.results.stoppedAt !== null && job.results.stoppedAt < 20
      };
      const expected = {
        status: 'cancelled',
        stoppedEarly: true
      };

      assert.deepEqual(actual, expected);
    });

    it('run: isCanceling reports true once the job record is gone', async function() {
      const req = apos.task.getReq();
      const observed = [];

      const { jobId } = await jobModule.run(req, async function(_req, reporting) {
        observed.push(await reporting.isCanceling());
        await jobModule.db.deleteMany({ _id: jobId });
        observed.push(await reporting.isCanceling());
      });

      // The record is deleted mid-run, so poll the observations instead
      const deadline = Date.now() + 10000;
      while (observed.length < 2) {
        if (Date.now() > deadline) {
          throw new Error('Timed out waiting for the run to observe both states');
        }
        await delay(25);
      }

      assert.deepEqual(observed, [ false, true ]);
    });

    it('run: records a failed status and the error payload when doTheWork throws', async function() {
      const req = apos.task.getReq();
      const originalError = apos.util.error;
      apos.util.error = () => {};

      try {
        const { jobId } = await jobModule.run(req, async function() {
          throw apos.error('invalid', 'boom', { reason: 'testing' });
        });
        const job = await waitForEnded(jobId);

        const actual = {
          status: job.status,
          error: job.error
        };
        const expected = {
          status: 'failed',
          error: {
            name: 'invalid',
            message: 'boom',
            data: { reason: 'testing' }
          }
        };

        assert.deepEqual(actual, expected);
      } finally {
        apos.util.error = originalError;
      }
    });

    it('run: notifications: false skips the legacy messages wiring', async function() {
      const req = apos.task.getReq({
        body: {
          messages: {
            progress: 'Opted out progress...',
            completed: 'Opted out done.'
          }
        }
      });

      const { jobId } = await jobModule.run(req, async function(_req, reporting) {
        reporting.setTotal(1);
        reporting.success();
      }, {
        notifications: false
      });
      await waitForEnded(jobId);

      const notifications = await apos.notification.db
        .find({ message: /^Opted out/ })
        .toArray();

      assert.equal(notifications.length, 0);
    });
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

  async function waitForEnded(jobId, deadline = Date.now() + 10000) {
    const job = await jobModule.db.findOne({ _id: jobId });

    if (!job || !job.ended) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for job ${jobId} to end`);
      }
      await delay(50);

      return waitForEnded(jobId, deadline);
    }

    return job;
  }

  function delay(ms) {
    return new Promise(function(resolve, reject) {
      setTimeout(() => resolve(true), ms);
    });
  }
});
