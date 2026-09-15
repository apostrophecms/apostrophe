// Expected `getCompareSchema` output for the test fixtures

const article = [
  {
    _extractable: [
      'text'
    ],
    _id: '%placeholder%',
    def: '',
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'apostrophe:title',
    moduleName: 'article',
    name: 'title',
    required: true,
    sortify: true,
    type: 'string'
  },
  {
    _extractable: [],
    _extractableWidgets: {
      '@apostrophecms/image': [],
      '@apostrophecms/video': [],
      '@apostrophecms/rich-text': []
    },
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Main',
    moduleName: 'article',
    name: 'main',
    options: {
      widgets: {
        '@apostrophecms/image': {},
        '@apostrophecms/video': {},
        '@apostrophecms/rich-text': {}
      }
    },
    type: 'area'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    editor: undefined,
    editorIcon: undefined,
    editorLabel: undefined,
    fields: undefined,
    fieldsStorage: 'relatedFields',
    group: {
      name: 'basics',
      label: 'Basics'
    },
    idsStorage: 'relatedIds',
    label: 'Related articles',
    moduleName: 'article',
    name: '_related',
    postprocessor: undefined,
    schema: [],
    suggestionFields: [
      'slug'
    ],
    suggestionHelp: 'apostrophe:relationshipSuggestionHelp',
    suggestionIcon: 'text-box-icon',
    suggestionLabel: 'apostrophe:relationshipSuggestionLabel',
    suggestionLimit: 25,
    suggestionSort: {
      updatedAt: -1
    },
    type: 'relationship',
    withType: 'article'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Integer',
    moduleName: 'article',
    name: 'int',
    type: 'integer'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Float',
    moduleName: 'article',
    name: 'float',
    type: 'float'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Boolean',
    moduleName: 'article',
    name: 'boolean',
    type: 'boolean'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    accept: '.txt,.rtf,.pdf,.xls,.ppt,.doc,.pptx,.sldx,.ppsx,.potx,.xlsx,.xltx,.csv,.docx,.dotx',
    def: undefined,
    fileGroup: 'office',
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Resume',
    moduleName: 'article',
    name: 'attachment',
    type: 'attachment'
  },
  {
    _extractable: [],
    _id: '%placeholder%',
    def: [],
    fields: {
      add: {
        label: {
          type: 'string',
          label: 'Label'
        },
        value: {
          type: 'string',
          label: 'Value'
        }
      }
    },
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Contact information',
    moduleName: 'article',
    name: 'array',
    schema: [
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Label',
        moduleName: 'article',
        name: 'label',
        type: 'string'
      },
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Value',
        moduleName: 'article',
        name: 'value',
        type: 'string'
      }
    ],
    scopedArrayName: 'doc.article.array',
    titleField: 'label',
    type: 'array'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Date',
    moduleName: 'article',
    name: 'date',
    type: 'date'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Time',
    moduleName: 'article',
    name: 'time',
    type: 'time'
  },
  {
    _extractable: [],
    _id: '%placeholder%',
    def: {},
    fields: {
      add: {
        key1: {
          type: 'string',
          label: 'Key1'
        },
        key2: {
          type: 'string',
          label: 'Key2'
        }
      }
    },
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Object',
    moduleName: 'article',
    name: 'object',
    schema: [
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Key1',
        moduleName: 'article',
        name: 'key1',
        type: 'string'
      },
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Key2',
        moduleName: 'article',
        name: 'key2',
        type: 'string'
      }
    ],
    scopedObjectName: 'doc.article.object',
    type: 'object'
  },
  {
    _extractable: [
      'text'
    ],
    _id: '%placeholder%',
    def: '',
    following: [
      'title',
      'archived'
    ],
    group: {
      name: 'utility'
    },
    label: 'apostrophe:slug',
    moduleName: 'article',
    name: 'slug',
    required: true,
    type: 'slug'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    choices: [
      {
        value: 'public',
        label: 'apostrophe:public'
      },
      {
        value: 'loginRequired',
        label: 'apostrophe:loginRequired'
      }
    ],
    def: 'public',
    group: {
      name: 'utility'
    },
    help: 'apostrophe:visibilityHelp',
    label: 'apostrophe:visibility',
    moduleName: 'article',
    name: 'visibility',
    required: true,
    type: 'select'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    contextual: true,
    def: false,
    group: {
      name: 'ungrouped',
      label: 'apostrophe:ungrouped'
    },
    label: 'apostrophe:archived',
    moduleName: 'article',
    name: 'archived',
    type: 'boolean'
  }
];

