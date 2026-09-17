#!/usr/bin/env node
// Scans workspace i18n bundles for missing or broken translations. "Broken"
// means the key resolves but renders wrong: most often a translator treated an
// i18next interpolation variable as prose and translated it, so
// "{{ width }} x {{ height }}" came back as "{{ ancho }} x {{ alto }}" and the
// values never interpolate. See PRO-9600.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const packagesRoot = path.join(repoRoot, 'packages');

const IGNORED_DIRS = new Set([ 'node_modules', '.git', 'dist', 'public' ]);
// Base locale every other file in a bundle is compared against.
const BASE_LOCALE = 'en';
// i18next v20 pluralisation: `key_plural` for 2-form languages, `key_0`..`key_5`
// for languages with more. These are legitimate keys with no `en.json` twin.
const PLURAL_SUFFIX = /_(plural|zero|one|two|few|many|other|\d+)$/;
const LOCALE_FILE = /^([a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)\.json$/;

/**
 * @typedef {Object} Rule
 * @property {string} name - Stable identifier used by --only and --error-on.
 * @property {'error'|'warn'|'info'} severity - Default severity.
 * @property {string} description - One-line help text.
 */

/** @type {Rule[]} */
const RULES = [
  {
    name: 'placeholder-mismatch',
    severity: 'error',
    description: 'Interpolation variables differ from the base locale (a translated or case-corrupted {{ count }}).'
  },
  {
    name: 'malformed-interpolation',
    severity: 'error',
    description: 'Unbalanced braces, an empty {{ }}, or a variable name that i18next cannot resolve.'
  },
  {
    name: 'plural-shape',
    severity: 'warn',
    description: 'A key is pluralised in one locale but not the other.'
  },
  {
    name: 'orphan-key',
    severity: 'warn',
    description: 'Key exists in a translation but no longer exists in the base locale.'
  },
  {
    name: 'missing-key',
    severity: 'warn',
    description: 'Key exists in the base locale but is absent from this translation.'
  },
  {
    name: 'untranslated',
    severity: 'info',
    description: 'Value is byte-identical to the base locale.'
  },
  {
    name: 'no-base-locale',
    severity: 'warn',
    description: `Bundle has translations but no ${BASE_LOCALE}.json to check them against.`
  }
];

const RULES_BY_NAME = new Map(RULES.map(rule => [ rule.name, rule ]));
const SEVERITY_ORDER = {
  error: 0,
  warn: 1,
  info: 2
};

/**
 * @typedef {Object} Options
 * @property {Set<string>} rules - Rule names to run.
 * @property {string} errorOn - Lowest severity that fails the run.
 * @property {string[]} packages - Package directory names to limit to.
 * @property {string[]} locales - Locale codes to limit to.
 * @property {boolean} includeTests - Include `test/` fixture bundles.
 * @property {boolean} json - Emit machine-readable output.
 */

/**
 * @param {string[]} argv
 * @returns {Options}
 */
function parseArgs(argv) {
  const options = {
    rules: new Set(RULES.map(rule => rule.name)),
    errorOn: 'error',
    packages: [],
    locales: [],
    includeTests: false,
    json: false
  };
  const list = value => (value ?? '').split(',').map(entry => entry.trim()).filter(Boolean);
  for (const arg of argv) {
    const [ flag, value ] = arg.startsWith('--') ? arg.slice(2).split('=') : [ arg, undefined ];
    switch (flag) {
      case 'help':
      case 'h':
        usage();
        process.exit(0);
        break;
      case 'only': {
        const names = list(value);
        for (const name of names) {
          if (!RULES_BY_NAME.has(name)) {
            fail(`Unknown rule "${name}". Known rules: ${RULES.map(rule => rule.name).join(', ')}`);
          }
        }
        options.rules = new Set(names);
        break;
      }
      case 'error-on':
        if (!(value in SEVERITY_ORDER) && value !== 'never') {
          fail(`--error-on expects error, warn, info or never; got "${value}"`);
        }
        options.errorOn = value;
        break;
      case 'package':
      case 'packages':
        options.packages = list(value);
        break;
      case 'locale':
      case 'locales':
        options.locales = list(value);
        break;
      case 'include-tests':
        options.includeTests = true;
        break;
      case 'json':
        options.json = true;
        break;
      default:
        fail(`Unknown argument "${arg}". Try --help.`);
    }
  }
  return options;
}

function usage() {
  console.log(`Usage: node scripts/scan-translations.mjs [options]

Compares every workspace i18n bundle against its ${BASE_LOCALE}.json and reports
missing or broken translations.

Options:
  --only=RULE[,RULE]   Run only these rules (default: all).
  --error-on=LEVEL     Exit non-zero at this severity or worse: error (default),
                       warn, info, or never.
  --package=NAME[,..]  Limit to these package directories, e.g. seo,import-export.
  --locale=CODE[,..]   Limit to these locales, e.g. fr,es.
  --include-tests      Also scan bundles under a package's test/ directory.
  --json               Emit findings as JSON.
  --help               Show this message.

Rules:
${RULES.map(rule => `  ${rule.name.padEnd(24)}[${rule.severity}] ${rule.description}`).join('\n')}`);
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`scan-translations: ${message}`);
  process.exit(2);
}

