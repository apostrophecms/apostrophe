// Check a running dev server: log in, follow every module the home page
// loads (static and dynamic imports), and report failures, dependencies
// served raw instead of pre-bundled, and files served under two URLs.
//
//   node dev-check.mjs <project-dir> <port> <out-file> [user] [password]
//
// Writes the sorted list of module URLs (query strings removed) to
// <out-file> so two runs can be compared. Exits 1 on any problem.
// The user is created with `node app @apostrophecms/user:add` (README).
import fs from 'node:fs';
import path from 'node:path';

const [ dir, port, outFile, user = 'pro10258', password = process.env.PRO10258_PASSWORD ] = process.argv.slice(2);
if (!dir || !port || !outFile || !password) {
  console.error('usage: node dev-check.mjs <project-dir> <port> <out-file> [user] [password]');
  console.error('(or set PRO10258_PASSWORD)');
  process.exit(2);
}
const project = path.resolve(dir);
const base = `http://localhost:${port}`;

// Log in for a session cookie, so the admin UI scripts are on the page
const login = await fetch(`${base}/api/v1/@apostrophecms/login/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: user,
    password,
    session: true
  })
});
const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
if (!login.ok || !cookie) {
  console.log(`login failed: ${login.status}`);
  process.exit(1);
}
const headers = { cookie };

const html = await (await fetch(base + '/', { headers })).text();
const entries = [ ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g) ].map((m) => m[1]);
console.log('entry scripts: ' + entries.join(' '));

const seen = new Set();
const queue = entries.map((e) => new URL(e, base).href);
const failed = [];
const rawCommonJs = [];
while (queue.length) {
  const url = queue.shift();
  if (seen.has(url)) {
    continue;
  }
  seen.add(url);
  const res = await fetch(url, { headers });
  const body = await res.text();
  if (!res.ok) {
    failed.push(`${res.status} ${new URL(url).pathname}: ${body.slice(0, 200).replace(/\s+/g, ' ')}`);
    continue;
  }
  const { pathname } = new URL(url);
  // CommonJS served as-is breaks in the browser; Vite must pre-bundle it
  if (pathname.includes('node_modules') && !pathname.includes('/deps/') &&
      /(^|[^.\w])(module\.exports|exports\.\w+\s*=|require\()/.test(body) &&
      !/^\s*(import|export)\s/m.test(body)) {
    rawCommonJs.push(pathname);
  }
  const imports = body.matchAll(/(?:\bimport\s*(?:[\w*{}\s,$]+from\s*)?|\bexport\s*[\w*{}\s,$]+from\s*|\bimport\()\s*["']([^"']+)["']/g);
  for (const [ , spec ] of imports) {
    if (spec.startsWith('/') || spec.startsWith('.')) {
      queue.push(new URL(spec, url).href);
    }
  }
}

const paths = [ ...seen ].map((u) => new URL(u).pathname).sort();
fs.writeFileSync(outFile, paths.join('\n') + '\n');

// Same real file under two URLs = two module instances in the browser
const byReal = new Map();
for (const p of paths.filter((p) => p.includes('node_modules') && !p.includes('/deps/'))) {
  let file = decodeURIComponent(p.replace(/^\/__vite/, ''));
  if (file.startsWith('/@fs/')) {
    // /@fs/C:/x on Windows, /@fs/Users/x on macOS
    file = file.slice(5);
    if (!/^[a-zA-Z]:/.test(file)) {
      file = '/' + file;
    }
  } else {
    file = path.join(project, file);
  }
  let real;
  try {
    real = fs.realpathSync(file).toLowerCase();
  } catch {
    real = '?' + file;
  }
  byReal.set(real, [ ...(byReal.get(real) ?? []), p ]);
}
const twice = [ ...byReal.values() ].filter((urls) => urls.length > 1);

console.log(`modules ok: ${paths.length - failed.length}, failed: ${failed.length}`);
console.log(`pre-bundled: ${paths.filter((p) => p.includes('/deps/')).length}, raw dependency files: ${byReal.size}`);
console.log(`raw CommonJS: ${rawCommonJs.length}, served twice: ${twice.length}`);
failed.slice(0, 10).forEach((f) => console.log('  FAILED ' + f));
rawCommonJs.slice(0, 10).forEach((f) => console.log('  RAW CJS ' + f));
twice.slice(0, 5).forEach((urls) => console.log('  TWICE ' + urls.join(' | ')));
process.exit(failed.length || rawCommonJs.length || twice.length ? 1 : 0);
