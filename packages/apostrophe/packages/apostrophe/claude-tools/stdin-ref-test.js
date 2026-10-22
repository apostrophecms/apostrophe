// Check if process.stdin keeps the process alive
// If this script hangs, stdin is ref'd. If it exits, stdin is unref'd.

console.log(`stdin isTTY: ${process.stdin.isTTY}`);
console.log(`stdin readableFlowing: ${process.stdin.readableFlowing}`);
console.log(`stdin isPaused: ${process.stdin.isPaused()}`);

// Check ref status
if (typeof process.stdin.unref === 'function') {
  console.log('stdin has unref method');
}

console.log('Waiting to see if process exits on its own...');
// Don't do anything - just see if the process exits
