#!/usr/bin/env node
// Load a URL in headless Chrome, optionally logged in, run an expression once
// the page has settled and print the result as JSON. For checking that
// browser-side code actually ran — that an editor mounted, that a class was
// added — which fetching HTML cannot tell you.
//
//   node claude-tools/browser-probe.mjs <url> '<js expression>' [--cookie name=value] ...
//   node claude-tools/browser-probe.mjs <url> '<js>' --login <loginUrl> --user admin --password secret
//   node claude-tools/browser-probe.mjs <url> '<js>' --wait 5000
//
// The expression is evaluated in the page, awaited if it is a promise, and
// must return something JSON serializable. Console messages and page errors
// are printed to stderr, which is usually where the answer turns out to be.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const url = args[0];
const expression = args[1];
if (!url || !expression) {
  console.error('usage: browser-probe.mjs <url> <js expression> [--cookie n=v] [--login url --user u --password p] [--wait ms]');
  process.exit(2);
}

const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return (i === -1) ? fallback : args[i + 1];
};
const cookies = args.reduce((list, arg, i) => (
  (arg === '--cookie') ? [ ...list, args[i + 1] ] : list
), []);
const wait = parseInt(opt('wait', '3000'), 10);
const port = parseInt(opt('port', '9222'), 10);
const loginUrl = opt('login');
const username = opt('user');
const password = opt('password');

const chrome = spawn('google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + (process.env.TMPDIR || '/tmp') + '/browser-probe-' + process.pid,
  'about:blank'
], { stdio: [ 'ignore', 'ignore', 'pipe' ] });

const cleanup = () => {
  try {
    chrome.kill('SIGKILL');
  } catch (e) {
    // Already gone
  }
};
process.on('exit', cleanup);

// Chrome prints the devtools URL to stderr, but polling the HTTP endpoint is
// less fragile than parsing it
async function endpoint() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch (e) {
      await sleep(100);
    }
  }
  throw new Error('Chrome never opened its debugging port');
}

const ws = new WebSocket(await endpoint());
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let nextId = 1;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    return message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    const text = message.params.args.map(a => a.value ?? a.description ?? a.type).join(' ');
    console.error(`[console.${message.params.type}] ${text}`);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    console.error('[page error]', message.params.exceptionDetails.text,
      message.params.exceptionDetails.exception?.description ?? '');
  }
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, {
    resolve,
    reject
  });
  ws.send(JSON.stringify({
    id,
    method,
    params
  }));
});

// One tab, driven by the browser-level session
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', {
  targetId,
  flatten: true
});
const sendTab = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, {
    resolve,
    reject
  });
  ws.send(JSON.stringify({
    id,
    method,
    params,
    sessionId
  }));
});

await sendTab('Page.enable');
await sendTab('Runtime.enable');
await sendTab('Network.enable');

const origin = new URL(url).origin;

// Log in through the site's own endpoint so the cookie is whatever it would
// really be, rather than a guess about the session format
if (loginUrl) {
  await sendTab('Page.navigate', { url: origin });
  await sleep(500);
  const login = await sendTab('Runtime.evaluate', {
    expression: `fetch(${JSON.stringify(loginUrl)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ${JSON.stringify(username)},
        password: ${JSON.stringify(password)},
        session: true
      })
    }).then(res => res.status)`,
    awaitPromise: true,
    returnByValue: true
  });
  console.error('[login] status', login.result.value);
}

for (const cookie of cookies) {
  const [ name, ...rest ] = cookie.split('=');
  await sendTab('Network.setCookie', {
    name,
    value: rest.join('='),
    url: origin
  });
}

await sendTab('Page.navigate', { url });
await sleep(wait);

const { result, exceptionDetails } = await sendTab('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true
});
if (exceptionDetails) {
  console.error('[evaluate failed]', exceptionDetails.text,
    exceptionDetails.exception?.description ?? '');
  cleanup();
  process.exit(1);
}
console.log(JSON.stringify(result.value, null, 2));
cleanup();
process.exit(0);
