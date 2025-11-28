#!/usr/bin/env node
// Determines which workspace packages should be tested by diffing 
// with the default branch and expanding the dependency graph so 
// that downstream dependents are also exercised.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const packagesRoot = path.join(repoRoot, 'packages');

const defaultBranch = process.env.DEFAULT_BRANCH || 'main';
const forceAll = process.env.FORCE_ALL === 'true';
const baseShaEnv = (process.env.BASE_SHA || '').trim();

const GLOBAL_IMPACT_PATHS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml'
]);

const GLOBAL_IMPACT_PREFIXES = [];
const IGNORED_PACKAGE_DIRS = new Set([
  'vue-material-design-icons'
]);

/**
 * @typedef {Object} MatrixEntry
 * @property {string} package - Workspace package name (scope included).
 * @property {string} directory - Workspace-relative directory for the package.
 */

/**
 * @typedef {Object} ImpactResult
 * @property {{ include: MatrixEntry[] }} matrix - JSON payload consumed by GitHub matrix jobs.
 * @property {boolean} hasPackages - True when at least one package needs to run.
 */

async function main() {
  const packages = await loadPackages();
  const packageNames = [...packages.keys()];
  const dirLookup = buildDirLookup(packages);

  const baseSha = baseShaEnv || resolveBaseSha();
  const shouldForceAll = forceAll || !baseSha;
  const changedFiles = shouldForceAll
    ? []
    : getChangedFiles(baseSha);

  const { changedPackages, hasGlobalImpact } = determineChangedPackages(
    changedFiles,
    dirLookup
  );

  const impactedPackages = shouldForceAll || hasGlobalImpact
    ? packageNames
    : expandImpactedPackages(changedPackages, packages);

  const uniqueImpacted = [...new Set(impactedPackages)].filter((name) => packages.has(name));
  uniqueImpacted.sort();

  const matrix = {
    include: uniqueImpacted.map((name) => ({
      package: name,
      directory: packages.get(name).relativeDir
    }))
  };

  /** @type {ImpactResult} */
  const result = {
    matrix,
    hasPackages: matrix.include.length > 0
  };

  process.stdout.write(JSON.stringify(result));
}

async function loadPackages() {
  const map = new Map();
  let entries;
  try {
    entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Unable to read packages directory: ${error.message}`);
  }

  await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      if (IGNORED_PACKAGE_DIRS.has(entry.name)) {
        return;
      }
      const packageDir = path.join(packagesRoot, entry.name);
      const manifestPath = path.join(packageDir, 'package.json');
      let manifest;
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        manifest = JSON.parse(raw);
      } catch (error) {
        console.warn(`Skipping ${entry.name}: ${error.message}`);
        return;
      }

      if (!manifest.name) {
        console.warn(`Skipping ${entry.name}: missing package name`);
        return;
      }

      const dependencies = new Set([
        ...Object.keys(manifest.dependencies || {}),
        ...Object.keys(manifest.devDependencies || {}),
        ...Object.keys(manifest.peerDependencies || {}),
        ...Object.keys(manifest.optionalDependencies || {})
      ]);

      map.set(manifest.name, {
        name: manifest.name,
        relativeDir: path.posix.join('packages', entry.name),
        dependencies
      });
    }));

  return map;
}

function buildDirLookup(packages) {
  const dirMap = new Map();
  for (const pkg of packages.values()) {
    dirMap.set(pkg.relativeDir, pkg.name);
  }
  return dirMap;
}

function resolveBaseSha() {
  try {
    const mergeBase = execSync(`git merge-base HEAD origin/${defaultBranch}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return mergeBase || '';
  } catch (error) {
    return '';
  }
}

function getChangedFiles(baseSha) {
  if (!baseSha) {
    return [];
  }

  try {
    const output = execSync(`git diff --name-only ${baseSha} HEAD`, {
      encoding: 'utf8'
    }).trim();
    if (!output) {
      return [];
    }
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function determineChangedPackages(changedFiles, dirLookup) {
  const changedPackages = new Set();
  let hasGlobalImpact = false;

  for (const file of changedFiles) {
    if (file.startsWith('packages/')) {
      const [, packageDir] = file.split('/');
      if (!packageDir) {
        continue;
      }
      const dirKey = `packages/${packageDir}`;
      const pkgName = dirLookup.get(dirKey);
      if (pkgName) {
        changedPackages.add(pkgName);
      }
      continue;
    }

    if (GLOBAL_IMPACT_PATHS.has(file)) {
      hasGlobalImpact = true;
      break;
    }

    if (GLOBAL_IMPACT_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      hasGlobalImpact = true;
      break;
    }
  }

  return { changedPackages, hasGlobalImpact };
}

function expandImpactedPackages(changedPackages, packages) {
  if (!changedPackages.size) {
    return [];
  }

  const dependentsMap = buildDependentsMap(packages);
  const queue = [...changedPackages];
  const impacted = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || impacted.has(current)) {
      continue;
    }
    impacted.add(current);
    const dependents = dependentsMap.get(current);
    if (dependents) {
      dependents.forEach((dependent) => {
        if (!impacted.has(dependent)) {
          queue.push(dependent);
        }
      });
    }
  }

  return [...impacted];
}

function buildDependentsMap(packages) {
  const map = new Map();
  const packageNames = new Set(packages.keys());

  for (const pkg of packages.values()) {
    for (const depName of pkg.dependencies) {
      if (!packageNames.has(depName)) {
        continue;
      }
      if (!map.has(depName)) {
        map.set(depName, new Set());
      }
      map.get(depName).add(pkg.name);
    }
  }

  return map;
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
