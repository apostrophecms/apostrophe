// A deeply nested document type for the diff engine tests, with the
// modules it needs and a builder for its documents.
//
// Ten containers nest by turns as an object (`section`), an array (`rows`)
// and an area (`content`) whose widget carries the next container; every
// container holds the same set of leaf fields. The deepest leaf sits 16
// breadcrumb segments down and the type has about 180 fields.

const DEPTH = 10;

const choices = [
  {
    label: 'One',
    value: 'one'
  },
  {
    label: 'Two',
    value: 'two'
  }
];

function leaves(depth) {
  return {
    title: {
      type: 'string',
      label: 'Title'
    },
    subtitle: {
      type: 'string',
      label: 'Subtitle'
    },
    shout: {
      type: 'shout',
      label: 'Shout'
    },
    count: {
      type: 'integer',
      label: 'Count'
    },
    ratio: {
      type: 'float',
      label: 'Ratio'
    },
    flag: {
      type: 'boolean',
      label: 'Flag'
    },
    choice: {
      type: 'select',
      label: 'Choice',
      choices
    },
    tags: {
      type: 'checkboxes',
      label: 'Tags',
      choices
    },
    when: {
      type: 'date',
      label: 'When'
    },
    at: {
      type: 'time',
      label: 'At'
    },
    link: {
      type: 'url',
      label: 'Link'
    },
    mail: {
      type: 'email',
      label: 'Mail'
    },
    body: {
      type: 'richText',
      label: 'Body'
    },
    tint: {
      type: 'color',
      label: 'Tint'
    },
    file: {
      type: 'attachment',
      label: 'File'
    },
    _topics: {
      type: 'relationship',
      label: 'Topics',
      withType: 'topic',
      ...(depth === 0 && {
        fields: {
          add: {
            relevance: {
              type: 'integer',
              label: 'Relevance'
            }
          }
        }
      })
    }
  };
}

// The kind of container at `depth`: what its nested field is
function kindAt(depth) {
  return [ 'object', 'array', 'area' ][depth % 3];
}

function container(depth) {
  const fields = leaves(depth);
  if (depth + 1 >= DEPTH) {
    return fields;
  }
  const kind = kindAt(depth);
  if (kind === 'object') {
    fields.section = {
      type: 'object',
      label: 'Section',
      fields: {
        add: container(depth + 1)
      }
    };
  } else if (kind === 'array') {
    fields.rows = {
      type: 'array',
      label: 'Rows',
      titleField: 'title',
      fields: {
        add: container(depth + 1)
      }
    };
  } else {
    fields.content = {
      type: 'area',
      label: 'Content',
      options: {
        widgets: {
          [`nested-${depth}`]: {},
          '@apostrophecms/rich-text': {},
          opaque: {},
          card: {}
        }
      }
    };
  }
  return fields;
}

function widgetModules() {
  const modules = {};
  for (let depth = 0; depth + 1 < DEPTH; depth++) {
    if (kindAt(depth) === 'area') {
      modules[`nested-${depth}-widget`] = {
        extend: '@apostrophecms/widget-type',
        options: {
          label: `Nested ${depth}`,
          // One widget type opts into receiving its older version
          ...(depth === 5 && { renderVersions: true })
        },
        fields: {
          add: container(depth + 1)
        }
      };
    }
  }
  return modules;
}

