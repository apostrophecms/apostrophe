const permissionSetsByRole = {
  admin: [
    {
      label: 'apostrophe:globalDocLabel',
      name: '@apostrophecms/global',
      singleton: true,
      page: false,
      piece: true,
      permissions: [
        {
          name: 'edit',
          label: 'apostrophe:modify',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:users',
      name: '@apostrophecms/user',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:images',
      name: '@apostrophecms/image',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:files',
      name: '@apostrophecms/file',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:imageTags',
      name: '@apostrophecms/image-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:fileTags',
      name: '@apostrophecms/file-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:pages',
      name: '@apostrophecms/any-page-type',
      page: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    }
  ],
  editor: [
    {
      label: 'apostrophe:globalDocLabel',
      name: '@apostrophecms/global',
      singleton: true,
      page: false,
      piece: true,
      permissions: [
        {
          name: 'edit',
          label: 'apostrophe:modify',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:users',
      name: '@apostrophecms/user',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:images',
      name: '@apostrophecms/image',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:files',
      name: '@apostrophecms/file',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:imageTags',
      name: '@apostrophecms/image-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:fileTags',
      name: '@apostrophecms/file-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    },
    {
      label: 'apostrophe:pages',
      name: '@apostrophecms/any-page-type',
      page: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: true
        }
      ]
    }
  ],
  contributor: [
    {
      label: 'apostrophe:globalDocLabel',
      name: '@apostrophecms/global',
      singleton: true,
      page: false,
      piece: true,
      permissions: [
        {
          name: 'edit',
          label: 'apostrophe:modify',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:users',
      name: '@apostrophecms/user',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:images',
      name: '@apostrophecms/image',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:files',
      name: '@apostrophecms/file',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:imageTags',
      name: '@apostrophecms/image-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:fileTags',
      name: '@apostrophecms/file-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:pages',
      name: '@apostrophecms/any-page-type',
      page: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: true
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: true
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    }
  ],
  guest: [
    {
      label: 'apostrophe:globalDocLabel',
      name: '@apostrophecms/global',
      singleton: true,
      page: false,
      piece: true,
      permissions: [
        {
          name: 'edit',
          label: 'apostrophe:modify',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:users',
      name: '@apostrophecms/user',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:images',
      name: '@apostrophecms/image',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:files',
      name: '@apostrophecms/file',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:imageTags',
      name: '@apostrophecms/image-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:fileTags',
      name: '@apostrophecms/file-tag',
      page: false,
      piece: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    },
    {
      label: 'apostrophe:pages',
      name: '@apostrophecms/any-page-type',
      page: true,
      permissions: [
        {
          name: 'create',
          label: 'apostrophe:create',
          value: false
        },
        {
          name: 'edit',
          label: 'apostrophe:modifyOrDelete',
          value: false
        },
        {
          name: 'publish',
          label: 'apostrophe:publish',
          value: false
        }
      ]
    }
  ]
};

module.exports = {
  permissionSetsByRole
};
