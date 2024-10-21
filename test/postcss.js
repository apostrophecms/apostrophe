const postcss = require('postcss');
const { equal, deepEqual } = require('node:assert');

describe('postcss-replace-viewport-units-plugin', () => {
  const plugin = require('../modules/@apostrophecms/asset/lib/webpack/postcss-replace-viewport-units-plugin.js');

  it('should map `vh` values to `cqh` in a rule that applies only on breakpoint preview ', async () => {
    const input = '.hello { width: 100vh; }';
    const output = '.hello { width: 100vh; }\n:where(body[data-breakpoint-preview-mode]) .hello { width: 100cqh; }';

    await run(plugin, input, output, { });
  });

  it('should map `vw` values to `cqw` in a rule that applies only on breakpoint preview ', async () => {
    const input = '.hello { width: 100vw; }';
    const output = '.hello { width: 100vw; }\n:where(body[data-breakpoint-preview-mode]) .hello { width: 100cqw; }';

    await run(plugin, input, output, { });
  });

  it('should map `vh` and `vw` values used in `calc` to `cqh` and `cqw` in a rule that applies only on breakpoint preview', async () => {
    const input = `
.hello { height: calc(100vh - 50px); width: calc(100vw - 10px); }`;
    const output = `
.hello { height: calc(100vh - 50px); width: calc(100vw - 10px); }
:where(body[data-breakpoint-preview-mode]) .hello { height: calc(100cqh - 50px); width: calc(100cqw - 10px); }`;

    await run(plugin, input, output, { });
  });

  it('should add only declarations containing `vh` and `vw` values in a rule that applies only on breakpoint preview', async () => {
    const input = `
.hello {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: calc(100vh - 50px);
}`;

    const output = `
.hello {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: calc(100vh - 50px);
}
:where(body[data-breakpoint-preview-mode]) .hello {
  width: 100cqw;
  height: calc(100cqh - 50px);
}`;

    await run(plugin, input, output, { });
  });
});

// From https://github.com/postcss/postcss-plugin-boilerplate/blob/main/template/index.test.t.js
async function run(plugin, input, output, opts = {}) {
  const result = await postcss([ plugin(opts) ]).process(input, { from: undefined });

  equal(result.css, output);
  deepEqual(result.warnings(), []);
}
