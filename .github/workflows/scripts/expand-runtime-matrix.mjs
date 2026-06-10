#!/usr/bin/env node
// Expands the impacted package matrix with runtime permutations supplied
// via env vars.
//
// Packages are grouped into jobs to stay within GitHub's 256-entry matrix limit:
//   - "apostrophe" runs solo (the main package, benefits from its own status).
//   - All other database packages are grouped into an "ecosystem" job.
//   - mongodbOnly packages are grouped into "ecosystem-mongodb".
//   - Non-database packages are grouped into "standalone".
//
// For groups that need a database, three adapter variants are emitted:
//   1. mongodb  – all Node versions × all MongoDB versions
//   2. postgres – latest LTS Node only, no MongoDB
//   3. sqlite   – latest LTS Node only, no MongoDB
//
// The latest LTS Node version is the highest even-numbered entry in
// NODE_VERSIONS_JSON.

import { readFile } from 'fs/promises';

const args = process.argv.slice(2);
let impactPath = 'impact.json';
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--impact' && args[i + 1]) {
    impactPath = args[i + 1];
    i += 1;
    continue;
  }
  if (arg.startsWith('--impact=')) {
    impactPath = arg.split('=')[1];
  }
}

function parseJsonArray(name, raw) {
  if (!raw) {
    throw new Error(`Missing ${name} env var`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse ${name}: ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${name} must be a non-empty JSON array`);
  }
  return parsed;
}

const nodeVersions = parseJsonArray('NODE_VERSIONS_JSON', process.env.NODE_VERSIONS_JSON);
const mongodbVersions = parseJsonArray('MONGODB_VERSIONS_JSON', process.env.MONGODB_VERSIONS_JSON);

// Latest LTS = highest even-numbered Node version
const latestLts = [...nodeVersions]
  .filter((v) => Number(v) % 2 === 0)
  .sort((a, b) => Number(b) - Number(a))[0];

const impact = JSON.parse(await readFile(impactPath, 'utf8'));
const packages = impact?.matrix?.include || [];

// The main apostrophe package always gets its own jobs for clear CI status.
const SOLO_PACKAGES = new Set(['apostrophe']);

// Sort packages into groups
const solo = [];
const ecosystem = [];
const ecosystemMongodbOnly = [];
const standalone = [];

for (const pkg of packages) {
  const needsDb = pkg.requiresMongo !== false;
  if (SOLO_PACKAGES.has(pkg.package)) {
    solo.push(pkg);
  } else if (needsDb && pkg.mongodbOnly) {
    ecosystemMongodbOnly.push(pkg);
  } else if (needsDb) {
    ecosystem.push(pkg);
  } else {
    standalone.push(pkg);
  }
}

const include = [];

// Emit runtime combinations for a group of packages.
function emitGroup(group, pkgs) {
  if (!pkgs.length) {
    return;
  }
  const packageNames = JSON.stringify(pkgs.map((p) => p.package));
  const needsRedis = pkgs.some((p) => p.requiresRedis === true);
  const mongodbOnly = pkgs.every((p) => p.mongodbOnly);

  // mongodb: all Node versions × all MongoDB versions
  for (const nodeVersion of nodeVersions) {
    for (const mongodbVersion of mongodbVersions) {
      include.push({
        group,
        packages: packageNames,
        nodeVersion,
        mongodbVersion,
        adapter: 'mongodb',
        needsMongo: true,
        needsPostgres: false,
        needsRedis
      });
    }
  }
  // postgres and sqlite: latest LTS only, skip for mongodb-only groups
  if (!mongodbOnly) {
    include.push({
      group,
      packages: packageNames,
      nodeVersion: latestLts,
      mongodbVersion: '',
      adapter: 'postgres',
      needsMongo: false,
      needsPostgres: true,
      needsRedis
    });
    include.push({
      group,
      packages: packageNames,
      nodeVersion: latestLts,
      mongodbVersion: '',
      adapter: 'sqlite',
      needsMongo: false,
      needsPostgres: false,
      needsRedis
    });
  }
}

// Emit non-database group (no adapter variants, just Node versions)
function emitStandalone(group, pkgs) {
  if (!pkgs.length) {
    return;
  }
  const packageNames = JSON.stringify(pkgs.map((p) => p.package));
  for (const nodeVersion of nodeVersions) {
    include.push({
      group,
      packages: packageNames,
      nodeVersion,
      mongodbVersion: '',
      adapter: '',
      needsMongo: false,
      needsPostgres: false,
      needsRedis: false
    });
  }
}

// Solo packages each get their own group
for (const pkg of solo) {
  emitGroup(pkg.package, [pkg]);
}

if (ecosystem.length) {
  emitGroup('ecosystem', ecosystem);
}
if (ecosystemMongodbOnly.length) {
  emitGroup('ecosystem-mongodb', ecosystemMongodbOnly);
}
if (standalone.length) {
  emitStandalone('standalone', standalone);
}

process.stdout.write(JSON.stringify({ include }));
