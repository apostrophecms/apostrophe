// Test whether a MongoDB connection keeps the process alive after close()
const mongoConnect = require('../../../packages/db-connect/lib/mongodb-connect');

(async () => {
  const uri = 'mongodb://localhost:27017/test_handle_leak';
  console.log('Connecting...');
  const client = await mongoConnect(uri);
  console.log('Connected. Closing...');
  await client.close();
  console.log('Closed. Process should exit now if no leaked handles.');
})();
