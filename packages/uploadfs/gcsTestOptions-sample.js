module.exports = {
  // You need Application Default Credentials set
  // See https://docs.cloud.google.com/docs/authentication/application-default-credentials
  backend: 'gcs',
  bucket: 'yourownbucketnamefromgcs',
  region: 'us-west-2',
  https: true,
  validation: false // Can be one of false, "md5" or  "crc32", YMMV
};
