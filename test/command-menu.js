const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  moduleA,
  moduleB,
  moduleC,
  moduleD,
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
          fields: [
            '@apostrophecms/command-menu:toggle-shortcuts',
            'command-menu'
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
        null: {
          '@apostrophecms/command-menu:content': {
            label: 'commandMenuContent',
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
            label: 'commandMenuModes',
            fields: [
              'apostrophe:toggle-edit-preview-mode',
              'apostrophe:toggle-publish-draft-mode'
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
          fields: {
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
        null: {
          '@apostrophecms/command-menu:content': {
            label: 'commandMenuContent',
            fields: {
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
            fields: {
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
            fields: {
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

  it.skip('should get visible groups', function() {
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
            shortcut: '?'
          }
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it.skip('should get visible modals', function() {
    const req = apos.task.getReq();

    const actual = apos.commandMenu.getVisibleModals(req);
    const expected = {
      groups: actual.groups,
      modals: {
        '@apostrophecms/file-tag:manager': {
          ...actual.modals['@apostrophecms/file-tag:manager']
        },
        '@apostrophecms/file:manager': {
          ...actual.modals['@apostrophecms/file:manager']
        },
        '@apostrophecms/image-tag:manager': {
          ...actual.modals['@apostrophecms/image-tag:manager']
        },
        '@apostrophecms/image:manager': {
          ...actual.modals['@apostrophecms/image:manager']
        },
        '@apostrophecms/page:manager': {
          ...actual.modals['@apostrophecms/page:manager']
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
