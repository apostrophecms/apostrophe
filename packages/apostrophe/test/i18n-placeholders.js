const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const i18next = require('i18next');

// Translators sometimes retype an interpolation variable ({{ skipcount }},
// {{ Count }}, {{ ancho }}). i18next then has nothing to substitute and the
// value silently renders as an empty string, so check every bundled locale
// against en.json.

const dir = path.join(__dirname, '../modules/@apostrophecms/i18n/i18n');
const load = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const en = load('en.json');
const locales = fs.readdirSync(dir)
  .filter(file => file.endsWith('.json') && file !== 'en.json')
  .map(file => file.replace(/\.json$/, ''));

function variables(phrase) {
  return [ ...String(phrase).matchAll(/\{\{\s*([^}]*?)\s*\}\}/g) ]
    .map(match => match[1]);
}

describe('i18n placeholders', function() {
  it('should only use interpolation variables declared in en.json', function() {
    const problems = [];
    for (const locale of locales) {
      const phrases = load(`${locale}.json`);
      for (const [ key, phrase ] of Object.entries(phrases)) {
        const base = en[key] ?? en[key.replace(/_plural$/, '')];
        if (base === undefined) {
          continue;
        }
        const allowed = new Set(variables(base));
        for (const name of variables(phrase)) {
          if (!allowed.has(name)) {
            problems.push(`${locale}.json ${key}: {{ ${name} }}`);
          }
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  it('should render batch localization counts in every locale', async function() {
    for (const locale of [ 'en', ...locales ]) {
      const instance = i18next.createInstance();
      await instance.init({
        lng: locale,
        resources: { [locale]: { translation: load(`${locale}.json`) } },
        interpolation: { escapeValue: false }
      });
      for (const count of [ 1, 3 ]) {
        const warning = instance.t('localizingNotificationWarning', {
          count,
          skipCount: 7
        });
        assert.match(warning, new RegExp(String(count)), `${locale}: ${warning}`);
        assert.match(warning, /7/, `${locale}: ${warning}`);
        const danger = instance.t('localizingNotificationDanger', { count });
        assert.match(danger, new RegExp(String(count)), `${locale}: ${danger}`);
      }
    }
  });
});
