module.exports = {
  storage: 'azure',
  disabledFileKey: 'Any string is ok, probably longer is better',
  replicateClusters: [
    {
      account: 'yourAccount',
      container: 'container1',
      key: 'top_secret_XYZ123'
    },
    {
      account: 'yourAccount',
      container: 'container2',
      key: 'top_secret_XYZ123'
    },
    {
      account: 'yourAccount2',
      container: 'account2_container1',
      sas: true,
      key: 'your_sas_token'
    }
  ]
};