/**
 * Recursively collects directories named `i18n`.
 *
 * @param {string} dir
 * @param {boolean} includeTests
 * @param {string[]} [found]
 * @returns {Promise<string[]>}
 */
async function findI18nDirs(dir, includeTests, found = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    if (!includeTests && entry.name === 'test') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.name === 'i18n') {
      found.push(full);
    }
    await findI18nDirs(full, includeTests, found);
  }
  return found;
}

/**
 * @typedef {Object} Bundle
 * @property {string} dir - Directory holding the locale files.
 * @property {string} label - Repo-relative bundle name used in output.
 * @property {Map<string, string>} files - Locale code to absolute file path.
 */

/**
 * Groups locale files into bundles. A bundle is either `i18n/<locale>.json` or
 * a namespaced `i18n/<namespace>/<locale>.json`.
 *
 * @param {string[]} i18nDirs
 * @returns {Promise<Bundle[]>}
 */
async function collectBundles(i18nDirs) {
  const bundles = [];
  const seen = new Set();
  const visit = async dir => {
    if (seen.has(dir)) {
      return;
    }
    seen.add(dir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    /** @type {Map<string, string>} */
    const files = new Map();
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await visit(path.join(dir, entry.name));
        }
        continue;
      }
      const match = entry.name.match(LOCALE_FILE);
      if (match) {
        files.set(match[1], path.join(dir, entry.name));
      }
    }
    if (files.size) {
      bundles.push({
        dir,
        label: path.relative(repoRoot, dir),
        files
      });
    }
  };
  for (const dir of i18nDirs) {
    await visit(dir);
  }
  return bundles;
}

/**
 * Flattens i18next nested keys into dotted paths so both styles compare cleanly.
 *
 * @param {Record<string, any>} value
 * @param {string} [prefix]
 * @param {Map<string, string>} [out]
 * @returns {Map<string, string>}
 */
function flatten(value, prefix = '', out = new Map()) {
  for (const [ key, entry ] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      flatten(entry, full, out);
    } else if (typeof entry === 'string') {
      out.set(full, entry);
    }
  }
  return out;
}

/**
 * Extracts interpolation variable names, preserving duplicates so a doubled
 * placeholder is not mistaken for a match.
 *
 * @param {string} value
 * @returns {string[]}
 */
function placeholders(value) {
  return [ ...value.matchAll(/\{\{([^}]*)\}\}/g) ]
    // `{{- raw }}` skips escaping; `{{ n, number }}` names a formatter. Neither
    // is part of the variable's identity.
    .map(match => match[1].trim().replace(/^-\s*/, '').split(',')[0].trim());
}

/**
 * @param {string} value
 * @returns {string[]} Human-readable descriptions of malformed interpolations.
 */
function malformations(value) {
  const problems = [];
  const opens = (value.match(/\{\{/g) || []).length;
  const closes = (value.match(/\}\}/g) || []).length;
  if (opens !== closes) {
    problems.push(`unbalanced braces (${opens} open vs ${closes} close)`);
  }
  for (const name of placeholders(value)) {
    if (!name) {
      problems.push('empty placeholder');
    } else if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(name)) {
      problems.push(`unresolvable variable name "${name}"`);
    }
  }
  return problems;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locates the line a key is declared on so findings are clickable.
 *
 * @param {string} source
 * @param {string} key
 * @returns {number}
 */
function lineOf(source, key) {
  const needle = `"${key.split('.').pop()}"`;
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].includes(needle)) {
      return index + 1;
    }
  }
  return 1;
}