const articlePage = [
  {
    _extractable: [
      'text'
    ],
    _id: '%placeholder%',
    def: '',
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'apostrophe:title',
    moduleName: 'article-page',
    name: 'title',
    required: true,
    sortify: true,
    type: 'string'
  },
  {
    _extractable: [],
    _extractableWidgets: {
      '@apostrophecms/image': [],
      '@apostrophecms/video': [],
      '@apostrophecms/rich-text': []
    },
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Main',
    moduleName: 'article-page',
    name: 'main',
    options: {
      widgets: {
        '@apostrophecms/image': {},
        '@apostrophecms/video': {},
        '@apostrophecms/rich-text': {}
      }
    },
    type: 'area'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    editor: undefined,
    editorIcon: undefined,
    editorLabel: undefined,
    fields: undefined,
    fieldsStorage: 'relatedFields',
    group: {
      name: 'basics',
      label: 'Basics'
    },
    idsStorage: 'relatedIds',
    label: 'Related articles',
    moduleName: 'article-page',
    name: '_related',
    postprocessor: undefined,
    schema: [],
    suggestionFields: [
      'slug'
    ],
    suggestionHelp: 'apostrophe:relationshipSuggestionHelp',
    suggestionIcon: 'text-box-icon',
    suggestionLabel: 'apostrophe:relationshipSuggestionLabel',
    suggestionLimit: 25,
    suggestionSort: {
      updatedAt: -1
    },
    type: 'relationship',
    withType: 'article'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Integer',
    moduleName: 'article-page',
    name: 'int',
    type: 'integer'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Float',
    moduleName: 'article-page',
    name: 'float',
    type: 'float'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Boolean',
    moduleName: 'article-page',
    name: 'boolean',
    type: 'boolean'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    accept: '.txt,.rtf,.pdf,.xls,.ppt,.doc,.pptx,.sldx,.ppsx,.potx,.xlsx,.xltx,.csv,.docx,.dotx',
    def: undefined,
    fileGroup: 'office',
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Resume',
    moduleName: 'article-page',
    name: 'attachment',
    type: 'attachment'
  },
  {
    _extractable: [],
    _id: '%placeholder%',
    def: [],
    fields: {
      add: {
        label: {
          type: 'string',
          label: 'Label'
        },
        value: {
          type: 'string',
          label: 'Value'
        }
      }
    },
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Contact information',
    moduleName: 'article-page',
    name: 'array',
    schema: [
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Label',
        moduleName: 'article-page',
        name: 'label',
        type: 'string'
      },
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Value',
        moduleName: 'article-page',
        name: 'value',
        type: 'string'
      }
    ],
    scopedArrayName: 'doc.article-page.array',
    titleField: 'label',
    type: 'array'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Date',
    moduleName: 'article-page',
    name: 'date',
    type: 'date'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: undefined,
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Time',
    moduleName: 'article-page',
    name: 'time',
    type: 'time'
  },
  {
    _extractable: [],
    _id: '%placeholder%',
    def: {},
    fields: {
      add: {
        key1: {
          type: 'string',
          label: 'Key1'
        },
        key2: {
          type: 'string',
          label: 'Key2'
        }
      }
    },
    group: {
      name: 'basics',
      label: 'Basics'
    },
    label: 'Object',
    moduleName: 'article-page',
    name: 'object',
    schema: [
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Key1',
        moduleName: 'article-page',
        name: 'key1',
        type: 'string'
      },
      {
        _extractable: [
          'text'
        ],
        _id: '%placeholder%',
        def: '',
        group: {
          name: 'ungrouped',
          label: 'apostrophe:ungrouped'
        },
        label: 'Key2',
        moduleName: 'article-page',
        name: 'key2',
        type: 'string'
      }
    ],
    scopedObjectName: 'doc.article-page.object',
    type: 'object'
  },
  {
    _extractable: [
      'text'
    ],
    _id: '%placeholder%',
    def: '',
    following: [
      'title',
      'archived'
    ],
    group: {
      name: 'utility',
      label: undefined
    },
    label: 'apostrophe:slug',
    moduleName: 'article-page',
    name: 'slug',
    page: true,
    required: true,
    type: 'slug'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    choices: [
      {
        value: 'default-page',
        label: 'Default page'
      },
      {
        value: '@apostrophecms/home-page',
        label: 'Home page'
      }
    ],
    def: 'default-page',
    group: {
      name: 'utility',
      label: undefined
    },
    label: 'apostrophe:type',
    moduleName: 'article-page',
    name: 'type',
    required: true,
    type: 'select'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    choices: [
      {
        value: 'public',
        label: 'apostrophe:public'
      },
      {
        value: 'loginRequired',
        label: 'apostrophe:loginRequired'
      }
    ],
    def: 'public',
    group: {
      name: 'utility',
      label: undefined
    },
    help: 'apostrophe:visibilityHelp',
    label: 'apostrophe:visibility',
    moduleName: 'article-page',
    name: 'visibility',
    required: true,
    type: 'select'
  },
  {
    _extractable: false,
    _id: '%placeholder%',
    def: false,
    group: {
      name: 'utility',
      label: undefined
    },
    label: 'apostrophe:hideInNavigation',
    moduleName: 'article-page',
    name: 'orphan',
    type: 'boolean'
  }
];

module.exports = {
  article,
  articlePage
};
