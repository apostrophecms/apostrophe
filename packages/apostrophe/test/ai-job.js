const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('AI generateJob', function() {
  this.timeout(t.timeout);

  let apos;
  let jobModule;
  // Each test scripts the fake adapter's chat: an array of thunks,
  // one consumed per call, each receiving the live request
  let chatScript;
  let chatCalls;
  let logRecords;
  // Every notification the publisher triggered, in call order; the
  // spy delegates to the real method so the docs land for real
  let triggered;
  let realTrigger;
  // Per-test coordination with the fixture tool handlers
  let gateNotify = null;
  let gateWait = null;
  let abortNotify = null;

  const toolCall = (id, name, input = {}) => ({
    type: 'toolCall',
    id,
    name,
    input
  });
  const toolTurn = (...calls) => () => ({
    content: calls,
    finishReason: 'toolCalls',
    usage: {
      inputTokens: 10,
      outputTokens: 5
    },
    model: 'fake-medium'
  });
  const textTurn = (text = 'done') => () => ({
    content: [ {
      type: 'text',
      text
    } ],
    finishReason: 'stop',
    usage: {
      inputTokens: 20,
      outputTokens: 3
    },
    model: 'fake-medium'
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'fake-adapters': {
          init(self) {
            self.apos.ai.addAdapter({
              name: 'fake',
              label: 'Fake',
              capabilities: {
                text: true,
                tools: true,
                structured: true
              },
              effort: {
                medium: { model: 'fake-medium' }
              },
              models: {
                'fake-medium': {
                  contextWindow: 200000,
                  maxOutputTokens: 16000
                }
              },
              validate() {},
              async chat(req, request) {
                // Snapshot: the loop keeps growing request.messages
                chatCalls.push({
                  ...request,
                  messages: [ ...request.messages ]
                });
                const step = chatScript.shift();
                if (step === undefined) {
                  throw new Error('chat called beyond its script');
                }
                return step(request);
              },
              normalizeError(err) {
                return err;
              }
            });
          }
        },
        'job-tools': {
          init(self) {
            const okInput = {
              type: 'object',
              properties: {}
            };
            const okSchema = { ok: { type: 'boolean' } };
            self.apos.ai.addTool({
              name: 'echo',
              description: 'The echo tool.',
              input: okInput,
              schema: okSchema,
              handler: async () => ({ ok: true })
            });
            // Ignores the abort signal: runs until the test releases it
            self.apos.ai.addTool({
              name: 'gate',
              description: 'The gate tool.',
              input: okInput,
              schema: okSchema,
              handler: async () => {
                if (gateNotify) {
                  gateNotify();
                }
                if (gateWait) {
                  await gateWait;
                }
                return { ok: true };
              }
            });
            // Honors the abort signal: winds down when it fires
            self.apos.ai.addTool({
              name: 'until_abort',
              description: 'The until_abort tool.',
              input: okInput,
              schema: { sawAbort: { type: 'boolean' } },
              handler: async (req, args) => {
                if (abortNotify) {
                  abortNotify();
                }
                while (!args._context.signal?.aborted) {
                  await delay(5);
                }
                return { sawAbort: true };
              }
            });
          }
        },
        '@apostrophecms/ai': {
          options: {
            provider: 'fake',
            providers: {
              fake: { apiKey: 'k1' }
            },
            retryBaseDelay: 1,
            jobPollInterval: 25
          }
        }
      }
    });
    jobModule = apos.modules['@apostrophecms/job'];
    realTrigger = apos.notification.trigger;
  });

  after(function() {
    return t.destroy(apos);
  });

  beforeEach(async function() {
    chatScript = [];
    chatCalls = [];
    logRecords = [];
    gateNotify = null;
    gateWait = null;
    abortNotify = null;
    apos.ai.logWarn = (req, type, message, data) => logRecords.push({
      severity: 'warn',
      type,
      message,
      data
    });
    apos.ai.logError = (req, type, message, data) => logRecords.push({
      severity: 'error',
      type,
      message,
      data
    });
    // The job module logs background failures; keep the output clean
    apos.util.error = () => {};
    triggered = [];
    apos.notification.trigger = (req, message, options) => {
      // Snapshot: trigger normalizes the options object in place
      triggered.push({
        message,
        options: { ...options }
      });
      return realTrigger.call(apos.notification, req, message, options);
    };
    await jobModule.db.deleteMany({});
    await apos.notification.db.deleteMany({});
  });

  it('returns a handle immediately and stores the exact blocking result', async function() {
    const req = apos.task.getReq({ user: { _id: 'owner1' } });
    const script = () => [
      toolTurn(toolCall('c1', 'echo')),
      textTurn('all done')
    ];

    chatScript = script();
    const blocking = await apos.ai.generate(req, 'find it', {
      tools: [ 'echo' ]
    });

    chatScript = script();
    const { jobId, cancel } = await apos.ai.generateJob(req, 'find it', {
      tools: [ 'echo' ]
    });

    assert.equal(typeof jobId, 'string');
    assert.equal(typeof cancel, 'function');
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'completed');
    assert.deepEqual(job.results, blocking);
    assert.equal(job.userId, 'owner1');
    assert.equal(job.expireAt instanceof Date, true);
  });

  it('fires onMessage with the jobId and onEnd with the result', async function() {
    const req = apos.task.getReq();
    const seen = [];
    let ended = null;
    chatScript = [
      toolTurn(toolCall('c1', 'echo')),
      textTurn('finished')
    ];

    const { jobId } = await apos.ai.generateJob(req, 'go', {
      tools: [ 'echo' ],
      onMessage(message, meta) {
        seen.push({
          message,
          meta
        });
      },
      onEnd(err, result) {
        ended = {
          err,
          result
        };
      }
    });
    const job = await waitForJob(jobId);

    assert.deepEqual(seen, [ {
      message: {
        role: 'assistant',
        content: [ toolCall('c1', 'echo') ]
      },
      meta: { jobId }
    } ]);
    assert.equal(ended.err, null);
    assert.equal(ended.result.finishReason, 'stop');
    assert.equal(ended.result.text, 'finished');
    assert.deepEqual(job.results, ended.result);
  });

  it('a failed run stores the error payload and reports it to onEnd', async function() {
    const req = apos.task.getReq();
    let ended = null;
    chatScript = [
      () => {
        throw apos.error('forbidden', 'nope', { docId: 'd1' });
      }
    ];

    const { jobId } = await apos.ai.generateJob(req, 'go', {
      onEnd(err, result) {
        ended = {
          err,
          result
        };
      }
    });
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'failed');
    assert.deepEqual(job.error, {
      name: 'forbidden',
      message: 'nope',
      data: { docId: 'd1' }
    });
    assert.equal(ended.err.name, 'forbidden');
    assert.equal(ended.result, undefined);
  });

  it('cancel(): the in-flight handler is waited out and its work recorded', async function() {
    const req = apos.task.getReq();
    let started;
    let release;
    const startedPromise = new Promise((resolve) => {
      started = resolve;
    });
    gateNotify = started;
    gateWait = new Promise((resolve) => {
      release = resolve;
    });
    chatScript = [
      toolTurn(toolCall('c1', 'gate'))
    ];

    const { jobId, cancel } = await apos.ai.generateJob(req, 'go', {
      tools: [ 'gate' ]
    });
    await startedPromise;
    await cancel();
    release();
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'cancelled');
    assert.equal(job.cancelRequested, true);
    assert.equal(job.results.finishReason, 'cancel');
    // The handler ignored the signal; the loop waited it out and its
    // completed work is recorded
    assert.deepEqual(job.results.steps, [ {
      toolCall: toolCall('c1', 'gate'),
      result: { ok: true }
    } ]);
    // No further model turn after the cancelled batch
    assert.equal(chatCalls.length, 1);
  });

  it('a cancel landing on the job record alone stops the run', async function() {
    const req = apos.task.getReq();
    let started;
    const startedPromise = new Promise((resolve) => {
      started = resolve;
    });
    abortNotify = started;
    chatScript = [
      toolTurn(toolCall('c1', 'until_abort'))
    ];

    const { jobId } = await apos.ai.generateJob(req, 'go', {
      tools: [ 'until_abort' ]
    });
    await startedPromise;
    // Another process would do exactly this — no local abort involved;
    // the run's poll of the record must pick it up
    await jobModule.requestCancel(jobId);
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'cancelled');
    assert.equal(job.results.finishReason, 'cancel');
    // The handler honored the signal the poll fired
    assert.deepEqual(job.results.steps, [ {
      toolCall: toolCall('c1', 'until_abort'),
      result: { sawAbort: true }
    } ]);
  });

  it('a deleted job record winds down its own run', async function() {
    const req = apos.task.getReq();
    let started;
    const startedPromise = new Promise((resolve) => {
      started = resolve;
    });
    abortNotify = started;
    let ended = null;
    let endedNotify;
    const endedPromise = new Promise((resolve) => {
      endedNotify = resolve;
    });
    chatScript = [
      toolTurn(toolCall('c1', 'until_abort'))
    ];

    await apos.ai.generateJob(req, 'go', {
      tools: [ 'until_abort' ],
      onEnd(err, result) {
        ended = {
          err,
          result
        };
        endedNotify();
      }
    });
    await startedPromise;
    // What record expiry — or any external cleanup — does; the record
    // is the only handle on the run, so its removal must stop it
    await jobModule.db.deleteMany({});
    await endedPromise;

    assert.equal(ended.err, null);
    assert.equal(ended.result.finishReason, 'cancel');
    assert.deepEqual(ended.result.steps, [ {
      toolCall: toolCall('c1', 'until_abort'),
      result: { sawAbort: true }
    } ]);
  });

  it('cancel mid provider call: aborts without retries, partial result preserved', async function() {
    const req = apos.task.getReq();
    chatScript = [
      (request) => new Promise((resolve, reject) => {
        request.signal.addEventListener('abort', () => {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
    ];

    const { jobId, cancel } = await apos.ai.generateJob(req, 'slow one');
    await waitFor(() => chatCalls.length === 1);
    await cancel();
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'cancelled');
    assert.deepEqual(job.results, {
      text: '',
      messages: [ {
        role: 'user',
        content: [ {
          type: 'text',
          text: 'slow one'
        } ]
      } ],
      finishReason: 'cancel',
      usage: {
        inputTokens: 0,
        outputTokens: 0
      },
      model: 'fake-medium',
      provider: 'fake'
    });
    // An abort is the caller's own doing: no failure record, no retry
    assert.deepEqual(logRecords, []);
  });

  it('onEnd throwing is logged, never recorded on the job', async function() {
    const req = apos.task.getReq();
    chatScript = [ textTurn('fine') ];

    const { jobId } = await apos.ai.generateJob(req, 'go', {
      onEnd() {
        throw new Error('hook bug');
      }
    });
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'completed');
    assert.equal(job.results.text, 'fine');
    assert.equal(job.error, undefined);
    assert.deepEqual(logRecords.map((record) => [ record.type, record.message ]), [
      [ 'hook', 'hook bug' ]
    ]);
  });

  it('publishes started, per-turn and ended events over hidden notifications', async function() {
    const req = apos.task.getReq({ user: { _id: 'owner1' } });
    const seen = [];
    chatScript = [
      toolTurn(toolCall('c1', 'echo')),
      textTurn('all done')
    ];

    const { jobId } = await apos.ai.generateJob(req, 'go', {
      tools: [ 'echo' ],
      onMessage(message) {
        seen.push(message);
      }
    });
    await waitForJob(jobId);

    const events = triggered.map(({ options }) => options.event);
    assert.deepEqual(
      events.map((event) => [ event.name, event.data.stage, event.data.jobId ]),
      [
        [ 'ai-generate-job', 'started', jobId ],
        [ 'ai-generate-job', 'message', jobId ],
        [ 'ai-generate-job', 'ended', jobId ]
      ]
    );
    assert.deepEqual(events[1].data.message, {
      role: 'assistant',
      content: [ toolCall('c1', 'echo') ]
    });
    assert.deepEqual(events[2].data, {
      jobId,
      stage: 'ended',
      status: 'completed',
      finishReason: 'stop'
    });
    // The caller's own hook ran alongside the publisher
    assert.equal(seen.length, 1);
    // Every stage travels as an invisible notification dismissing at
    // the fastest rate the knob offers
    for (const { message, options } of triggered) {
      assert.equal(message, ' ');
      assert.deepEqual(options.classes, [ 'apos-notification--hidden' ]);
      assert.equal(options.dismiss, 1);
    }
    // Delivered for real, to the job owner
    assert.equal(
      await apos.notification.db.countDocuments({ userId: 'owner1' }),
      3
    );
  });

  it('a failed run publishes an ended event carrying the error', async function() {
    const req = apos.task.getReq({ user: { _id: 'owner1' } });
    chatScript = [
      () => {
        throw apos.error('forbidden', 'nope');
      }
    ];

    const { jobId } = await apos.ai.generateJob(req, 'go');
    await waitForJob(jobId);

    assert.deepEqual(
      triggered.map(({ options }) => options.event.data.stage),
      [ 'started', 'ended' ]
    );
    assert.deepEqual(triggered.at(-1).options.event.data, {
      jobId,
      stage: 'ended',
      status: 'failed',
      error: {
        name: 'forbidden',
        message: 'nope'
      }
    });
  });

  it('a cancelled run publishes an ended event with the cancelled status', async function() {
    const req = apos.task.getReq({ user: { _id: 'owner1' } });
    chatScript = [
      (request) => new Promise((resolve, reject) => {
        request.signal.addEventListener('abort', () => {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
    ];

    const { jobId, cancel } = await apos.ai.generateJob(req, 'slow one');
    await waitFor(() => chatCalls.length === 1);
    await cancel();
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'cancelled');
    assert.deepEqual(triggered.at(-1).options.event.data, {
      jobId,
      stage: 'ended',
      status: 'cancelled',
      finishReason: 'cancel'
    });
  });

  it('notify: false delivers nothing while cancel still works', async function() {
    const req = apos.task.getReq({ user: { _id: 'owner1' } });
    chatScript = [
      (request) => new Promise((resolve, reject) => {
        request.signal.addEventListener('abort', () => {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
    ];

    const { jobId, cancel } = await apos.ai.generateJob(req, 'slow one', {
      notify: false
    });
    await waitFor(() => chatCalls.length === 1);
    await cancel();
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'cancelled');
    assert.equal(job.results.finishReason, 'cancel');
    assert.deepEqual(triggered, []);
  });

  it('a run without a user publishes nothing and still completes', async function() {
    // The task req has a user without an _id: nobody to deliver to
    const req = apos.task.getReq();
    chatScript = [ textTurn('fine') ];

    const { jobId } = await apos.ai.generateJob(req, 'go');
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'completed');
    assert.deepEqual(triggered, []);
    assert.deepEqual(logRecords, []);
  });

  it('a delivery failure is logged and never fails the run', async function() {
    const req = apos.task.getReq({ user: { _id: 'owner1' } });
    chatScript = [ textTurn('fine') ];
    apos.notification.trigger = async () => {
      throw new Error('channel down');
    };

    const { jobId } = await apos.ai.generateJob(req, 'go');
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'completed');
    assert.equal(job.results.text, 'fine');
    assert.deepEqual(
      logRecords.map((record) => [ record.type, record.message, record.data.stage ]),
      [
        [ 'notify', 'channel down', 'started' ],
        [ 'notify', 'channel down', 'ended' ]
      ]
    );
  });

  it('a tool handler cannot start a job', async function() {
    const req = apos.task.getReq();

    await assert.rejects(
      apos.ai.generateJob(req.clone({ aposAiDepth: 1 }), 'x'),
      (e) => {
        assert.equal(e.name, 'invalid');
        assert.match(e.message, /blocking only/);
        return true;
      }
    );
  });

  it('validates synchronously: no record is created for a bad call', async function() {
    const req = apos.task.getReq();
    const invalid = (promise, pattern) => assert.rejects(promise, (e) => {
      assert.equal(e.name, 'invalid');
      assert.match(e.message, pattern);
      return true;
    });

    await invalid(
      apos.ai.generateJob(req, 'x', { bogus: 1 }),
      /unknown option "bogus"/
    );
    await invalid(
      apos.ai.generateJob(req, 'x', { onEnd: 'call me' }),
      /"onEnd" must be a function/
    );
    await invalid(
      apos.ai.generateJob(req, 'x', { expireAfter: -1 }),
      /"expireAfter" must be a non-negative integer/
    );
    await invalid(
      apos.ai.generateJob(req, 'x', { notify: 1 }),
      /"notify" must be a boolean/
    );
    await invalid(
      apos.ai.generateJob(req),
      /a prompt string or an options object is required/
    );

    assert.equal(await jobModule.db.countDocuments({}), 0);
  });

  it('expireAfter: 0 keeps the record forever', async function() {
    const req = apos.task.getReq();
    chatScript = [ textTurn('fast') ];

    const { jobId } = await apos.ai.generateJob(req, 'quick', {
      expireAfter: 0
    });
    const job = await waitForJob(jobId);

    assert.equal(job.status, 'completed');
    assert.equal(job.expireAt, undefined);
  });

  async function waitForJob(jobId, deadline = Date.now() + 10000) {
    const job = await jobModule.db.findOne({ _id: jobId });

    if (!job || !job.ended) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for job ${jobId} to end`);
      }
      await delay(25);

      return waitForJob(jobId, deadline);
    }

    return job;
  }

  async function waitFor(condition, deadline = Date.now() + 10000) {
    while (!condition()) {
      if (Date.now() > deadline) {
        throw new Error('Timed out waiting for the condition');
      }
      await delay(10);
    }
  }

  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), ms);
    });
  }
});
