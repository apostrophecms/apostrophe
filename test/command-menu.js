const t = require('../test-lib/test.js');
const assert = require('assert').strict;

const moduleA = {
  commands: {
    add: {
      '@apostrophecms/command-menu:toggle-shortcuts': {
        type: 'item',
        label: 'commandMenuShortcutToggleShortcuts',
        action: {
          type: 'toggle-shortcuts',
          payload: {}
        },
        shortcut: 'Shift+K ?'
      }
    },
    group: {
      '@apostrophecms/command-menu:content': {
        label: 'commandMenuContent',
        fields: [
          'undo',
          'redo',
          '@apostrophecms/command-menu:toggle-shortcuts'
        ]
      }
    }
  }
};
const moduleB = {
  commands: {
    add: {
      '@apostrophecms/command-menu:test': {
        type: 'item',
        label: 'commandMenuShortcutTest',
        action: {
          type: 'test',
          payload: {}
        },
        shortcut: 'Shift+G'
      }
    },
    group: {
      '@apostrophecms/command-menu:content': {
        label: 'commandMenuContent',
        fields: [
          'discard-draft',
          'publish-draft',
          '@apostrophecms/command-menu:test'
        ]
      }
    }
  }
};
const moduleC = {
  commands: {
    remove: [
      '@apostrophecms/command-menu:test'
    ],
    group: {
      '@apostrophecms/command-menu:modes': {
        label: 'commandMenuModes',
        fields: [
          'toggle-edit-preview-mode',
          'toggle-publish-draft-mode'
        ]
      }
    }
  }
};
const moduleD = {
  commands: {
    group: {
      '@apostrophecms/command-menu:general': {
        label: 'commandMenuGeneral',
        fields: [
          'command-menu'
        ]
      }
    }
  }
};

