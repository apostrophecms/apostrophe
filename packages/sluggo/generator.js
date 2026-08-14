// This program outputs the Unicode character ranges
// we don't want in slugs:
//
// Control characters, Misc characters, Punctuation, Space and
// Unassigned characters.
//
// unicode-7.0.0 must be temporarily "npm install"ed. More than
// likely you'll be installing 8.0.0 (or whatever is the latest
// version of Unicode) and changing the next line whenever
// you do this.
//
// Pipe the output to a file and paste it into index.js. Done!
//
// -Tom

const categoriesByCode = require('unicode-7.0.0/categories');

let i;
let previousBad;
let start;
let end;

const ranges = [];

for (i = 0; (i < categoriesByCode.length); i++) {
  const category = categoriesByCode[i];
  const first = category.substr(0, 1);
  let bad = false;
  if ((first === 'C') || (first === 'M') || (first === 'P') || (first === 'S') || (first === 'Z')) {
    bad = true;
  }
  if (bad !== previousBad) {
    end = i - 1;
    if (end !== -1) {
      if (previousBad) {
        ranges.push([ start, end ]);
      }
    }
    start = i;
  }
  previousBad = bad;
}
if (previousBad) {
  ranges.push([ start, i ]);
}

// Program output: the ranges are what this script was run to print.
// eslint-disable-next-line no-console
console.log(JSON.stringify(ranges));
