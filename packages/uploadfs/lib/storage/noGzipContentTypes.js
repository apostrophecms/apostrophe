// Content types NOT suitable for gzip because
// they are already compressed and it's not worth
// the impact on phones etc. and/or it confuses
// browsers & does not get the expected transfer
// encoding header

module.exports = [
  'image/gif', 'image/jpeg', 'image/png', 'audio/mpeg', 'video/mpeg', 'video/mp4', 'video/webm', 'video/quicktime', 'application/zip', 'application/gzip', 'application/x-gtar'
];