describe('Command-Menu', function() {
  this.timeout(t.timeout);

  let apos;

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'module-a': moduleA,
        'module-b': moduleB,
        'module-c': moduleC,
        'module-d': moduleD
      }
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  it('should merge commands', function() {
    const initialState = {
      rawCommands: [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        moduleD.commands
      ]
    };

    const actual = apos.commandMenu.composeCommand(initialState);
    const expected = {
      ...initialState,
      command: {
        '@apostrophecms/command-menu:toggle-shortcuts': {
          action: {
            payload: {},
            type: 'toggle-shortcuts'
          },
          label: 'commandMenuShortcutToggleShortcuts',
          shortcut: 'Shift+K ?',
          type: 'item'
        },
        '@apostrophecms/command-menu:test': {
          type: 'item',
          label: 'commandMenuShortcutTest',
          action: {
            type: 'test',
            payload: {}
          },
          shortcut: 'Shift+G'
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should group commands', function() {
    const initialState = {
      rawCommands: [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        moduleD.commands
      ]
    };

    const actual = apos.commandMenu.composeGroup(initialState);
    const expected = {
      ...initialState,
      group: {
        '@apostrophecms/command-menu:content': {
          label: 'commandMenuContent',
          fields: [
            'undo',
            'redo',
            '@apostrophecms/command-menu:toggle-shortcuts',
            'discard-draft',
            'publish-draft',
            '@apostrophecms/command-menu:test'
          ]
        },
        '@apostrophecms/command-menu:modes': {
          label: 'commandMenuModes',
          fields: [
            'toggle-edit-preview-mode',
            'toggle-publish-draft-mode'
          ]
        },
        '@apostrophecms/command-menu:general': {
          label: 'commandMenuGeneral',
          fields: [
            'command-menu'
          ]
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should remove commands', function() {
    const initialState = {
      rawCommands: [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        {
          ...moduleD.commands,
          remove: [
            'toggle-publish-draft-mode'
          ]
        },
        {
          remove: [
            'redo',
            'command-menu'
          ]
        }
      ]
    };

    const actual = apos.commandMenu.composeRemove(initialState);
    const expected = {
      ...initialState,
      remove: [
        '@apostrophecms/command-menu:test',
        'toggle-publish-draft-mode',
        'redo',
        'command-menu'
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it.skip('should compose modal in commands', function() {
    const initialState = {
      rawCommands: [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        moduleD.commands,
        {
          add: {
            'article:create-new': {
              type: 'item',
              label: 'apostrophe:commandMenuCreateNew',
              action: {},
              shortcut: '',
              modal: 'article:manager'
            },
            'article:search': {
              type: 'item',
              label: 'apostrophe:commandMenuSearch',
              action: {},
              shortcut: '',
              modal: 'article:manager'
            },
            'article:select-all': {
              type: 'item',
              label: 'apostrophe:commandMenuSelectAll',
              action: {},
              shortcut: '',
              modal: 'article:manager'
            },
            'article:archive-selected': {
              type: 'item',
              label: 'apostrophe:commandMenuArchiveSelected',
              action: {},
              shortcut: '',
              modal: 'article:manager'
            },
            'article:exit-manager': {
              type: 'item',
              label: 'apostrophe:commandMenuExitManager',
              action: {},
              shortcut: '',
              modal: 'article:manager'
            }
          },
          group: {
            '@apostrophecms/command-menu:zz-manager': {
              label: null,
              fields: [
                'article:create-new',
                'article:search',
                'article:select-all',
                'article:archive-selected',
                'article:exit-manager'
              ]
            }
          }
        },
        {
          add: {
            'topic:create-new': {
              type: 'item',
              label: 'apostrophe:commandMenuCreateNew',
              action: {},
              shortcut: '',
              modal: 'topic:manager'
            },
            'topic:search': {
              type: 'item',
              label: 'apostrophe:commandMenuSearch',
              action: {},
              shortcut: '',
              modal: 'topic:manager'
            },
            'topic:select-all': {
              type: 'item',
              label: 'apostrophe:commandMenuSelectAll',
              action: {},
              shortcut: '',
              modal: 'topic:manager'
            },
            'topic:archive-selected': {
              type: 'item',
              label: 'apostrophe:commandMenuArchiveSelected',
              action: {},
              shortcut: '',
              modal: 'topic:manager'
            },
            'topic:exit-manager': {
              type: 'item',
              label: 'apostrophe:commandMenuExitManager',
              action: {},
              shortcut: '',
              modal: 'topic:manager'
            }
          },
          group: {
            '@apostrophecms/command-menu:zz-manager': {
              label: null,
              fields: [
                'topic:create-new',
                'topic:search',
                'topic:select-all',
                'topic:archive-selected',
                'topic:exit-manager'
              ]
            }
          }
        }
      ]
    };

    const actual = apos.commandMenu.composeModal(apos.commandMenu.composeGroup(initialState));
    const expected = {
      ...initialState,
      group: {
        ...actual.group, // TODO remove
        '@apostrophecms/command-menu:content': {
          label: 'apostrophe:commandMenuContent',
          fields: [
            'apostrophe:undo',
            'apostrophe:redo',
            '@apostrophecms/command-menu:toggle-shortcuts',
            'apostrophe:discard-draft',
            'apostrophe:publish-draft',
            '@apostrophecms/command-menu:test'
          ]
        },
        '@apostrophecms/command-menu:modes': {
          label: 'apostrophe:commandMenuModes',
          fields: [
            'apostrophe:toggle-edit-preview-mode',
            'apostrophe:toggle-publish-draft-mode'
          ]
        },
        '@apostrophecms/command-menu:general': {
          label: 'apostrophe:commandMenuGeneral',
          fields: [
            'apostrophe:command-menu'
          ]
        }
      },
      modal: {
        null: {
          '@apostrophecms/command-menu:content': {
            label: 'apostrophe:commandMenuContent',
            fields: [
              'apostrophe:undo',
              'apostrophe:redo',
              '@apostrophecms/command-menu:toggle-shortcuts',
              'apostrophe:discard-draft',
              'apostrophe:publish-draft',
              '@apostrophecms/command-menu:test'
            ]
          },
          '@apostrophecms/command-menu:modes': {
            label: 'apostrophe:commandMenuModes',
            fields: [
              'apostrophe:toggle-edit-preview-mode',
              'apostrophe:toggle-publish-draft-mode'
            ]
          },
          '@apostrophecms/command-menu:general': {
            label: 'apostrophe:commandMenuGeneral',
            fields: [
              'apostrophe:command-menu'
            ]
          }
        },
        'article:manager': {
          '@apostrophecms/command-menu:manager': {
            label: null,
            fields: [
              'article:create-new',
              'article:search',
              'article:select-all',
              'article:archive-selected',
              'article:exit-manager'
            ]
          }
        },
        'topic:manager': {
          '@apostrophecms/command-menu:manager': {
            label: null,
            fields: [
              'topic:create-new',
              'topic:search',
              'topic:select-all',
              'topic:archive-selected',
              'topic:exit-manager'
            ]
          }
        }
      }
    };

    assert.deepEqual(actual, expected);
  });
  it('should validate commands', function() {
    const initialState = {
      rawCommands: [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        moduleD.commands
      ]
    };
    const rawCommands = initialState.rawCommands.flatMap(rawCommand => Object.entries(rawCommand?.add || {}));

    const actual = Object.values(rawCommands)
      .map(([ name, command ]) => apos.commandMenu.validateCommand({
        name,
        command
      }));
    const expected = [
      [ true, null ],
      [ true, null ]
    ];

    assert.deepEqual(actual, expected);
  });

  it('should validate groups', function() {
    const initialState = {
      rawCommands: [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        moduleD.commands
      ]
    };
    const rawCommands = initialState.rawCommands.flatMap(rawCommand => Object.entries(rawCommand?.group || {}));

    const actual = Object.values(rawCommands)
      .map(([ name, group ]) => apos.commandMenu.validateGroup({
        name,
        group
      }));
    const expected = [
      [ true, null ],
      [ true, null ],
      [ true, null ],
      [ true, null ]
    ];

    assert.deepEqual(actual, expected);
  });

  it('should compile errors from multiple modules', function() {
    const initialState = {
      rawCommands: [
        moduleA.commands,
        {
          add: {
            command1: {}
          }
        },
        {
          group: {
            groupA: {}
          }
        }
      ]
    };
    const rawCommands = initialState.rawCommands.flatMap(rawCommand => Object.entries(rawCommand?.add || {}));
    const rawGroups = initialState.rawCommands.flatMap(rawCommand => Object.entries(rawCommand?.group || {}));

    const result = [].concat(
      Object.values(rawCommands)
        .map(([ name, command ]) => apos.commandMenu.validateCommand({
          name,
          command
        })),
      Object.values(rawGroups)
        .map(([ name, group ]) => apos.commandMenu.validateGroup({
          name,
          group
        }))
    );

    const actual = () => apos.commandMenu.compileErrors(result);
    const expected = {
      name: 'Error',
      message: 'Invalid',
      cause: [
        new assert.AssertionError({
          message: 'Invalid command type, must be "item", for command1',
          expected: 'item',
          operator: 'strictEqual'
        }),
        new assert.AssertionError({
          message: 'Invalid group label, must be a string, for groupA',
          actual: 'undefined',
          expected: 'string',
          operator: 'strictEqual'
        })
      ]
    };

    assert.throws(actual, expected);
  });

  it('should get visible commands only', function() {
    const req = apos.task.getReq();

    const actual = apos.commandMenu.getVisibleGroups(req);
    const expected = {
      '@apostrophecms/command-menu:content': {
        label: 'commandMenuContent',
        fields: {
          ...actual['@apostrophecms/command-menu:content']?.fields,
          '@apostrophecms/command-menu:toggle-shortcuts': {
            type: 'item',
            label: 'commandMenuShortcutToggleShortcuts',
            action: {
              type: 'toggle-shortcuts',
              payload: {}
            },
            shortcut: 'Shift+K ?'
          }
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it.only('should get visible modals commands only', function() {
    const req = apos.task.getReq();

    const actual = apos.commandMenu.getVisible(req);
    const expected = {
      groups: actual.groups,
      // {
      //   '@apostrophecms/command-menu:content': {
      //     label: 'apostrophe:commandMenuContent',
      //     fields: {
      //       ...actual['@apostrophecms/command-menu:content']?.fields,
      //       '@apostrophecms/command-menu:toggle-shortcuts': {
      //         type: 'item',
      //         label: 'apostrophe:commandMenuShortcutToggleShortcuts',
      //         action: {
      //           type: 'toggle-shortcuts',
      //           payload: {}
      //         },
      //         shortcut: 'Shift+K ?'
      //       }
      //     }
      //   }
      // },
      modals: {
        '@apostrophecms/any-doc-type:manager': {
          ...actual.modals['@apostrophecms/any-doc-type:manager']
        },
        '@apostrophecms/any-page-type:manager': {
          ...actual.modals['@apostrophecms/any-page-type:manager']
        },
        '@apostrophecms/archive-page:manager': {
          ...actual.modals['@apostrophecms/archive-page:manager']
        },
        '@apostrophecms/file-tag:manager': {
          ...actual.modals['@apostrophecms/file-tag:manager']
        },
        '@apostrophecms/file:manager': {
          ...actual.modals['@apostrophecms/file:manager']
        },
        '@apostrophecms/global:manager': {
          ...actual.modals['@apostrophecms/global:manager']
        },
        '@apostrophecms/home-page:manager': {
          ...actual.modals['@apostrophecms/home-page:manager']
        },
        '@apostrophecms/image-tag:manager': {
          ...actual.modals['@apostrophecms/image-tag:manager']
        },
        '@apostrophecms/image:manager': {
          ...actual.modals['@apostrophecms/image:manager']
        },
        '@apostrophecms/polymorphic-type:manager': {
          ...actual.modals['@apostrophecms/polymorphic-type:manager']
        },
        '@apostrophecms/search:manager': {
          ...actual.modals['@apostrophecms/search:manager']
        },
        '@apostrophecms/submitted-draft:manager': {
          ...actual.modals['@apostrophecms/submitted-draft:manager']
        },
        '@apostrophecms/user:manager': {
          ...actual.modals['@apostrophecms/user:manager']
        },
        null: {
          ...actual.modals.null
        }
      }
    };

    assert.deepEqual(actual, expected);
  });
});
