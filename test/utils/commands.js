const moduleA = {
  extend: '@apostrophecms/piece-type',
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
    modal: {
      default: {
        '@apostrophecms/command-menu:content': {
          label: 'commandMenuContent',
          commands: [
            '@apostrophecms/command-menu:undo',
            '@apostrophecms/command-menu:redo',
            '@apostrophecms/command-menu:toggle-shortcuts'
          ]
        }
      }
    }
  }
};
const moduleB = {
  extend: '@apostrophecms/piece-type',
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
    modal: {
      default: {
        '@apostrophecms/command-menu:content': {
          label: 'commandMenuContent',
          commands: [
            '@apostrophecms/command-menu:discard-draft',
            '@apostrophecms/command-menu:publish-draft',
            '@apostrophecms/command-menu:test'
          ]
        }
      }
    }
  }
};
const moduleC = {
  extend: '@apostrophecms/piece-type',
  commands: {
    remove: [
      '@apostrophecms/command-menu:test'
    ],
    modal: {
      default: {
        '@apostrophecms/command-menu:modes': {
          label: 'commandMenuModes',
          commands: [
            '@apostrophecms/command-menu:toggle-edit-preview-mode',
            '@apostrophecms/command-menu:toggle-publish-draft-mode'
          ]
        }
      }
    }
  }
};
const moduleD = {
  extend: '@apostrophecms/piece-type',
  commands: {
    add: {
      '@apostrophecms/command-menu:toggle-shortcuts': {
        shortcut: '?'
      }
    },
    group: {
      '@apostrophecms/command-menu:general': {
        label: 'commandMenuGeneral',
        commands: [
          '@apostrophecms/command-menu:toggle-shortcuts',
          'command-menu'
        ]
      }
    }
  }
};
const moduleE = {
  extend: '@apostrophecms/piece-type',
  commands: {
    add: {
      '@apostrophecms/command-menu:toggle-shortcuts': {
        shortcut: false
      }
    },
    group: {
      '@apostrophecms/command-menu:general': {
        label: 'commandMenuGeneral',
        commands: [
          '@apostrophecms/command-menu:toggle-shortcuts',
          'command-menu'
        ]
      }
    }
  }
};
const article = {
  extend: '@apostrophecms/piece-type',
  commands: {
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
    modal: {
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
      }
    }
  }
};
const topic = {
  extend: '@apostrophecms/piece-type',
  commands: {
    add: {
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
    },
    modal: {
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
  }
};

module.exports = {
  moduleA,
  moduleB,
  moduleC,
  moduleD,
  moduleE,
  article,
  topic
};
