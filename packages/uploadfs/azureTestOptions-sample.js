module.exports = {
  storage: 'azure',
  disabledFileKey: 'Any string is ok, probably longer is better',
  account: 'foo',
  container: 'bar',
  key: 'b@z'
  // If set, the key should be a shared access signature (SAS) token,
  // otherwise it should be an account key (Shared Credential).
  // sas: true
};