/**
 * @param {string[]} names
 * @returns {string}
 */
function formatPlaceholders(names) {
  if (!names.length) {
    return 'none';
  }
  return names.map(name => `{{ ${name} }}`).join(', ');
}

/**
 * @typedef {Object} Finding
 * @property {string} rule
 * @property {'error'|'warn'|'info'} severity
 * @property {string} file - Repo-relative path.
 * @property {number} line
 * @property {string} locale
 * @property {string} key
 * @property {string} message
 */

/**
 * @param {Bundle} bundle
 * @param {Options} options
 * @returns {Promise<Finding[]>}
 */
async function scanBundle(bundle, options) {
  /** @type {Finding[]} */
  const findings = [];
  const basePath = bundle.files.get(BASE_LOCALE);
  if (!basePath) {
    // Every other rule is defined relative to the base locale, so without one
    // the bundle cannot be checked at all. Say so rather than skipping quietly:
    // `en` is the terminal fallback i18next resolves to, so a bundle missing it
    // has no last resort.
    if (options.rules.has('no-base-locale')) {
      findings.push({
        rule: 'no-base-locale',
        severity: RULES_BY_NAME.get('no-base-locale').severity,
        file: path.relative(repoRoot, bundle.files.values().next().value),
        line: 1,
        locale: [ ...bundle.files.keys() ].sort().join(','),
        key: '',
        message: `bundle ${bundle.label} has ${bundle.files.size} locale file(s) but no ${BASE_LOCALE}.json; nothing to compare against`
      });
    }
    return findings;
  }
  const read = async file => {
    const source = await fs.readFile(file, 'utf8');
    try {
      return {
        source,
        data: flatten(JSON.parse(source))
      };
    } catch (error) {
      return fail(`${path.relative(repoRoot, file)} is not valid JSON: ${error.message}`);
    }
  };
  const base = await read(basePath);
  // Placeholder mismatches per key, to spot a whole batch going wrong together.
  /** @type {Map<string, { finding: Finding, signature: string }[]>} */
  const mismatches = new Map();

  for (const [ locale, file ] of bundle.files) {
    if (locale === BASE_LOCALE) {
      continue;
    }
    if (options.locales.length && !options.locales.includes(locale)) {
      continue;
    }
    const relative = path.relative(repoRoot, file);
    const target = await read(file);
    const add = (rule, key, message) => {
      if (!options.rules.has(rule)) {
        return;
      }
      findings.push({
        rule,
        severity: RULES_BY_NAME.get(rule).severity,
        file: relative,
        line: lineOf(target.source, key),
        locale,
        key,
        message
      });
    };

    for (const [ key, value ] of target.data) {
      const problems = malformations(value);
      if (problems.length) {
        add('malformed-interpolation', key, `${problems.join('; ')} in ${JSON.stringify(value)}`);
      }
      if (base.data.has(key)) {
        continue;
      }
      const singular = key.replace(PLURAL_SUFFIX, '');
      if (!PLURAL_SUFFIX.test(key)) {
        add('orphan-key', key, `not present in ${BASE_LOCALE}.json`);
        continue;
      }
      // A plural variant is valid as long as its singular exists upstream.
      if (!base.data.has(singular)) {
        add('plural-shape', key, `pluralised key has no "${singular}" in ${BASE_LOCALE}.json`);
      }
    }

    for (const [ key, baseValue ] of base.data) {
      if (!target.data.has(key)) {
        const stem = key.replace(PLURAL_SUFFIX, '');
        // A language with more than two plural forms spells the whole family as
        // `key_0`/`key_1`/`key_2`, with no bare `key` and no `key_plural`, so
        // any numbered variant covers both of those base spellings.
        const numbered = [ ...target.data.keys() ].some(
          candidate => new RegExp(`^${escapeRegExp(stem)}_\\d+$`).test(candidate)
        );
        if (numbered) {
          continue;
        }
        if (!PLURAL_SUFFIX.test(key)) {
          add('missing-key', key, `missing from ${locale}.json`);
          continue;
        }
        // Only an inconsistent plural shape when the singular did land; if the
        // whole family is absent it is a plain missing key.
        if (target.data.has(stem)) {
          add('plural-shape', key, `"${stem}" is translated but its plural form is not`);
        } else {
          add('missing-key', key, `missing from ${locale}.json`);
        }
        continue;
      }
      const value = target.data.get(key);
      const expected = placeholders(baseValue).sort();
      const actual = placeholders(value).sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        add(
          'placeholder-mismatch',
          key,
          `expected ${formatPlaceholders(expected)} but found ${formatPlaceholders(actual)} in ${JSON.stringify(value)}`
        );
        const finding = findings[findings.length - 1];
        // `add` is a no-op when the rule is filtered out, so only record a
        // finding that was actually kept.
        if (finding && finding.rule === 'placeholder-mismatch' && finding.key === key) {
          if (!mismatches.has(key)) {
            mismatches.set(key, []);
          }
          mismatches.get(key).push({
            finding,
            signature: JSON.stringify(actual)
          });
        }
      }
      // Multi-word strings shared verbatim with English are almost always an
      // untranslated passthrough rather than a genuine loan phrase.
      const prose = baseValue.replace(/\{\{[^}]*\}\}/g, '');
      if (value === baseValue && /\s/.test(baseValue) && /\p{L}/u.test(prose)) {
        add('untranslated', key, `identical to ${BASE_LOCALE}.json: ${JSON.stringify(value)}`);
      }
    }
  }

  // Translations arrive in batches from a single source, so they are not
  // independent: when every locale spells a variable the same wrong way it
  // usually means one bad batch rather than one slip per translator. That
  // changes how many files need editing, but not which side is authoritative —
  // `en` is still the source of truth, so confirm against the $t() call site.
  for (const entries of mismatches.values()) {
    if (entries.length < 2) {
      continue;
    }
    const agreed = entries.every(entry => entry.signature === entries[0].signature);
    if (!agreed) {
      continue;
    }
    for (const entry of entries) {
      entry.finding.message += ` (all ${entries.length} translations agree on this spelling; likely one bad batch, so check the call site before editing ${entries.length} files)`;
    }
  }
  return findings;
}

