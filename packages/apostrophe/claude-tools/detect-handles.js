// Require this before running mocha to detect what activates process.stdin
// Usage: npx mocha -t 10000 --require ./claude-tools/detect-handles.js test/assets.js

console.log(`stdin paused at startup: ${process.stdin.isPaused()}`);
console.log(`stdin readableFlowing at startup: ${process.stdin.readableFlowing}`);

// Monkey-patch stdin.resume to capture the call stack
const origResume = process.stdin.resume.bind(process.stdin);
process.stdin.resume = function(...args) {
  console.log('\n=== process.stdin.resume() called ===');
  console.log(new Error().stack);
  return origResume(...args);
};

// Monkey-patch stdin.on to detect 'data' listener additions
const origOn = process.stdin.on.bind(process.stdin);
process.stdin.on = function(event, ...args) {
  if (event === 'data' || event === 'readable') {
    console.log(`\n=== process.stdin.on('${event}') called ===`);
    console.log(new Error().stack);
  }
  return origOn(event, ...args);
};

// Periodically check stdin state changes
let lastState = process.stdin.readableFlowing;
const checker = setInterval(() => {
  if (process.stdin.readableFlowing !== lastState) {
    console.log(`\n=== stdin readableFlowing changed: ${lastState} -> ${process.stdin.readableFlowing} ===`);
    console.log(new Error().stack);
    lastState = process.stdin.readableFlowing;
  }
}, 100);
checker.unref();

const origRun = require('mocha/lib/runner').prototype.run;
require('mocha/lib/runner').prototype.run = function(fn) {
  return origRun.call(this, function(failures) {
    console.log(`\nstdin paused at end: ${process.stdin.isPaused()}`);
    console.log(`stdin readableFlowing at end: ${process.stdin.readableFlowing}`);
    setTimeout(() => {
      process.exit(failures ? 3 : 0);
    }, 2000);
    if (fn) fn(failures);
  });
};
