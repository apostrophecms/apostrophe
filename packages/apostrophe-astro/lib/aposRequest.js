export default function(req) {
  const request = new Request(req);
  const key = process.env.APOS_EXTERNAL_FRONT_KEY;
  if (!key) {
    throw new Error('APOS_EXTERNAL_FRONT_KEY environment variable must be set,\nhere and in the Apostrophe app');
  }
  request.headers.set('x-requested-with', 'AposExternalFront');
  request.headers.set('apos-external-front-key', key);
  // Prevent certain values of Connection, such as Upgrade, from causing an undici error in Node.js fetch
  request.headers.delete('Connection');
  return request;
}
