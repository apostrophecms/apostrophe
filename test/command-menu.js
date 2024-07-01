const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  moduleA,
  moduleB,
  moduleC,
  moduleD,
  moduleE,
  article,
  topic
} = require('./utils/commands.js');

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

  it('should compose removes', function() {
    const initialState = {
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ {
          ...moduleD.commands,
          remove: [
            'toggle-publish-draft-mode'
          ]
        } ],
        [ {
          remove: [
            'redo',
            'command-menu'
          ]
        } ]
      ]
    };

    const actual = apos.commandMenu.composeRemoves(initialState);
    const expected = {
      ...initialState,
      removes: [
        '@apostrophecms/command-menu:test',
        'toggle-publish-draft-mode',
        'redo',
        'command-menu'
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should compose removes sequentially', function() {
    const initialState = {
      definitions: [
        [
          {
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
            }
          },
          {
            remove: [
              '@apostrophecms/command-menu:test'
            ]
          }
        ],
        [
          {
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
            }
          }
        ]
      ]
    };

    const actual = apos.commandMenu.composeRemoves(initialState);
    const expected = {
      ...initialState,
      removes: []
    };

    assert.deepEqual(actual, expected);
  });

  it('should compose commands', function() {
    const initialState = {
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ]
      ]
    };

    const actual = apos.commandMenu.composeCommands(initialState);
    const expected = {
      ...initialState,
      commands: {
        '@apostrophecms/command-menu:toggle-shortcuts': {
          action: {
            payload: {},
            type: 'toggle-shortcuts'
          },
          label: 'commandMenuShortcutToggleShortcuts',
          shortcut: '?',
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

  it('should compose groups', function() {
    const initialState = {
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ]
      ]
    };

    const actual = apos.commandMenu.composeGroups(initialState);
    const expected = {
      ...initialState,
      groups: {
        '@apostrophecms/command-menu:general': {
          label: 'commandMenuGeneral',
          commands: [
            '@apostrophecms/command-menu:toggle-shortcuts',
            'command-menu'
          ]
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should compose groups and remove duplicate commands', function() {
    const initialState = {
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ],
        [ {
          add: {
            '@apostrophecms/command-menu:help': {
              shortcut: '?'
            }
          },
          group: {
            '@apostrophecms/command-menu:help': {
              label: 'commandMenuHelp',
              commands: [
                '@apostrophecms/command-menu:toggle-shortcuts',
                '@apostrophecms/command-menu:help'
              ]
            }
          }
        } ]
      ]
    };

    const actual = apos.commandMenu.composeGroups(initialState);
    const expected = {
      ...initialState,
      groups: {
        '@apostrophecms/command-menu:general': {
          label: 'commandMenuGeneral',
          commands: [
            'command-menu'
          ]
        },
        '@apostrophecms/command-menu:help': {
          label: 'commandMenuHelp',
          commands: [
            '@apostrophecms/command-menu:toggle-shortcuts',
            '@apostrophecms/command-menu:help'
          ]
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should compose modals', function() {
    const initialState = {
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ],
        [ article.commands ],
        [ topic.commands ]
      ]
    };

    const actual = apos.commandMenu.composeModals(initialState);
    const expected = {
      ...initialState,
      modals: {
        default: {
          '@apostrophecms/command-menu:content': {
            label: 'commandMenuContent',
            commands: [
              '@apostrophecms/command-menu:undo',
              '@apostrophecms/command-menu:redo',
              '@apostrophecms/command-menu:toggle-shortcuts',
              '@apostrophecms/command-menu:discard-draft',
              '@apostrophecms/command-menu:publish-draft',
              '@apostrophecms/command-menu:test'
            ]
          },
          '@apostrophecms/command-menu:modes': {
            label: 'commandMenuModes',
            commands: [
              '@apostrophecms/command-menu:toggle-edit-preview-mode',
              '@apostrophecms/command-menu:toggle-publish-draft-mode'
            ]
          }
        },
        'article:manager': {
          '@apostrophecms/command-menu:manager': {
            label: null,
            commands: [
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
            commands: [
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
    const initialState = apos.util.pipe(
      apos.commandMenu.composeRemoves,
      apos.commandMenu.composeCommands,
      apos.commandMenu.composeGroups,
      apos.commandMenu.composeModals
    )({
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ],
        [ moduleE.commands ]
      ]
    });

    const actual = Object.entries(initialState.commands)
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
    const initialState = apos.util.pipe(
      apos.commandMenu.composeRemoves,
      apos.commandMenu.composeCommands,
      apos.commandMenu.composeGroups,
      apos.commandMenu.composeModals
    )({
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ]
      ]
    });

    const actual = Object.entries(initialState.groups)
      .map(([ name, group ]) => apos.commandMenu.validateGroup({
        name,
        group
      }));
    const expected = [
      [ true, null ]
    ];

    assert.deepEqual(actual, expected);
  });

  it('should validate modals', function() {
    const initialState = apos.util.pipe(
      apos.commandMenu.composeRemoves,
      apos.commandMenu.composeCommands,
      apos.commandMenu.composeGroups,
      apos.commandMenu.composeModals
    )({
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ]
      ]
    });

    const actual = Object.entries(initialState.modals)
      .flatMap(([ name, modal ]) => apos.commandMenu.validateModal({
        name,
        modal
      }));
    const expected = [
      [ true, null ],
      [ true, null ]
    ];

    assert.deepEqual(actual, expected);
  });

  it('should compile errors', function() {
    const initialState = apos.util.pipe(
      apos.commandMenu.composeRemoves,
      apos.commandMenu.composeCommands,
      apos.commandMenu.composeGroups,
      apos.commandMenu.composeModals
    )({
      definitions: [
        [ moduleA.commands ],
        [ moduleB.commands ],
        [ moduleC.commands ],
        [ moduleD.commands ],
        [ { add: { command1: {} } } ],
        [ { group: { groupA: {} } } ],
        [ { modal: { modalA: { groupB: {} } } } ]
      ]
    });

    const result = [].concat(
      Object.entries(initialState.commands)
        .map(([ name, command ]) => apos.commandMenu.validateCommand({
          name,
          command
        })),
      Object.entries(initialState.groups)
        .map(([ name, group ]) => apos.commandMenu.validateGroup({
          name,
          group
        })),
      Object.entries(initialState.modals)
        .flatMap(([ name, modal ]) => apos.commandMenu.validateModal({
          name,
          modal
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
          message: 'Invalid group label, must be a string, for groupA "undefined" provided',
          actual: 'undefined',
          expected: 'string',
          operator: 'strictEqual'
        }),
        new assert.AssertionError({
          message: 'Invalid group label, must be a string, for modalA:groupB "undefined" provided',
          actual: 'undefined',
          expected: 'string',
          operator: 'strictEqual'
        })
      ]
    };

    assert.throws(actual, expected);
  });

  it('should build commands', function() {
    const initialState = {
      composed: apos.util.pipe(
        apos.commandMenu.composeRemoves,
        apos.commandMenu.composeCommands,
        apos.commandMenu.composeGroups,
        apos.commandMenu.composeModals
      )({
        definitions: [
          [ moduleA.commands ],
          [ moduleB.commands ],
          [ moduleC.commands ],
          [ moduleD.commands ]
        ]
      })
    };

    const actual = apos.commandMenu.buildCommands(initialState);
    const expected = {
      ...initialState,
      commands: {
        '@apostrophecms/command-menu:toggle-shortcuts': {
          action: {
            payload: {},
            type: 'toggle-shortcuts'
          },
          label: 'commandMenuShortcutToggleShortcuts',
          shortcut: '?',
          type: 'item'
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should build groups', function() {
    const initialState = {
      composed: apos.util.pipe(
        apos.commandMenu.composeRemoves,
        apos.commandMenu.composeCommands,
        apos.commandMenu.composeGroups,
        apos.commandMenu.composeModals
      )({
        definitions: [
          [ moduleA.commands ],
          [ moduleB.commands ],
          [ moduleC.commands ],
          [ moduleD.commands ]
        ]
      })
    };

    const { commands } = apos.commandMenu.buildCommands(initialState);

    const actual = apos.commandMenu.buildGroups({
      ...initialState,
      commands
    });
    const expected = {
      ...initialState,
      commands,
      groups: {
        '@apostrophecms/command-menu:general': {
          label: 'commandMenuGeneral',
          commands: {
            '@apostrophecms/command-menu:toggle-shortcuts': {
              action: {
                payload: {},
                type: 'toggle-shortcuts'
              },
              label: 'commandMenuShortcutToggleShortcuts',
              shortcut: '?',
              type: 'item'
            }
          }
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should build modals', function() {
    const initialState = {
      composed: apos.util.pipe(
        apos.commandMenu.composeRemoves,
        apos.commandMenu.composeCommands,
        apos.commandMenu.composeGroups,
        apos.commandMenu.composeModals
      )({
        definitions: [
          [ moduleA.commands ],
          [ moduleB.commands ],
          [ moduleC.commands ],
          [ moduleD.commands ],
          [ article.commands ],
          [ topic.commands ]
        ]
      })
    };

    const {
      commands,
      groups
    } = apos.util.pipe(
      apos.commandMenu.buildCommands,
      apos.commandMenu.buildGroups
    )(initialState);

    const actual = apos.commandMenu.buildModals({
      ...initialState,
      commands,
      groups
    });
    const expected = {
      ...initialState,
      commands,
      groups,
      modals: {
        default: {
          '@apostrophecms/command-menu:content': {
            label: 'commandMenuContent',
            commands: {
              '@apostrophecms/command-menu:toggle-shortcuts': {
                type: 'item',
                label: 'commandMenuShortcutToggleShortcuts',
                action: {
                  type: 'toggle-shortcuts',
                  payload: {}
                },
                shortcut: '?'
              }
            }
          }
        },
        'article:manager': {
          '@apostrophecms/command-menu:manager': {
            label: null,
            commands: {
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
            }
          }
        },
        'topic:manager': {
          '@apostrophecms/command-menu:manager': {
            label: null,
            commands: {
              'topic:create-new': {
                type: 'item',
                label: 'apostrophe:commandMenuCreateNew',
                action: {},
                shortcut: ''
              },
              'topic:search': {
                type: 'item',
                label: 'apostrophe:commandMenuSearch',
                action: {},
                shortcut: ''
              },
              'topic:select-all': {
                type: 'item',
                label: 'apostrophe:commandMenuSelectAll',
                action: {},
                shortcut: ''
              },
              'topic:archive-selected': {
                type: 'item',
                label: 'apostrophe:commandMenuArchiveSelected',
                action: {},
                shortcut: ''
              },
              'topic:exit-manager': {
                type: 'item',
                label: 'apostrophe:commandMenuExitManager',
                action: {},
                shortcut: ''
              }
            }
          }
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should tell that the command is visible without command permission', function() {
    const req = apos.task.getReq();
    const command = {
      type: 'item',
      label: 'apostrophe:commandMenuCreateNew',
      action: {},
      shortcut: 'c'
    };

    const actual = apos.commandMenu.isCommandVisible(req, command);
    const expected = true;

    assert.equal(actual, expected);
  });

  it('should tell that the command not visible with correct command permission', function() {
    const req = apos.task.getReq();
    const command = {
      type: 'item',
      label: 'apostrophe:commandMenuCreateNew',
      action: {},
      shortcut: 'c',
      permission: {
        action: 'create',
        type: '@apostrophecms/page',
        mode: 'draft'
      }
    };

    const actual = apos.commandMenu.isCommandVisible(req, command);
    const expected = true;

    assert.equal(actual, expected);
  });

  it('should tell that the command is not visible with wrong command permission', function() {
    const req = apos.task.getContributorReq();
    const command = {
      type: 'item',
      label: 'apostrophe:commandMenuCreateNew',
      action: {},
      shortcut: 'c',
      permission: {
        action: 'create',
        type: '@apostrophecms/page',
        mode: 'published'
      }
    };

    const actual = apos.commandMenu.isCommandVisible(req, command);
    const expected = false;

    assert.equal(actual, expected);
  });

  it('should get visible groups', function() {
    const initialState = {
      composed: apos.util.pipe(
        apos.commandMenu.composeRemoves,
        apos.commandMenu.composeCommands,
        apos.commandMenu.composeGroups,
        apos.commandMenu.composeModals
      )({
        definitions: [
          [ moduleA.commands ],
          [ moduleB.commands ],
          [ moduleC.commands ],
          [ moduleD.commands ],
          [ article.commands ],
          [ topic.commands ]
        ]
      })
    };

    const built = apos.util.pipe(
      apos.commandMenu.buildCommands,
      apos.commandMenu.buildGroups,
      apos.commandMenu.buildModals
    )(initialState);

    const visibleCommands = [
      '@apostrophecms/command-menu:toggle-shortcuts'
    ];

    const actual = apos.commandMenu.getVisibleGroups(visibleCommands, built.groups);
    const expected = {
      '@apostrophecms/command-menu:general': {
        label: 'commandMenuGeneral',
        commands: {
          '@apostrophecms/command-menu:toggle-shortcuts': {
            type: 'item',
            label: 'commandMenuShortcutToggleShortcuts',
            action: {
              type: 'toggle-shortcuts',
              payload: {}
            },
            shortcut: '?'
          }
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should get visible modals', function() {
    const initialState = {
      composed: apos.util.pipe(
        apos.commandMenu.composeRemoves,
        apos.commandMenu.composeCommands,
        apos.commandMenu.composeGroups,
        apos.commandMenu.composeModals
      )({
        definitions: [
          [ moduleA.commands ],
          [ moduleB.commands ],
          [ moduleC.commands ],
          [ moduleD.commands ],
          [ article.commands ],
          [ topic.commands ]
        ]
      })
    };

    const built = apos.util.pipe(
      apos.commandMenu.buildCommands,
      apos.commandMenu.buildGroups,
      apos.commandMenu.buildModals
    )(initialState);

    const visibleCommands = [
      'article:search',
      'article:select-all',
      'article:archive-selected',
      'article:exit-manager',
      'topic:search',
      'topic:select-all',
      'topic:archive-selected',
      'topic:exit-manager'
    ];

    const actual = apos.commandMenu.getVisibleModals(visibleCommands, built.modals);
    const expected = {
      'article:manager': {
        '@apostrophecms/command-menu:manager': {
          label: null,
          commands: {
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
          }
        }
      },
      'topic:manager': {
        '@apostrophecms/command-menu:manager': {
          label: null,
          commands: {
            'topic:search': {
              type: 'item',
              label: 'apostrophe:commandMenuSearch',
              action: {},
              shortcut: ''
            },
            'topic:select-all': {
              type: 'item',
              label: 'apostrophe:commandMenuSelectAll',
              action: {},
              shortcut: ''
            },
            'topic:archive-selected': {
              type: 'item',
              label: 'apostrophe:commandMenuArchiveSelected',
              action: {},
              shortcut: ''
            },
            'topic:exit-manager': {
              type: 'item',
              label: 'apostrophe:commandMenuExitManager',
              action: {},
              shortcut: ''
            }
          }
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should detect a single shortcut conflict', () => {
    const shortcuts = {
      modal: { '@apostrophecms/file:manager': [ 'C' ] },
      list: {
        '@apostrophecms/file:manager': {
          C: [ '@apostrophecms/file:create-new' ]
        }
      },
      conflict: {}
    };
    const actual = apos.commandMenu.detectShortcutConflict({
      shortcuts,
      shortcut: 'C',
      modal: '@apostrophecms/file:manager',
      moduleName: '@apostrophecms/file:search'
    });
    const expected = {
      modal: { '@apostrophecms/file:manager': [ 'C' ] },
      list: {
        '@apostrophecms/file:manager': {
          C: [ '@apostrophecms/file:create-new', '@apostrophecms/file:search' ]
        }
      },
      conflict: {
        '@apostrophecms/file:manager': {
          C: [ '@apostrophecms/file:create-new', '@apostrophecms/file:search' ]
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should detect multiple shortcut conflicts', () => {
    const shortcuts = {
      modal: { '@apostrophecms/file:manager': [ 'C' ] },
      list: {
        '@apostrophecms/file:manager': {
          C: [ '@apostrophecms/file:create-new', '@apostrophecms/file:search' ]
        }
      },
      conflict: {
        '@apostrophecms/file:manager': {
          C: [ '@apostrophecms/file:create-new' ]
        }
      }
    };
    const actual = apos.commandMenu.detectShortcutConflict({
      shortcuts,
      shortcut: 'C',
      modal: '@apostrophecms/file:manager',
      moduleName: '@apostrophecms/file:select-all'
    });
    const expected = {
      modal: { '@apostrophecms/file:manager': [ 'C' ] },
      list: {
        '@apostrophecms/file:manager': {
          C: [ '@apostrophecms/file:create-new', '@apostrophecms/file:search', '@apostrophecms/file:select-all' ]
        }
      },
      conflict: {
        '@apostrophecms/file:manager': {
          C: [ '@apostrophecms/file:create-new', '@apostrophecms/file:search', '@apostrophecms/file:select-all' ]
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should build commands and remove null shortcut', function() {
    const initialState = {
      composed: apos.util.pipe(
        apos.commandMenu.composeRemoves,
        apos.commandMenu.composeCommands,
        apos.commandMenu.composeGroups,
        apos.commandMenu.composeModals
      )({
        definitions: [
          [ moduleA.commands ],
          [ moduleD.commands ],
          [ moduleE.commands ]
        ]
      })
    };

    const actual = apos.commandMenu.buildCommands(initialState);
    const expected = {
      ...initialState,
      commands: {}
    };

    assert.deepEqual(actual, expected);
  });

  it('should build commands and keep last non null shortcut', function() {
    const initialState = {
      composed: apos.util.pipe(
        apos.commandMenu.composeRemoves,
        apos.commandMenu.composeCommands,
        apos.commandMenu.composeGroups,
        apos.commandMenu.composeModals
      )({
        definitions: [
          [ moduleA.commands ],
          [ moduleE.commands ],
          [ moduleD.commands ]
        ]
      })
    };

    const actual = apos.commandMenu.buildCommands(initialState);
    const expected = {
      ...initialState,
      commands: {
        '@apostrophecms/command-menu:toggle-shortcuts': {
          action: {
            payload: {},
            type: 'toggle-shortcuts'
          },
          label: 'commandMenuShortcutToggleShortcuts',
          shortcut: '?',
          type: 'item'
        }
      }
    };

    assert.deepEqual(actual, expected);
  });
});