const modules = {
  // A string-like type with its own equality: case does not count
  'shout-field': {
    init(self) {
      self.apos.schema.addFieldType({
        name: 'shout',
        extend: 'string',
        isEqual(req, field, one, two) {
          return (one[field.name] || '').toLowerCase() ===
            (two[field.name] || '').toLowerCase();
        }
      });
    }
  },
  topic: {
    extend: '@apostrophecms/piece-type',
    options: {
      label: 'Topic'
    }
  },
  // Titled by a choice field
  'card-widget': {
    extend: '@apostrophecms/widget-type',
    options: {
      label: 'Card',
      titleField: 'kind'
    },
    fields: {
      add: {
        kind: {
          type: 'select',
          label: 'Kind',
          choices
        },
        note: {
          type: 'string',
          label: 'Note'
        }
      }
    }
  },
  // The global styles document takes the same presets at its top level
  '@apostrophecms/styles': {
    styles: {
      add: {
        bodyPadding: {
          preset: 'padding',
          label: 'Body padding',
          selector: 'body'
        },
        bodyBorder: {
          preset: 'border',
          selector: 'body'
        }
      }
    }
  },
  // Styled with presets of every kind: a number with a unit, a choice,
  // a box and an object of several fields
  'styled-widget': {
    extend: '@apostrophecms/widget-type',
    options: {
      label: 'Styled'
    },
    styles: {
      add: {
        width: 'width',
        alignment: 'alignment',
        padding: 'padding',
        border: 'border'
      }
    }
  },
  // Stores its data outside any schema
  'opaque-widget': {
    extend: '@apostrophecms/widget-type',
    options: {
      label: 'Opaque'
    }
  },
  ...widgetModules(),
  // A project's own field types, one for each kind of core type the diff
  // engine treats in its own way, and a document type made of them. Core
  // composes `fields` for the `array` and `object` types alone, so the
  // types extending them bring their `schema` as it is
  'project-field': {
    init(self) {
      self.apos.schema.addFieldType({
        name: 'tagline',
        extend: 'string'
      });
      // Zero reads as no rating at all
      self.apos.schema.addFieldType({
        name: 'rating',
        extend: 'integer',
        isEmpty(field, value) {
          return !value;
        }
      });
      for (const [ name, extend ] of [
        [ 'prose', 'richText' ],
        [ 'panel', 'object' ],
        [ 'steps', 'array' ],
        [ 'zone', 'area' ],
        [ 'owners', 'relationship' ]
      ]) {
        self.apos.schema.addFieldType({
          name,
          extend
        });
      }
    }
  },
  project: {
    extend: '@apostrophecms/piece-type',
    options: {
      label: 'Project'
    },
    fields: {
      add: {
        tagline: {
          type: 'tagline',
          label: 'Tagline'
        },
        rating: {
          type: 'rating',
          label: 'Rating'
        },
        prose: {
          type: 'prose',
          label: 'Prose'
        },
        panel: {
          type: 'panel',
          label: 'Panel',
          schema: [
            {
              name: 'tagline',
              type: 'tagline',
              label: 'Panel tagline'
            }
          ]
        },
        steps: {
          type: 'steps',
          label: 'Steps',
          titleField: 'tagline',
          schema: [
            {
              name: 'tagline',
              type: 'tagline',
              label: 'Step tagline'
            }
          ]
        },
        zone: {
          type: 'zone',
          label: 'Zone',
          options: {
            widgets: {
              '@apostrophecms/rich-text': {},
              card: {}
            }
          }
        },
        _owners: {
          type: 'owners',
          label: 'Owners',
          withType: 'topic'
        }
      }
    }
  },
  nested: {
    extend: '@apostrophecms/piece-type',
    options: {
      label: 'Nested',
      alias: 'nested'
    },
    fields: {
      add: container(0)
    }
  }
};

