// Project-level file for a module that is ALSO configured (with fields)
// via the apostrophe() config object, to reproduce PRO-9564.
module.exports = {
  fields: {
    add: {
      projectField: {
        type: 'string',
        label: 'Project Field'
      }
    },
    group: {
      projectGroup: {
        label: 'Project Group',
        fields: [ 'projectField' ]
      }
    }
  }
};
