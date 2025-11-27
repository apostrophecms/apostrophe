/* eslint-disable n/handle-callback-err */

// NOTE: tried https://stylelint.io/developer-guide/plugins/#testing but it would not work with our CommonJS usage.

const { exec } = require('node:child_process');
const assert = require('node:assert');

const ERROR_MESSAGE =
  'Cannot mix declarations and nested rules. Group them together or wrap declarations in a nested "& { }" block. See https://sass-lang.com/documentation/breaking-changes/mixed-decls/';

describe('@apostrophecms/stylelint-no-mixed-decls stylelint rule', function() {
  this.timeout(10000);

  it('should fail when css contains nested rules and declarations mixed together', async function() {
    const { stdout, stderr } = await runStylelint('test/bad.scss');

    if (stdout) {
      throw new Error(`Unexpected output: ${stdout}`);
    }

    const expectedErrorPositions = [
      [ 7, 3 ],
      [ 8, 3 ],
      [ 29, 3 ],
      [ 30, 3 ],
      [ 34, 3 ],
      [ 35, 3 ],
      [ 45, 3 ],
      [ 46, 3 ],
      [ 56, 3 ],
      [ 57, 3 ],
      [ 64, 3 ],
      [ 70, 3 ],
      [ 78, 3 ]
    ];
    const expectedErrorOccurrences = expectedErrorPositions.length;
    const actualErrorOccurrences = countOccurences(ERROR_MESSAGE, stderr);

    const errorPositionsMessages = expectedErrorPositions
      .map(position =>
        !stderr.includes(position.join(':')) &&
        `Expected error message to include line ${position.join(':')} but it did not`
      )
      .filter(Boolean);

    assert.strictEqual(
      actualErrorOccurrences,
      expectedErrorOccurrences,
      `Expected ${expectedErrorOccurrences} occurrences of "${ERROR_MESSAGE}" but found ${actualErrorOccurrences}.

${errorPositionsMessages.join('\n')}`
    );
  });

  it('should pass when css contains nested rules and scoped declarations', async function() {
    const { stdout, stderr } = await runStylelint('test/good.scss');

    if (stdout) {
      throw new Error(`Unexpected output: ${stdout}`);
    }

    if (stderr.includes(ERROR_MESSAGE)) {
      throw new Error(`Unexpected error message: ${ERROR_MESSAGE}`);
    }
  });
});

function runStylelint(filePath) {
  return new Promise((resolve, reject) => {
    exec(`npx stylelint ${filePath}`, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr
      });
    });
  });
}

function countOccurences(substring, string) {
  const regex = new RegExp(substring, 'g');
  const matches = string.match(regex);
  return matches ? matches.length : 0;
}
