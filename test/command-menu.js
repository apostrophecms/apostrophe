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
            test: {}
          }
        },
        {
          group: {
            test: {}
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
          message: 'Invalid command type, must be "item", for test',
          expected: 'item',
          operator: 'strictEqual'
        }),
        new assert.AssertionError({
          message: 'Invalid group label, must be a string, for test',
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
});
