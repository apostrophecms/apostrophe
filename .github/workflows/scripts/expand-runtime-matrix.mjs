#!/usr/bin/env node
// Expands the impacted package matrix with runtime permutations supplied
// via env vars.
//
// For packages that need a database (requiresMongo !== false), three adapter
// variants are emitted:
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
const include = [];

for (const pkg of packages) {
  const needsDb = pkg.requiresMongo !== false;
  const needsRedis = pkg.requiresRedis === true;

  if (needsDb) {
    // mongodb: all Node versions × all MongoDB versions
    for (const nodeVersion of nodeVersions) {
      for (const mongodbVersion of mongodbVersions) {
        include.push({
          ...pkg,
          nodeVersion,
          mongodbVersion,
          adapter: 'mongodb',
          needsMongo: true,
          needsPostgres: false,
          needsRedis
        });
      }
    }
    // postgres and sqlite: latest LTS only, skip for mongodb-only packages
    if (!pkg.mongodbOnly) {
      include.push({
        ...pkg,
        nodeVersion: latestLts,
        mongodbVersion: '',
        adapter: 'postgres',
        needsMongo: false,
        needsPostgres: true,
        needsRedis
      });
      include.push({
        ...pkg,
        nodeVersion: latestLts,
        mongodbVersion: '',
        adapter: 'sqlite',
        needsMongo: false,
        needsPostgres: false,
        needsRedis
      });
    }
  } else {
    // Non-database packages: just expand across Node versions
    for (const nodeVersion of nodeVersions) {
      include.push({
        ...pkg,
        nodeVersion,
        mongodbVersion: '',
        adapter: '',
        needsMongo: false,
        needsPostgres: false,
        needsRedis
      });
    }
  }
}

process.stdout.write(JSON.stringify({ include }));
