// Usage: npx mocha .github/workflows/scripts/test-impacted-packages.mjs
import assert from 'assert/strict';
import path from 'path';
import { promises as fs } from 'fs';
import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const packagesRoot = path.join(repoRoot, 'packages');
const detectorScriptPath = path.join(repoRoot, '.github', 'workflows', 'scripts', 'detect-impacted-packages.mjs');
const impactBranch = 'impact-workflow-test';

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Impact Workflow',
  GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'impact@example.com',
  GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Impact Workflow',
  GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'impact@example.com'
};

const state = {
  baseBranchName: undefined,
  baseBranchSha: undefined,
  savedBranchHead: undefined,
  packages: new Map(),
  packagesWithTests: [],
  apostrophePackageName: undefined,
  anchorsPackageName: undefined
};

describe('detect-impacted-packages workflow', function () {
  this.timeout(20000);

  before(async function () {
    ensureCleanWorkingTree();
    state.packages = await loadPackages();
    state.packagesWithTests = [...state.packages.values()]
      .filter((pkg) => pkg.hasTestScript)
      .map((pkg) => pkg.name)
      .sort();

    const apostropheEntry = state.packages.get('apostrophe');
    if (!apostropheEntry) {
      throw new Error('apostrophe package not found');
    }
    state.apostrophePackageName = apostropheEntry.name;

    const anchorsEntry = [...state.packages.values()].find((pkg) => pkg.relativeDir === 'packages/anchors');
    if (!anchorsEntry) {
      throw new Error('anchors package not found');
    }
    state.anchorsPackageName = anchorsEntry.name;

    state.baseBranchName = runGit('rev-parse --abbrev-ref HEAD');
    state.baseBranchSha = runGit(`rev-parse ${state.baseBranchName}`);

    const branchList = runGit(`branch --list ${impactBranch}`);
    if (!branchList) {
      runGit(`checkout -b ${impactBranch}`);
    } else {
      runGit(`checkout ${impactBranch}`);
    }

    state.savedBranchHead = runGit('rev-parse HEAD');
  });

  beforeEach(function () {
    if (!state.savedBranchHead) {
      return;
    }
    runGit(`checkout ${impactBranch}`);
    runGit(`reset --hard ${state.savedBranchHead}`);
    runGit('clean -fd');
  });

  after(function () {
    if (state.savedBranchHead) {
      runGit(`checkout ${impactBranch}`);
      runGit(`reset --hard ${state.savedBranchHead}`);
      runGit('clean -fd');
    }
    if (state.baseBranchName) {
      runGit(`checkout ${state.baseBranchName}`);
    }
    if (runGit(`branch --list ${impactBranch}`)) {
      runGit(`branch -D ${impactBranch}`);
    }
  });

  it('includes apostrophe dependents when apostrophe changes', async function () {
    const markerPath = path.join(getPackageDir(state.apostrophePackageName), '.impact-test');
    await fs.writeFile(markerPath, `${Date.now()}\n`);
    gitAdd(markerPath);
    gitCommit('test: impact scenario 1');

    const actual = runDetector({ BASE_SHA: state.baseBranchSha });
    const expected = new Set(computeImpactedPackages([state.apostrophePackageName]));
    // console.log('Expected impacted packages:', [...expected].sort());
    expectPackages(actual, expected);
  });

  it('only reports anchors when anchors changes', async function () {
    const markerPath = path.join(getPackageDir(state.anchorsPackageName), '.impact-test');
    await fs.writeFile(markerPath, `${Date.now()}\n`);
    gitAdd(markerPath);
    gitCommit('test: impact scenario 2');

    const actual = runDetector({ BASE_SHA: state.baseBranchSha });
    const expected = new Set(computeImpactedPackages([state.anchorsPackageName]));
    // console.log('Expected impacted packages:', [...expected].sort());
    expectPackages(actual, expected);
  });

  it('forces all packages with tests when FORCE_ALL is true', function () {
    const actual = runDetector({ FORCE_ALL: 'true' });
    // console.log('Expected impacted packages:', [...state.packagesWithTests].sort());
    expectPackages(actual, new Set(state.packagesWithTests));
  });

  it('forces all packages with tests when commit message contains [force ci]', async function () {
    const markerPath = path.join(getPackageDir(state.anchorsPackageName), '.impact-test-force-ci');
    await fs.writeFile(markerPath, `${Date.now()}\n`);
    gitAdd(markerPath);
    gitCommit('test: add feature [force ci]');

    const actual = runDetector({ BASE_SHA: state.baseBranchSha });
    // console.log('Expected impacted packages:', [...state.packagesWithTests].sort());
    expectPackages(actual, new Set(state.packagesWithTests));
  });

  it('forces all packages with tests when commit message contains [FORCE CI] (case-insensitive)', async function () {
    const markerPath = path.join(getPackageDir(state.anchorsPackageName), '.impact-test-force-ci-upper');
    await fs.writeFile(markerPath, `${Date.now()}\n`);
    gitAdd(markerPath);
    gitCommit('test: add feature [FORCE CI]');

    const actual = runDetector({ BASE_SHA: state.baseBranchSha });
    // console.log('Expected impacted packages:', [...state.packagesWithTests].sort());
    expectPackages(actual, new Set(state.packagesWithTests));
  });
});

