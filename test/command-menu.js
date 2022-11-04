const t = require('../test-lib/test.js');
const assert = require('assert').strict;

const moduleA = {
  commands: {
    add: {
      '@apostrophecms/command-menu:toggle-shortcuts': {
        type: 'item',
        label: 'apostrophe:commandMenuShortcutToggleShortcuts',
        action: {
          type: 'toggle-shortcuts',
          payload: {}
        },
        shortcut: 'Shift+K ?'
      }
    },
    group: {
      '@apostrophecms/command-menu:content': {
        label: 'apostrophe:commandMenuContent',
        fields: [
          'apostrophe:undo',
          'apostrophe:redo'
        ]
      }
    }
  }
};
const moduleB = {
  commands: {
    add: {
      '@apostrophecms/command-menu:test': {
      }
    },
    group: {
      '@apostrophecms/command-menu:content': {
        label: 'apostrophe:commandMenuContent',
        fields: [
          'apostrophe:discard-draft',
          'apostrophe:publish-draft'
        ]
      }
    }
  }
};
const moduleC = {
  commands: {
    group: {
      '@apostrophecms/command-menu:modes': {
        label: 'apostrophe:commandMenuModes',
        fields: [
          'apostrophe:toggle-edit-preview-mode',
          'apostrophe:toggle-publish-draft-mode'
        ]
      }
    }
  }
};
const moduleD = {
  commands: {
    group: {
      '@apostrophecms/command-menu:general': {
        label: 'apostrophe:commandMenuGeneral',
        fields: [
          'apostrophe:command-menu'
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
    const actual = apos.commandMenu.composeCommand(
      {},
      [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        moduleD.commands
      ]
    );
    const expected = {
      commands: {
        '@apostrophecms/command-menu:test': {},
        '@apostrophecms/command-menu:toggle-shortcuts': {
          action: {
            payload: {},
            type: 'toggle-shortcuts'
          },
          label: 'apostrophe:commandMenuShortcutToggleShortcuts',
          shortcut: 'Shift+K ?',
          type: 'item'
        }
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should group commands', function() {
    const actual = apos.commandMenu.composeGroup(
      {},
      [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        moduleD.commands
      ]
    );
    const expected = {
      '@apostrophecms/command-menu:content': {
        label: 'apostrophe:commandMenuContent',
        fields: [
          'apostrophe:undo',
          'apostrophe:redo',
          'apostrophe:discard-draft',
          'apostrophe:publish-draft'
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
      // '@apostrophecms/command-menu:general': {
      //   label: 'apostrophe:commandMenuGeneral',
      //   fields: [
      //     'apostrophe:create-new',
      //     'apostrophe:focus-search',
      //     'apostrophe:select-all',
      //     'apostrophe:archive',
      //     'apostrophe:exit',
      //   ]
      // }
    };

    assert.deepEqual(actual, expected);
  });

  it('should remove commands', function() {
    const actual = apos.commandMenu.composeRemove(
      {},
      [
        moduleA.commands,
        moduleB.commands,
        moduleC.commands,
        {
          ...moduleD.commands,
          remove: [
            'apostrophe:toggle-publish-draft-mode'
          ]
        },
        {
          remove: [
            'apostrophe:redo',
            'apostrophe:command-menu'
          ]
        }
      ]
    );
    const expected = {
      remove: [
        'apostrophe:toggle-publish-draft-mode',
        'apostrophe:redo',
        'apostrophe:command-menu'
      ]
    };

    assert.deepEqual(actual, expected);
  });
});