/**
 * @param {Finding[]} findings
 * @param {Bundle[]} bundles
 * @param {Record<string, number>} counts
 */
function report(findings, bundles, counts) {
  const icons = {
    error: 'error',
    warn: ' warn',
    info: ' info'
  };
  let currentFile = null;
  for (const finding of findings) {
    if (finding.file !== currentFile) {
      currentFile = finding.file;
      console.log('');
    }
    console.log(`${icons[finding.severity]}  ${finding.file}:${finding.line}  ${finding.rule}  ${finding.key}`.trimEnd());
    console.log(`       ${finding.message}`);
  }
  const locales = new Set(bundles.flatMap(bundle => [ ...bundle.files.keys() ]));
  console.log(`\nScanned ${bundles.length} bundle(s) across ${locales.size} locale(s).`);
  console.log(`${counts.error} error, ${counts.warn} warn, ${counts.info} info.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let roots = [ packagesRoot ];
  if (options.packages.length) {
    roots = options.packages.map(name => path.join(packagesRoot, name));
    for (const root of roots) {
      try {
        await fs.access(root);
      } catch {
        fail(`No such package directory: ${path.relative(repoRoot, root)}`);
      }
    }
  }

  const dirs = [];
  for (const root of roots) {
    dirs.push(...await findI18nDirs(root, options.includeTests));
  }
  const bundles = await collectBundles(dirs);
  bundles.sort((a, b) => a.label.localeCompare(b.label));

  /** @type {Finding[]} */
  const findings = [];
  for (const bundle of bundles) {
    findings.push(...await scanBundle(bundle, options));
  }
  findings.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    a.file.localeCompare(b.file) ||
    a.line - b.line);

  const counts = {
    error: 0,
    warn: 0,
    info: 0
  };
  for (const finding of findings) {
    counts[finding.severity]++;
  }

  if (options.json) {
    console.log(JSON.stringify({
      bundles: bundles.length,
      counts,
      findings
    }, null, 2));
  } else {
    report(findings, bundles, counts);
  }

  if (options.errorOn === 'never') {
    return 0;
  }
  const threshold = SEVERITY_ORDER[options.errorOn];
  return findings.some(finding => SEVERITY_ORDER[finding.severity] <= threshold) ? 1 : 0;
}

// Set `exitCode` rather than calling `process.exit()`: a full scan writes more
// than a pipe buffer holds, and exiting outright truncates it.
main()
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 2;
  });