// The content of one container at `depth`, ids derived from `prefix` so
// that two builds are deep-equal and any node can be addressed
function build(depth, prefix) {
  const node = {
    title: `Title ${prefix}`,
    subtitle: '',
    shout: 'Hello',
    count: depth,
    ratio: 0.5,
    flag: false,
    choice: 'one',
    tags: [ 'one' ],
    when: '2026-01-01',
    at: '10:00:00',
    link: 'https://example.com/',
    mail: 'someone@example.com',
    body: `<p>Body ${prefix}</p>`,
    tint: '#ff0000',
    file: depth === 0
      ? {
        _id: 'attachment1',
        name: 'report',
        extension: 'pdf'
      }
      : null,
    topicsIds: [ 'topic1' ],
    ...(depth === 0 && {
      topicsFields: {
        topic1: {
          relevance: 1
        }
      }
    })
  };
  if (depth + 1 >= DEPTH) {
    return node;
  }
  const kind = kindAt(depth);
  if (kind === 'object') {
    node.section = build(depth + 1, `${prefix}.section`);
  } else if (kind === 'array') {
    node.rows = [ 0, 1 ].map(index => ({
      _id: `${prefix}.rows.${index}`,
      metaType: 'arrayItem',
      ...build(depth + 1, `${prefix}.rows.${index}`)
    }));
  } else {
    node.content = {
      _id: `${prefix}.content`,
      metaType: 'area',
      items: [
        {
          _id: `${prefix}.content.0`,
          metaType: 'widget',
          type: `nested-${depth}`,
          ...build(depth + 1, `${prefix}.content.0`)
        },
        {
          _id: `${prefix}.content.1`,
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: `<p>Rich ${prefix}</p>`
        },
        {
          _id: `${prefix}.content.2`,
          metaType: 'widget',
          type: 'opaque',
          payload: {
            n: 1
          }
        }
      ]
    };
  }
  return node;
}

function buildDoc() {
  return {
    _id: 'nested1:en:draft',
    aposDocId: 'nested1',
    aposLocale: 'en:draft',
    aposMode: 'draft',
    type: 'nested',
    slug: 'nested-1',
    archived: false,
    visibility: 'public',
    ...build(0, 'root')
  };
}

// The nodes along the route from the root to the deepest container: every
// container, each with its breadcrumb segments as the engine reports them
function deepestRoute(doc) {
  const route = [];
  let node = doc;
  let prefix = 'root';
  for (let depth = 0; depth + 1 < DEPTH; depth++) {
    const kind = kindAt(depth);
    if (kind === 'object') {
      node = node.section;
      prefix = `${prefix}.section`;
      route.push({
        node,
        segments: [
          {
            name: 'section',
            label: 'Section'
          }
        ]
      });
    } else if (kind === 'array') {
      node = node.rows[0];
      prefix = `${prefix}.rows.0`;
      route.push({
        node,
        segments: [
          {
            name: 'rows',
            label: 'Rows'
          },
          {
            name: prefix,
            label: `Title ${prefix}`,
            ordinal: 1
          }
        ]
      });
    } else {
      node = node.content.items[0];
      prefix = `${prefix}.content.0`;
      route.push({
        node,
        segments: [
          {
            name: 'content',
            label: 'Content'
          },
          {
            name: prefix,
            label: `Nested ${depth}`,
            ordinal: 1,
            widgetType: `nested-${depth}`
          }
        ]
      });
    }
  }
  return route;
}

// A document of the `project` type, the same on every call
function buildProject() {
  return {
    _id: 'project1:en:draft',
    type: 'project',
    title: 'Project',
    tagline: 'Built to last',
    rating: 0,
    prose: '<p>The quick brown fox</p>',
    panel: {
      _id: 'panel1',
      metaType: 'object',
      tagline: 'Inside the panel'
    },
    steps: [ 'one', 'two', 'three' ].map(name => ({
      _id: `step-${name}`,
      metaType: 'arrayItem',
      tagline: `Step ${name}`
    })),
    zone: {
      _id: 'zone1',
      metaType: 'area',
      items: [
        {
          _id: 'zone-text',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>Zone text</p>'
        },
        {
          _id: 'zone-card',
          metaType: 'widget',
          type: 'card',
          kind: 'one',
          note: 'A note'
        }
      ]
    },
    ownersIds: [ 'topic1' ]
  };
}

module.exports = {
  DEPTH,
  modules,
  buildDoc,
  buildProject,
  deepestRoute
};
