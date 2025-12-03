module.exports = {
  // See https://cloud.google.com/docs/authentication/getting-started
  // basically you want a service account file on the filesystem with
  // the ENV variable GOOGLE_APPLICATION_CREDENTIALS pointing to it
  // If you are getting `Error: Invalid Grant`, this is likely your problem
  backend: 'gcs',
  bucket: 'yourownbucketnamefromgcs',
  region: 'us-west-2',
  validation: false // Can be one of false, "md5" or  "crc32", YMMV
};
