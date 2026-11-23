// The browser-side `apos.util.onReady` helper, exercised without a browser.
// In release builds the project `ui/src` bundle can run before the admin UI
// bundle that creates `apos.bus`. `onReady` must still call its function
// again each time the editor emits "refreshed".

const assert = require('node:assert/strict');

describe('apos.util.onReady (browser)', function() {
  let previousWindow;
  let previousDocument;
  let listeners;
  let util;

  function fire(name) {
    for (const fn of listeners[name] || []) {
      fn();
    }
  }

  function createBus() {
    const handlers = {};
    return {
      $on(name, fn) {
        (handlers[name] = handlers[name] || []).push(fn);
      },
      $emit(name) {
        for (const fn of handlers[name] || []) {
          fn();
        }
      }
    };
  }

  function nextTick() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  before(async function() {
    previousWindow = global.window;
    previousDocument = global.document;
    ({ default: util } = await import(
      '../modules/@apostrophecms/util/ui/src/util.js'
    ));
  });

  beforeEach(function() {
    listeners = {};
    const addEventListener = (name, fn) => {
      (listeners[name] = listeners[name] || []).push(fn);
    };
    global.window = {
      apos: {},
      addEventListener
    };
    // Module scripts run after parsing, while readyState is "interactive"
    // and before DOMContentLoaded
    global.document = {
      readyState: 'interactive',
      addEventListener
    };
  });

  after(function() {
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
    if (previousDocument === undefined) {
      delete global.document;
    } else {
      global.document = previousDocument;
    }
  });

  it('runs again on refresh when the bus is created after the zero timer', async function() {
    util();
    const apos = global.window.apos;
    let calls = 0;
    apos.util.onReady(() => {
      calls++;
    });
    await nextTick();
    assert.equal(calls, 1);

    // The admin UI bundle runs later and creates the bus
    apos.bus = createBus();
    global.document.readyState = 'complete';
    fire('DOMContentLoaded');
    fire('load');

    apos.bus.$emit('refreshed');
    assert.equal(calls, 2);
    apos.bus.$emit('refreshed');
    assert.equal(calls, 3);
  });

  it('subscribes one time when the bus already exists', async function() {
    global.window.apos.bus = createBus();
    util();
    const apos = global.window.apos;
    let calls = 0;
    apos.util.onReady(() => {
      calls++;
    });
    await nextTick();
    fire('DOMContentLoaded');
    fire('load');
    assert.equal(calls, 1);

    apos.bus.$emit('refreshed');
    assert.equal(calls, 2);
  });

  it('does not fail when there is no admin UI', async function() {
    util();
    const apos = global.window.apos;
    let calls = 0;
    apos.util.onReady(() => {
      calls++;
    });
    await nextTick();
    fire('DOMContentLoaded');
    fire('load');
    assert.equal(calls, 1);
    assert.equal(apos.bus, undefined);
  });
});
