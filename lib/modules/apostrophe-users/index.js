module.exports = {

  alias: 'users',
  extend: 'apostrophe-pieces',
  name: 'apostrophe-users',
  label: 'User',
  pluralLabel: 'Users',
  addFields: [
    {
      type: 'string',
      name: 'firstName',
      label: 'First Name'
    },
    {
      type: 'string',
      name: 'lastName',
      label: 'Last Name'
    },
    {
      type: 'string',
      name: 'title',
      label: 'Title'
    },
    {
      type: 'boolean',
      name: 'disabled',
      label: 'Disabled',
      def: 'false'
    },
    {
      type: 'string',
      name: 'username',
      label: 'Username'
    },
    {
      type: 'string',
      name: 'email',
      label: 'Email'
    },
    {
      type: 'password',
      name: 'password',
      label: 'Password'
    },
    {
      type: 'select',
      name: 'permissions',
      label: 'Permissions',
      def: 'guest',
      choices: [
        {
          value: 'admin',
          label: 'Admin'
        },
        {
          value: 'editor',
          label: 'Editor'
        },
        {
          value: 'guest',
          label: 'Guest'
        }
      ]
    }
  ]
}
