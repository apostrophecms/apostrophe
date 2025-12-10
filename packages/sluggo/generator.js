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

var categoriesByCode = require('unicode-7.0.0/categories');

var i;
var previousBad;
var start;
var end;

var ranges = [];

for (var i = 0; (i < categoriesByCode.length); i++) {
  var category = categoriesByCode[i];
  var first = category.substr(0, 1);
  var bad = false;
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

console.log(JSON.stringify(ranges));

