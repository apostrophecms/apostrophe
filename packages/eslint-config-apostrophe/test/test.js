import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint as ESLint10 } from 'eslint';
import { ESLint as ESLint9 } from 'eslint-9';

const configFile = fileURLToPath(new URL('../index.js', import.meta.url));
const cwd = fileURLToPath(new URL('..', import.meta.url));

// Strip the indentation shared by every line, so samples can be written
// indented to match the test while being linted as top level code.
function dedent(code) {
  const lines = code.replace(/^\n/, '').split('\n');
  const indent = Math.min(
    ...lines.filter(line => line.trim()).map(line => line.match(/^ */)[0].length)
  );
  return lines.map(line => line.slice(indent)).join('\n');
}

for (const [ version, ESLint ] of [ [ 9, ESLint9 ], [ 10, ESLint10 ] ]) {
  describe(`eslint-config-apostrophe with ESLint ${version}`, function() {
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: configFile
    });

    async function lint(code, filePath) {
      const [ result ] = await eslint.lintText(dedent(code), { filePath });
      return result.messages;
    }

    function rules(messages) {
      return messages.map(message => message.ruleId);
    }

    describe('JSX templates', function() {
      it('accepts double quoted attributes', async function() {
        const messages = await lint(`
          export default function Page({ title }) {
            return <h1 className="title">{title}</h1>;
          }
        `, 'views/page.jsx');
        assert.deepEqual(messages, []);
      });

      it('rejects single quoted attributes', async function() {
        const messages = await lint(`
          export default function Page({ title }) {
            return <h1 className='title'>{title}</h1>;
          }
        `, 'views/page.jsx');
        assert.deepEqual(rules(messages), [ '@stylistic/jsx-quotes' ]);
      });

      it('does not require a key prop on mapped elements', async function() {
        const messages = await lint(`
          export default function List({ items }) {
            return (
              <ul>
                {items.map(item => <li>{item.title}</li>)}
              </ul>
            );
          }
        `, 'views/list.jsx');
        assert.deepEqual(messages, []);
      });

      it('treats components referenced in JSX as used', async function() {
        const messages = await lint(`
          import Layout from './layout.jsx';

          export default function Page({ items }) {
            return (
              <Layout.Main>
                {items.map(item => <Item item={item} />)}
              </Layout.Main>
            );
          }

          function Item({ item }) {
            return <li>{item.title}</li>;
          }
        `, 'views/page.jsx');
        assert.deepEqual(messages, []);
      });

      it('still reports a component that is never used', async function() {
        const messages = await lint(`
          export default function Page() {
            return <div />;
          }

          function Unused() {
            return <span />;
          }
        `, 'views/page.jsx');
        assert.deepEqual(rules(messages), [ 'no-unused-vars' ]);
        assert.match(messages[0].message, /'Unused'/);
      });

      it('accepts a ternary with parenthesized branches', async function() {
        const messages = await lint(`
          export default function Hint({ editing }) {
            return (
              <div>
                {editing ? (
                  <p>Editing</p>
                ) : (
                  <p>Viewing</p>
                )}
              </div>
            );
          }
        `, 'views/hint.jsx');
        assert.deepEqual(messages, []);
      });

      it('rejects a closing brace on its own line', async function() {
        const messages = await lint(`
          export default function Hint({ editing }) {
            return (
              <div>
                {editing
                  ? (
                    <p>Editing</p>
                  )
                  : (
                    <p>Viewing</p>
                  )
                }
              </div>
            );
          }
        `, 'views/hint.jsx');
        assert.deepEqual(rules(messages), [ '@stylistic/jsx-curly-newline' ]);
      });
    });

    describe('JavaScript', function() {
      it('applies the import-x rules', async function() {
        const messages = await lint(`
          import { a } from './lib.js';
          import { b } from './lib.js';

          export default a + b;
        `, 'lib/index.js');
        assert.deepEqual(rules(messages), [
          'import-x/no-duplicates',
          'import-x/no-duplicates'
        ]);
      });

      it('does not indent continued assignments', async function() {
        const messages = await lint(`
          const config = {};

          config.a =
          config.b = {
            value: true
          };

          export default config;
        `, 'lib/config.js');
        assert.deepEqual(messages, []);
      });
    });

    describe('Vue components', function() {
      it('lints a single file component', async function() {
        const messages = await lint(`
          <template>
            <p>{{ message }}</p>
          </template>

          <script>
          export default {
            data() {
              return {
                message: 'Hello'
              };
            }
          };
          </script>
        `, 'ui/apos/components/HelloMessage.vue');
        assert.deepEqual(messages, []);
      });

      it('applies the shared rules inside the script block', async function() {
        const messages = await lint(`
          <script>
          export default {
            data() {
              return {
                message: "Hello"
              };
            }
          };
          </script>
        `, 'ui/apos/components/HelloMessage.vue');
        assert.deepEqual(rules(messages), [ '@stylistic/quotes' ]);
      });
    });
  });
}