function runGit(command) {
  return execSync(`git ${command}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: gitEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function gitAdd(filePath) {
  const relative = path.relative(repoRoot, filePath);
  const gitPath = relative.split(path.sep).join(path.posix.sep);
  runGit(`add ${gitPath}`);
}

function gitCommit(message) {
  runGit(`commit -m "${message}"`);
}

function ensureCleanWorkingTree() {
  const status = runGit('status --porcelain');
  if (status) {
    throw new Error('Working tree must be clean before running impact tests.');
  }
}

function runDetector(env = {}) {
  const output = execFileSync(`node`, [detectorScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  return JSON.parse(output);
}

function expectPackages(result, expectedNames) {
  const actualNames = [...result.matrix.include.map((entry) => entry.package)].sort();
  const expected = [...expectedNames].sort();
  assert.deepStrictEqual(actualNames, expected, 'matrix packages mismatch');
  assert.strictEqual(result.hasPackages, expected.length > 0, 'hasPackages flag mismatch');
}

function getPackageDir(packageName) {
  const pkg = state.packages.get(packageName);
  if (!pkg) {
    throw new Error(`Unknown package ${packageName}`);
  }
  return path.join(repoRoot, pkg.relativeDir);
}

function computeImpactedPackages(seedPackages) {
  const dependentsMap = buildDependentsMap(state.packages);
  const queue = [...seedPackages];
  const impacted = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || impacted.has(current)) {
      continue;
    }
    impacted.add(current);
    const dependents = dependentsMap.get(current);
    if (dependents) {
      dependents.forEach((dependent) => queue.push(dependent));
    }
  }

  return [...impacted].filter((name) => state.packages.get(name)?.hasTestScript);
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

async function loadPackages() {
  const entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  const map = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = path.join(packagesRoot, entry.name, 'package.json');
    let manifest;
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      manifest = JSON.parse(raw);
    } catch (error) {
      continue;
    }

    if (!manifest.name) {
      continue;
    }

    const scripts = manifest.scripts || {};
    const hasTestScript = Boolean(scripts.test);
    const dependencies = new Set([
      ...Object.keys(manifest.dependencies || {}),
      ...Object.keys(manifest.devDependencies || {}),
      ...Object.keys(manifest.peerDependencies || {}),
      ...Object.keys(manifest.optionalDependencies || {})
    ]);

    map.set(manifest.name, {
      name: manifest.name,
      relativeDir: path.posix.join('packages', entry.name),
      hasTestScript,
      dependencies
    });
  }

  return map;
}
