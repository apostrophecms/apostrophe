/**
 * Canonical GitHub clone URLs per kit
 */
const REPOS = Object.freeze({
  // Standalone (full-stack Apostrophe).
  essentials: 'https://github.com/apostrophecms/starter-kit-essentials.git',
  demo: 'https://github.com/apostrophecms/public-demo.git',
  // Astro frontend + Apostrophe backend.
  astroEssentials: 'https://github.com/apostrophecms/starter-kit-astro-essentials.git',
  astroDemo: 'https://github.com/apostrophecms/astro-public-demo.git'
});

/**
 * kitId → { repo, label, frontend, seedData }.
 *
 * `frontend` is the external-frontend technology (`'astro'`), or `null` for a
 * standalone full-stack Apostrophe project.
 *
 * `label` is the human-facing name (UI/plan-preview). `seedData` marks the
 * demo-data variants that get a DB dump + sample images applied after clone.
 * @type {Readonly<Record<string, {
 *   repo: string, label: string, frontend: ('astro'|null), seedData: boolean
 * }>>}
 */
export const KITS = Object.freeze({
  'apostrophe-astro-essentials': {
    repo: REPOS.astroEssentials,
    label: 'Apostrophe + Astro — Essentials',
    frontend: 'astro',
    seedData: false
  },
  'apostrophe-astro-demo': {
    repo: REPOS.astroDemo,
    label: 'Apostrophe + Astro — Demo',
    frontend: 'astro',
    seedData: false
  },
  'apostrophe-astro-demo-data': {
    repo: REPOS.astroDemo,
    label: 'Apostrophe + Astro — Demo (with sample content)',
    frontend: 'astro',
    seedData: true
  },
  'apostrophe-essentials': {
    repo: REPOS.essentials,
    label: 'Apostrophe Standalone — Essentials',
    frontend: null,
    seedData: false
  },
  'apostrophe-demo': {
    repo: REPOS.demo,
    label: 'Apostrophe Standalone — Demo',
    frontend: null,
    seedData: false
  },
  'apostrophe-demo-data': {
    repo: REPOS.demo,
    label: 'Apostrophe Standalone — Demo (with sample content)',
    frontend: null,
    seedData: true
  }
});

/** All valid KitIds, frozen. */
export const KIT_IDS = Object.freeze(Object.keys(KITS));

/** @returns {boolean} whether `kitId` is a known KitId. */
export function isKnownKit(kitId) {
  return Object.hasOwn(KITS, kitId);
}

/**
 * Resolve a KitId to its registry entry.
 * @param {string} kitId
 * @returns {{ repo: string, label: string, frontend: ('astro'|null), seedData: boolean }}
 * @throws {TypeError} for an unknown KitId (programmer/validation error — the
 *   caller validates options before createProject; not an install failure).
 */
export function getKit(kitId) {
  if (!isKnownKit(kitId)) {
    throw new TypeError(
      `Unknown kitId: ${kitId}. Known: ${KIT_IDS.join(', ')}`
    );
  }
  return KITS[kitId];
}

/**
 * Derive a KitId from the flow's three answers:
 *
 *   build         : 'astro' | 'standalone'
 *   startingPoint : 'essentials' | 'demo'
 *   sampleContent : boolean (only meaningful when startingPoint === 'demo';
 *                   ignored for 'essentials')
 *
 *   essentials                     → `<prefix>-essentials`
 *   demo, sampleContent === false  → `<prefix>-demo`
 *   demo, sampleContent === true   → `<prefix>-demo-data`
 *
 * where `<prefix>` is `apostrophe-astro` (astro) or `apostrophe` (standalone).
 *
 * @param {{ build: string, startingPoint: string, sampleContent?: boolean }} a
 * @returns {string} a KitId guaranteed to be in {@link KITS}.
 * @throws {TypeError} on an unrecognized build/startingPoint.
 */
export function deriveKitId({
  build, startingPoint, sampleContent = false
}) {
  let prefix;
  if (build === 'astro') {
    prefix = 'apostrophe-astro';
  } else if (build === 'standalone') {
    prefix = 'apostrophe';
  } else {
    throw new TypeError(`Unknown build: ${build}. Expected 'astro' | 'standalone'.`);
  }

  let suffix;
  if (startingPoint === 'essentials') {
    suffix = 'essentials';
  } else if (startingPoint === 'demo') {
    suffix = sampleContent ? 'demo-data' : 'demo';
  } else {
    throw new TypeError(
      `Unknown startingPoint: ${startingPoint}. Expected 'essentials' | 'demo'.`
    );
  }

  return `${prefix}-${suffix}`;
}
