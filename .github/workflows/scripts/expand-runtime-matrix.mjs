#!/usr/bin/env node
// Expands the impacted package matrix with runtime permutations supplied 
// via env vars.
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

const impact = JSON.parse(await readFile(impactPath, 'utf8'));
const packages = impact?.matrix?.include || [];
const include = [];

for (const pkg of packages) {
  for (const nodeVersion of nodeVersions) {
    for (const mongodbVersion of mongodbVersions) {
      include.push({
        ...pkg,
        nodeVersion,
        mongodbVersion
      });
    }
  }
}

process.stdout.write(JSON.stringify({ include }));
