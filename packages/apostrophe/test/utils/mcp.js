// Shared by the test/mcp-*.js files: a site with the MCP server on, and a
// connected user "editor" through the development token.

const t = require('../../test-lib/test.js');
const {
  Client, StreamableHTTPClientTransport
} = require('@modelcontextprotocol/client');

const PATH = '/api/v1/@apostrophecms/mcp';
const TOKEN = 'dev-token-0123456789abcdef';
const USERNAME = 'editor';

// Both protocol versions a client may speak: the SDK client negotiates
// 2026-07-28 with `auto`, and stays on the 2025 handshake with `legacy`
const MODES = [ 'auto', 'legacy' ];

// `root` is the test file's `module`. `modules` are merged in beside the
// enabled MCP module. `role` is the connected user's
async function createMcpApos(root, {
  options = {}, modules = {}, role = 'admin'
} = {}) {
  process.env.APOS_MCP_DEV_TOKEN = `${TOKEN}:${USERNAME}`;
  let apos;
  try {
    apos = await t.create({
      root,
      modules: {
        ...modules,
        '@apostrophecms/mcp': {
          ...modules['@apostrophecms/mcp'],
          options: {
            enabled: true,
            ...options
          }
        }
      }
    });
  } finally {
    delete process.env.APOS_MCP_DEV_TOKEN;
  }
  await t.createUser(apos, role, {
    username: USERNAME,
    title: 'Ed Itor'
  });
  return apos;
}

function getUrl(apos, path = PATH) {
  const { port } = apos.modules['@apostrophecms/express'].server.address();
  return `http://localhost:${port}${path}`;
}

// Runs `fn(client)` with an SDK client connected as "editor"
async function withClient(apos, mode, fn, { token = TOKEN } = {}) {
  const client = new Client(
    {
      name: 'apos-test',
      version: '1.0.0'
    },
    { versionNegotiation: { mode } }
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(getUrl(apos)), {
    requestInit: {
      headers: { authorization: `Bearer ${token}` }
    }
  }));
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

function initializeMessage() {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: {
        name: 'apos-test',
        version: '1.0.0'
      }
    }
  };
}

// A raw POST of an initialize request, with the development token unless
// `headers` says otherwise (`authorization: null` sends none), to the route
// unless `path` says otherwise
function post(apos, headers = {}, body = initializeMessage(), path = PATH) {
  const all = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${TOKEN}`,
    ...headers
  };
  return fetch(getUrl(apos, path), {
    method: 'POST',
    headers: Object.fromEntries(
      Object.entries(all).filter(([ , value ]) => value !== null)
    ),
    body: JSON.stringify(body)
  });
}

// A 2025-era answer may come as a one-event SSE stream
async function readJsonOrSse(response) {
  const text = await response.text();
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    return JSON.parse(text);
  }
  const data = text.split('\n').find(line => line.startsWith('data:'));
  return JSON.parse(data.slice('data:'.length));
}

// Runs `fn` with environment variables set, restoring them after
function withEnv(values, fn) {
  const saved = Object.fromEntries(
    Object.keys(values).map(name => [ name, process.env[name] ])
  );
  Object.assign(process.env, values);
  try {
    return fn();
  } finally {
    for (const [ name, value ] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

module.exports = {
  PATH,
  TOKEN,
  USERNAME,
  MODES,
  createMcpApos,
  getUrl,
  withClient,
  initializeMessage,
  post,
  readJsonOrSse,
  withEnv
};
