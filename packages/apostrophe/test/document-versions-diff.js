const assert = require('assert').strict;
const {
  t,
  bootstrap: bootstrapWith,
  getReq,
  destroy,
  addUser,
  login
} = require('./utils/document-versions.js');
const {
  modules,
  buildDoc,
  buildProject,
  deepestRoute
} = require('./utils/document-versions-diff.js');

const HIGHLIGHT = '@apostrophecms/schema:highlight';

describe('Document Versions diff engine', function () {
  this.timeout(t.timeout);

  let apos;
  let req;

  before(async function() {
    apos = await bootstrapWith({
      root: module,
      modules: {
        article: {},
        'default-page': {},
        'quote-widget': {
          extend: '@apostrophecms/rich-text-widget'
        },
        'plain-text-widget': {
          extend: '@apostrophecms/rich-text-widget',
          options: {
            renderVersions: false
          }
        },
        // Its template shows its title and the older version's
        'version-note-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            renderVersions: true
          },
          fields: {
            add: {
              title: {
                type: 'string',
                label: 'Title'
              }
            }
          }
        },
        'plain-note-widget': {
          extend: 'version-note-widget',
          options: {
            renderVersions: false
          }
        },
        ...modules
      }
    });
    req = getReq(apos);
  });

  after(async function() {
    await destroy(apos);
  });

  // The breadcrumb segments of the fixture's deepest route, plus `tail`
  function segmentsTo(route, ...tail) {
    return [ ...route.flatMap(hop => hop.segments), ...tail ];
  }

  describe('rows', function () {
    it('should have a fixture nested 16 segments deep with 150+ fields', function () {
      const route = deepestRoute(buildDoc());
      assert.equal(segmentsTo(route, { name: 'title' }).length, 16);
      let count = 0;
      const walk = schema => {
        for (const field of schema) {
          count++;
          if (field.schema) {
            walk(field.schema);
          }
          const widgets = field.options?.widgets || {};
          for (const type of Object.keys(widgets)) {
            walk(apos.area.getWidgetManager(type).schema);
          }
        }
      };
      walk(apos.nested.schema);
      assert.ok(count >= 150, `${count} fields`);
    });

    it('should return no rows for identical documents', function () {
      assert.deepEqual(apos.docVersions.getChangeRows(req, buildDoc(), buildDoc()), []);
    });

    it('should report a modified leaf at full depth as one row', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const route = deepestRoute(newer);
      const leaf = route.at(-1).node;
      leaf.count = 99;
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      const [ row ] = rows;
      assert.deepEqual(row, {
        path: segmentsTo(route, {
          name: 'count',
          label: 'Count'
        }),
        type: 'modified',
        fieldType: 'integer',
        kind: 'leaf',
        old: 9,
        new: 99
      });
      assert.equal(row.field.name, 'count');
      assert.equal(JSON.parse(JSON.stringify(row)).field, undefined);
    });

    it('should report each change type in the deepest containers as single rows', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const route = deepestRoute(newer);
      const leaf = route.at(-1).node;
      leaf.subtitle = 'Deep';
      leaf.count = 99;
      leaf.tags = [];
      // The deepest area loses its rich text widget, the deepest array
      // gains an item
      const area = route.at(-2).node.content;
      const [ richText ] = area.items.splice(1, 1);
      const array = route.at(-3).node.rows;
      array.push({
        ...structuredClone(array[1]),
        _id: 'deep-item',
        title: 'Deep item'
      });

      const rows = apos.docVersions.getChangeRows(req, older, newer);

      assert.deepEqual(rows.map(row => ({
        type: row.type,
        fieldType: row.fieldType,
        path: row.path
      })), [
        {
          type: 'added',
          fieldType: 'string',
          path: segmentsTo(route, {
            name: 'subtitle',
            label: 'Subtitle'
          })
        },
        {
          type: 'modified',
          fieldType: 'integer',
          path: segmentsTo(route, {
            name: 'count',
            label: 'Count'
          })
        },
        {
          type: 'deleted',
          fieldType: 'checkboxes',
          path: segmentsTo(route, {
            name: 'tags',
            label: 'Tags'
          })
        },
        {
          type: 'deleted',
          fieldType: 'widget',
          path: segmentsTo(route.slice(0, -1), {
            name: 'content',
            label: 'Content'
          }, {
            name: richText._id,
            label: 'apostrophe:richText',
            ordinal: 2,
            widgetType: '@apostrophecms/rich-text'
          })
        },
        {
          type: 'added',
          fieldType: 'arrayItem',
          path: segmentsTo(route.slice(0, -2), {
            name: 'rows',
            label: 'Rows'
          }, {
            name: 'deep-item',
            label: 'Deep item',
            ordinal: 3
          })
        }
      ]);
      assert.equal(rows[0].path.length, 16);
    });

    it('should report every changed leaf once, in schema order', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.title = 'Renamed';
      newer.section.flag = true;
      newer.section.rows[1].content.items[0].tint = '#00ff00';
      newer.section.rows[1].mail = 'other@example.com';
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => [
        row.type,
        row.path.map(segment => segment.name).join('.')
      ]), [
        [ 'modified', 'title' ],
        [ 'modified', 'section.flag' ],
        [ 'modified', 'section.rows.root.section.rows.1.mail' ],
        [ 'modified', 'section.rows.root.section.rows.1.content.root.section.rows.1.content.0.tint' ]
      ]);
    });

    it('should call a value appearing in an empty field added and one going deleted', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.subtitle = 'Now set';
      newer.section.link = '';
      newer.section.tags = [];
      newer.section.file = {
        _id: 'attachment2',
        name: 'brief',
        extension: 'docx'
      };
      older.section.body = '<p></p>';
      newer.section.body = '<p>Text</p>';
      older.section.flag = true;
      newer.section.flag = false;
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => [
        row.type,
        row.fieldType,
        row.path.at(-1).name
      ]), [
        [ 'added', 'string', 'subtitle' ],
        [ 'modified', 'boolean', 'flag' ],
        [ 'deleted', 'checkboxes', 'tags' ],
        [ 'deleted', 'url', 'link' ],
        [ 'added', 'richText', 'body' ],
        [ 'added', 'attachment', 'file' ]
      ]);
    });

    it('should compare with the field type\'s own isEqual when it has one', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.shout = 'HELLO';
      assert.deepEqual(apos.docVersions.getChangeRows(req, older, newer), []);
      newer.shout = 'Goodbye';
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].fieldType, 'shout');
      assert.equal(apos.schema.fieldTypes.shout.extend, 'string');
    });

    it('should fold null and undefined together', function () {
      const older = buildDoc();
      const newer = buildDoc();
      older.section.file = undefined;
      newer.section.file = null;
      delete older.section.rows[0].link;
      newer.section.rows[0].link = null;
      assert.deepEqual(apos.docVersions.getChangeRows(req, older, newer), []);
    });

    it('should report a relationship by its ids, in order', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.topicsIds = [ 'topic2', 'topic1' ];
      newer.topicsFields = {
        topic1: {
          relevance: 1
        },
        topic2: {
          relevance: 5
        }
      };
      newer.section.topicsIds = [];
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => [ row.type, row.fieldType, row.old, row.new ]), [
        [ 'modified', 'relationship', [ 'topic1' ], [ 'topic2', 'topic1' ] ],
        [ 'deleted', 'relationship', [ 'topic1' ], [] ]
      ]);
      assert.equal(rows[0].field.idsStorage, 'topicsIds');
    });

    it('should report a change in relationship fields only as modified', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.topicsFields.topic1.relevance = 2;
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].type, 'modified');
      assert.deepEqual(rows[0].old, rows[0].new);
    });

    it('should report a replaced array item as a deleted and an added row and nothing below', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const [ first, second ] = newer.section.rows;
      const third = {
        ...structuredClone(second),
        _id: 'root.section.rows.2',
        title: 'Third'
      };
      newer.section.rows = [ first, third ];
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => [
        row.type,
        row.fieldType,
        row.path.at(-1)
      ]), [
        [
          'deleted',
          'arrayItem',
          {
            name: 'root.section.rows.1',
            label: 'Title root.section.rows.1',
            ordinal: 2
          }
        ],
        [
          'added',
          'arrayItem',
          {
            name: 'root.section.rows.2',
            label: 'Third',
            ordinal: 2
          }
        ]
      ]);
      assert.equal(rows[0].new, undefined);
      assert.equal(rows[0].old._id, 'root.section.rows.1');
      assert.equal(rows[1].old, undefined);
      assert.equal(rows[1].new.title, 'Third');
    });

    it('should list a deleted item after the item that preceded it', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const area = newer.section.rows[0].content;
      const [ nested, richText, opaque ] = area.items;
      // The rich text widget goes, the others are edited
      area.items = [ nested, opaque ];
      nested.title = 'Edited';
      opaque.payload.n = 2;
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => [
        row.type,
        row.fieldType,
        row.path.at(-1).name
      ]), [
        [ 'modified', 'string', 'title' ],
        [ 'deleted', 'widget', richText._id ],
        [ 'modified', 'widget', opaque._id ]
      ]);
    });

    it('should report reordered items as one modified row at their array or area', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.section.rows.reverse();
      const area = newer.section.rows[1].content;
      const [ nested, richText, opaque ] = area.items;
      area.items = [ opaque, nested, richText ];
      nested.title = 'Edited';
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => [
        row.type,
        row.fieldType,
        row.path.map(segment => segment.label).join(' > ')
      ]), [
        [ 'modified', 'array', 'Section > Rows' ],
        [ 'modified', 'area', 'Section > Rows > Title root.section.rows.0 > Content' ],
        [ 'modified', 'string', 'Section > Rows > Title root.section.rows.0 > Content > Nested 2 > Title' ]
      ]);
      assert.deepEqual(
        [ rows[0].old, rows[0].new ],
        [
          [ 'root.section.rows.0', 'root.section.rows.1' ],
          [ 'root.section.rows.1', 'root.section.rows.0' ]
        ]
      );
      assert.deepEqual(
        [ rows[1].old, rows[1].new ],
        [
          [ nested._id, richText._id, opaque._id ],
          [ opaque._id, nested._id, richText._id ]
        ]
      );
      assert.equal(rows[0].field.name, 'rows');
      assert.equal(rows[1].field.name, 'content');
      assert.deepEqual(
        Object.keys(rows[0]),
        [ 'path', 'type', 'fieldType', 'kind', 'old', 'new' ]
      );
      assert.equal(apos.docVersions.getChangeCount(req, newer, older), 3);
    });

    it('should not call an item added or deleted in the middle a reorder', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const area = newer.section.rows[0].content;
      const [ nested, richText, opaque ] = area.items;
      const added = {
        ...structuredClone(richText),
        _id: 'root.section.rows.0.content.3'
      };
      area.items = [ nested, added, opaque ];
      newer.section.rows.splice(1, 0, {
        ...structuredClone(newer.section.rows[1]),
        _id: 'root.section.rows.2'
      });
      const brief = row => [ row.type, row.fieldType, row.path.at(-1).name ];
      assert.deepEqual(apos.docVersions.getChangeRows(req, older, newer).map(brief), [
        [ 'deleted', 'widget', richText._id ],
        [ 'added', 'widget', added._id ],
        [ 'added', 'arrayItem', 'root.section.rows.2' ]
      ]);

      // The same, and the items both sides have change places
      area.items = [ opaque, added, nested ];
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(brief), [
        [ 'modified', 'area', 'content' ],
        [ 'added', 'widget', added._id ],
        [ 'deleted', 'widget', richText._id ],
        [ 'added', 'arrayItem', 'root.section.rows.2' ]
      ]);
      assert.deepEqual(rows[0].old, [ nested._id, opaque._id ]);
      assert.deepEqual(rows[0].new, [ opaque._id, nested._id ]);
    });

    it('should report an added or deleted widget as one row with its type label', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const area = newer.section.rows[0].content;
      const added = {
        ...structuredClone(area.items[0]),
        _id: 'root.section.rows.0.content.3',
        title: 'Another'
      };
      area.items = [ added, area.items[1], area.items[2] ];
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => [ row.type, row.fieldType, row.path.at(-1) ]), [
        [
          'deleted',
          'widget',
          {
            name: 'root.section.rows.0.content.0',
            label: 'Nested 2',
            ordinal: 1,
            widgetType: 'nested-2'
          }
        ],
        [
          'added',
          'widget',
          {
            name: 'root.section.rows.0.content.3',
            label: 'Nested 2',
            ordinal: 1,
            widgetType: 'nested-2'
          }
        ]
      ]);
      assert.equal(rows[0].old._id, 'root.section.rows.0.content.0');
      assert.equal(rows[1].new.title, 'Another');
    });

    it('should report a rich text widget\'s content as a richText row at the widget', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const widget = newer.section.rows[0].content.items[1];
      widget.content = '<p>Rich, edited</p>';
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0], {
        path: [
          {
            name: 'section',
            label: 'Section'
          },
          {
            name: 'rows',
            label: 'Rows'
          },
          {
            name: 'root.section.rows.0',
            label: 'Title root.section.rows.0',
            ordinal: 1
          },
          {
            name: 'content',
            label: 'Content'
          },
          {
            name: widget._id,
            label: 'apostrophe:richText',
            ordinal: 2,
            widgetType: '@apostrophecms/rich-text'
          }
        ],
        type: 'modified',
        fieldType: 'richText',
        kind: 'richText',
        old: '<p>Rich root.section.rows.0</p>',
        new: '<p>Rich, edited</p>'
      });
    });

    it('should follow a rich text widget\'s derived id lists without a second row', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const olderWidget = older.section.rows[0].content.items[1];
      const widget = newer.section.rows[0].content.items[1];
      olderWidget.permalinkIds = [];
      olderWidget.imageIds = [];
      widget.content = '<p>Rich <a href="#apostrophe-permalink-page1?updateTitle=1">link</a></p>';
      widget.permalinkIds = [ 'page1' ];
      widget.imageIds = [];
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].fieldType, 'richText');
      widget.content = olderWidget.content;
      assert.deepEqual(apos.docVersions.getChangeRows(req, older, newer), []);
    });

    it('should report data a widget stores outside its schema as one widget row', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const widget = newer.section.rows[0].content.items[2];
      widget.payload = {
        n: 1,
        extra: true
      };
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].type, 'modified');
      assert.equal(rows[0].fieldType, 'widget');
      assert.equal(rows[0].path.at(-1).label, 'Opaque');
      assert.equal(rows[0].old.payload.extra, undefined);
      assert.equal(rows[0].new.payload.extra, true);
    });

    it('should ignore widget bookkeeping and joined data', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const widget = newer.section.rows[0].content.items[0];
      widget._edit = true;
      widget._docId = 'nested1:en:draft';
      widget.aposPlaceholder = false;
      widget._topics = [ { _id: 'topic1' } ];
      assert.deepEqual(apos.docVersions.getChangeRows(req, older, newer), []);
    });

    it('should compare a widget of an unknown type as a whole', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const olderWidget = older.section.rows[0].content.items[2];
      const widget = newer.section.rows[0].content.items[2];
      olderWidget.type = 'gone';
      widget.type = 'gone';
      assert.deepEqual(apos.docVersions.getChangeRows(req, older, newer), []);
      widget.payload.n = 3;
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].fieldType, 'widget');
      assert.equal(rows[0].path.at(-1).label, 'gone');
    });

    it('should report an object that appears or goes as one row', function () {
      const older = buildDoc();
      const newer = buildDoc();
      delete older.section.rows[1].content.items[0].section;
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].type, 'added');
      assert.equal(rows[0].fieldType, 'object');
      assert.equal(rows[0].old, undefined);
      assert.equal(rows[0].new.title, 'Title root.section.rows.1.content.0.section');
      assert.deepEqual(
        apos.docVersions.getChangeRows(req, newer, older).map(row => row.type),
        [ 'deleted' ]
      );
    });

    it('should match array items without an _id by position', function () {
      const older = buildDoc();
      const newer = buildDoc();
      for (const doc of [ older, newer ]) {
        doc.section.rows.forEach(item => delete item._id);
      }
      newer.section.rows[1].title = 'Second, edited';
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0].path.slice(1, 3), [
        {
          name: 'rows',
          label: 'Rows'
        },
        {
          name: undefined,
          label: 'Second, edited',
          ordinal: 2
        }
      ]);
    });

    it('should never call items without an _id reordered', function () {
      const older = buildDoc();
      const newer = buildDoc();
      for (const item of [ ...older.section.rows, ...newer.section.rows ]) {
        delete item._id;
        delete item.content;
      }
      newer.section.rows.reverse();
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.ok(rows.length);
      assert.ok(rows.every(row => row.fieldType !== 'array'));
    });

    it('should not mutate its inputs', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.section.rows.pop();
      newer.section.rows[0].content.items[0].title = 'Edited';
      const olderBefore = structuredClone(older);
      const newerBefore = structuredClone(newer);
      apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(older, olderBefore);
      assert.deepEqual(newer, newerBefore);
    });
  });

  // Field types of a project's own, each extending a core type: a row keeps
  // the declared type and says what it is in `kind`
  describe('project field types', function () {
    const brief = row => [
      row.type,
      row.fieldType,
      row.kind,
      row.path.map(segment => segment.label).join(' > ')
    ];

    it('should walk each as the core type it extends', function () {
      const older = buildProject();
      const newer = buildProject();
      newer.tagline = 'Built to change';
      newer.rating = 3;
      newer.prose = '<p>The quick red fox</p>';
      newer.panel.tagline = 'Inside';
      newer.steps.reverse();
      newer.steps[0].tagline = 'Step 3';
      newer.steps.push({
        _id: 'step-four',
        metaType: 'arrayItem',
        tagline: 'Step four'
      });
      newer.zone.items.reverse();
      newer.zone.items[0].note = 'Another note';
      newer.ownersIds = [ 'topic2' ];
      assert.deepEqual(apos.docVersions.getChangeRows(req, older, newer).map(brief), [
        [ 'modified', 'tagline', 'leaf', 'Tagline' ],
        [ 'added', 'rating', 'leaf', 'Rating' ],
        [ 'modified', 'prose', 'richText', 'Prose' ],
        [ 'modified', 'tagline', 'leaf', 'Panel > Panel tagline' ],
        [ 'modified', 'steps', 'array', 'Steps' ],
        [ 'modified', 'tagline', 'leaf', 'Steps > Step 3 > Step tagline' ],
        [ 'added', 'arrayItem', 'arrayItem', 'Steps > Step four' ],
        [ 'modified', 'zone', 'area', 'Zone' ],
        [ 'modified', 'string', 'leaf', 'Zone > Card > Note' ],
        [ 'modified', 'owners', 'relationship', 'Owners' ]
      ]);
    });

    it('should report an object of such a type that appears or goes as one row', function () {
      const older = buildProject();
      const newer = buildProject();
      delete older.panel;
      assert.deepEqual(
        apos.docVersions.getChangeRows(req, older, newer).map(brief),
        [ [ 'added', 'panel', 'object', 'Panel' ] ]
      );
    });

    it('should call a value empty as the type itself does', function () {
      const older = buildProject();
      const newer = buildProject();
      older.rating = 4;
      assert.deepEqual(
        apos.docVersions.getChangeRows(req, older, newer).map(brief),
        [ [ 'deleted', 'rating', 'leaf', 'Rating' ] ]
      );
    });

    it('should read each as the core type it extends', async function () {
      const text = require('../modules/@apostrophecms/document-versions/lib/text.js');
      const one = await apos.modules.topic.insert(req, { title: 'Topic one' });
      const two = await apos.modules.topic.insert(req, { title: 'Topic two' });
      const older = buildProject();
      const newer = buildProject();
      older.ownersIds = [ one.aposDocId ];
      newer.tagline = 'Built to change';
      newer.rating = 3;
      newer.prose = '<p>The <strong>quick</strong> red fox</p>';
      newer.steps.reverse();
      newer.zone.items.reverse();
      newer.ownersIds = [ two.aposDocId ];
      const rows = text.addFormat(
        apos.docVersions.getChangeRows(req, older, newer),
        apos.docVersions.getDiffContext(req)
      );
      await apos.docVersions.addChangeText(req, rows);
      assert.deepEqual(rows.map(row => [ row.fieldType, row.oldText, row.newText ]), [
        [ 'tagline', 'Built to last', 'Built to change' ],
        [ 'rating', '0', '3' ],
        [ 'prose', 'The quick brown fox', 'The quick red fox' ],
        [
          'steps',
          '#3 Step one, #2 Step two, #1 Step three',
          '#1 Step three, #2 Step two, #3 Step one'
        ],
        [
          'zone',
          '#2 Rich Text, #1 Card · One',
          '#1 Card · One, #2 Rich Text'
        ],
        [ 'owners', 'Topic one', 'Topic two' ]
      ]);
      assert.deepEqual(
        rows[2].formatChanges.map(line => [ line.change, line.text ]),
        [ [ 'marksAdded', 'quick' ] ]
      );
    });

    it('should mark the annotated document as for the core types', function () {
      const older = buildProject();
      const newer = buildProject();
      newer.prose = '<p>The quick red fox</p>';
      newer.steps.reverse();
      newer.zone.items.reverse();
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.match(doc.prose, /<del [^>]+>.*brown<\/del><ins [^>]+>.*red<\/ins>/);
      assert.deepEqual(
        doc.zone.items.map(widget => [ widget._id, Boolean(widget._moved) ]),
        [ [ 'zone-card', false ], [ 'zone-text', true ] ]
      );
      assert.deepEqual(
        [ 'prose', 'steps', 'zone' ].map(name => Boolean(doc.aposMeta?.[name]?.[HIGHLIGHT])),
        [ true, true, false ]
      );
    });

    it('should keep their order apart from their items across versions', function () {
      const first = buildProject();
      const second = buildProject();
      second.steps.reverse();
      second.zone.items.reverse();
      const third = structuredClone(second);
      third.steps[0].tagline = 'Step 3';
      third.zone.items[0].note = 'Another note';
      const rows = apos.docVersions.getConsolidatedRows(req, [
        {
          older: first,
          newer: second,
          ai: true
        },
        {
          older: second,
          newer: third,
          ai: false
        }
      ]);
      assert.deepEqual(rows.map(row => [ row.fieldType, row.kind, row.ai ]), [
        [ 'steps', 'array', true ],
        [ 'tagline', 'leaf', false ],
        [ 'zone', 'area', true ],
        [ 'string', 'leaf', false ]
      ]);
    });

    it('should skip the fields that store nothing, through `extend` as well', function () {
      const diff = require('../modules/@apostrophecms/document-versions/lib/diff.js');
      const types = {
        heading: { extend: 'group' }
      };
      const ctx = {
        ...apos.docVersions.getDiffContext(req),
        getFieldType: name => types[name]
      };
      const schema = [
        {
          name: 'basics',
          type: 'group'
        },
        {
          name: 'extras',
          type: 'heading'
        },
        {
          name: '_pages',
          type: 'relationshipReverse'
        },
        {
          name: 'title',
          type: 'string'
        }
      ];
      const rows = diff.walk(schema, {
        basics: 1,
        extras: 1,
        _pages: 1,
        title: 'One'
      }, {
        basics: 2,
        extras: 2,
        _pages: 2,
        title: 'Two'
      }, ctx);
      assert.deepEqual(rows.map(brief), [ [ 'modified', 'string', 'leaf', 'title' ] ]);
    });

    it('should take a type whose `extend` chain loops for a plain value', function () {
      const diff = require('../modules/@apostrophecms/document-versions/lib/diff.js');
      const text = require('../modules/@apostrophecms/document-versions/lib/text.js');
      const types = {
        chicken: { extend: 'egg' },
        egg: { extend: 'chicken' }
      };
      const ctx = {
        ...apos.docVersions.getDiffContext(req),
        getFieldType: name => types[name]
      };
      const field = {
        name: 'which',
        type: 'chicken'
      };
      const rows = diff.walk([ field ], { which: 'first' }, { which: 'second' }, ctx);
      assert.deepEqual(rows.map(brief), [ [ 'modified', 'chicken', 'leaf', 'which' ] ]);
      assert.equal(text.toText(field, 'first', ctx), '');
    });
  });

  describe('text', function () {
    const text = require('../modules/@apostrophecms/document-versions/lib/text.js');

    // `[ last path segment name, oldText, newText ]` of every row
    async function texts(older, newer) {
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      await apos.docVersions.addChangeText(req, rows);
      return rows.map(row => [ row.path.at(-1).name, row.oldText, row.newText ]);
    }

    it('should read scalar values, and a type extending string, as their value', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      const leaf = deepestRoute(newer).at(-1).node;
      Object.assign(leaf, {
        subtitle: 'Sub',
        shout: 'Bye',
        count: 12,
        ratio: 1.25,
        flag: true,
        choice: 'two',
        tags: [ 'one', 'two' ],
        when: '2026-02-02',
        at: '11:30:00',
        link: 'https://example.org/',
        mail: 'other@example.com',
        tint: '#00ff00'
      });
      assert.deepEqual(await texts(older, newer), [
        [ 'subtitle', '', 'Sub' ],
        [ 'shout', 'Hello', 'Bye' ],
        [ 'count', '9', '12' ],
        [ 'ratio', '0.5', '1.25' ],
        [ 'flag', 'false', 'true' ],
        [ 'choice', 'One', 'Two' ],
        [ 'tags', 'One', 'One, Two' ],
        [ 'when', '2026-01-01', '2026-02-02' ],
        [ 'at', '10:00:00', '11:30:00' ],
        [ 'link', 'https://example.com/', 'https://example.org/' ],
        [ 'mail', 'someone@example.com', 'other@example.com' ],
        [ 'tint', '#ff0000', '#00ff00' ]
      ]);
    });

    it('should read rich text as plaintext with one line break per block run', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.body = '<h2>Head</h2>\n<p>One &amp; <strong>two</strong></p><ul><li><p>a</p></li><li>b</li></ul>';
      newer.section.rows[0].content.items[1].content = '<p>Rich<br />edited</p><p></p>';
      assert.deepEqual(await texts(older, newer), [
        [ 'body', 'Body root', 'Head\nOne & two\na\nb' ],
        [ 'root.section.rows.0.content.1', 'Rich root.section.rows.0', 'Rich\nedited' ]
      ]);
    });

    it('should read an attachment as its name and extension', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.file = {
        _id: 'attachment2',
        name: 'brief',
        extension: 'docx'
      };
      newer.section.file = older.file;
      assert.deepEqual(await texts(older, newer), [
        [ 'file', 'report.pdf', 'brief.docx' ],
        [ 'file', '', 'report.pdf' ]
      ]);
    });

    it('should read a relationship as related titles in id order, in one query', async function () {
      const alpha = await apos.modules.topic.insert(req, { title: 'Alpha' });
      const beta = await apos.modules.topic.insert(req, { title: 'Beta' });
      const older = buildDoc();
      const newer = buildDoc();
      older.topicsIds = [ alpha.aposDocId ];
      newer.topicsIds = [ beta.aposDocId, 'missing', alpha.aposDocId ];
      older.section.topicsIds = [ beta.aposDocId ];
      newer.section.topicsIds = [];
      const find = apos.doc.find;
      let queries = 0;
      apos.doc.find = (...args) => {
        queries++;
        return find(...args);
      };
      try {
        assert.deepEqual(await texts(older, newer), [
          [ '_topics', 'Alpha', 'Beta, Alpha' ],
          [ '_topics', 'Beta', '' ]
        ]);
      } finally {
        apos.doc.find = find;
      }
      assert.equal(queries, 1);
    });

    it('should read a value with no safe string form as empty', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      delete older.section.rows[1].content.items[0].section;
      assert.deepEqual(await texts(older, newer), [
        [ 'section', '', '' ]
      ]);
      const ctx = apos.docVersions.getDiffContext(req);
      assert.equal(text.toText({ type: 'password' }, 'secret', ctx), '');
      assert.equal(text.toText({ type: 'string' }, { not: 'a string' }, ctx), '');
      assert.equal(text.toText({ type: 'integer' }, null, ctx), '');
    });

    it('should read a choice as its label, a number with its unit, a box by its sides, an embed as its URL', function () {
      const ctx = apos.docVersions.getDiffContext(req);
      assert.equal(text.toText({ type: 'oembed' }, {
        url: 'https://vimeo.com/1',
        title: 'A video'
      }, ctx), 'https://vimeo.com/1');
      assert.equal(text.toText({ type: 'oembed' }, {
        url: null,
        title: ''
      }, ctx), '');
      const alignment = {
        type: 'select',
        choices: [
          {
            label: 'apostrophe:styleCenter',
            value: 'apos-center'
          }
        ]
      };
      assert.equal(text.toText(alignment, 'apos-center', ctx), 'Center');
      assert.equal(text.toText(alignment, 'gone', ctx), 'gone');
      // Choices a method provides are not known here
      assert.equal(text.toText({
        type: 'select',
        choices: 'getChoices'
      }, 'stored', ctx), 'stored');
      const width = {
        type: 'range',
        unit: '%'
      };
      assert.equal(text.toText(width, 50, ctx), '50%');
      assert.equal(text.toText({ type: 'range' }, 50, ctx), '50');
      const padding = {
        type: 'box',
        unit: 'px'
      };
      assert.equal(text.toText(padding, {
        top: 10,
        right: null,
        bottom: 0,
        left: 20
      }, ctx), 'Top 10px, Bottom 0px, Left 20px');
      assert.equal(text.toText(padding, {
        top: null,
        right: null,
        bottom: null,
        left: null
      }, ctx), '');
      assert.equal(text.toText({ type: 'box' }, { top: 1 }, {
        ...ctx,
        t: undefined
      }), 'top 1');
    });

    it('should read the style presets of a widget, each under its own label', async function () {
      const build = styles => {
        const doc = buildDoc();
        doc.section.rows[0].content.items.push({
          _id: 'styled',
          metaType: 'widget',
          type: 'styled',
          ...styles
        });
        return doc;
      };
      const border = {
        _id: 'border',
        metaType: 'object',
        active: false,
        width: {
          top: 1,
          right: 1,
          bottom: 1,
          left: 1
        },
        radius: 0,
        color: 'black',
        style: 'solid'
      };
      const rows = apos.docVersions.getChangeRows(req, build({
        width: 100,
        alignment: null,
        padding: {
          top: null,
          right: null,
          bottom: null,
          left: null
        },
        border
      }), build({
        width: 50,
        alignment: 'apos-center',
        padding: {
          top: 10,
          right: null,
          bottom: 10,
          left: null
        },
        border: {
          ...border,
          active: true,
          width: {
            ...border.width,
            top: 4
          },
          radius: 8,
          style: 'dashed'
        }
      }));
      await apos.docVersions.addChangeText(req, rows);
      assert.deepEqual(rows.map(row => [
        row.type,
        row.path.slice(-2).map(segment => segment.label).join(' > '),
        row.oldText,
        row.newText
      ]), [
        [ 'modified', 'Styled > apostrophe:styleWidth', '100%', '50%' ],
        [ 'added', 'Styled > apostrophe:styleAlignment', '', 'Center' ],
        [ 'modified', 'Styled > apostrophe:stylePadding', '', 'Top 10px, Bottom 10px' ],
        [ 'modified', 'apostrophe:styleBorder > apostrophe:styleBorder', 'false', 'true' ],
        [
          'modified',
          'apostrophe:styleBorder > apostrophe:styleBorderWidth',
          'Top 1px, Right 1px, Bottom 1px, Left 1px',
          'Top 4px, Right 1px, Bottom 1px, Left 1px'
        ],
        [ 'modified', 'apostrophe:styleBorder > apostrophe:styleRadius', '0px', '8px' ],
        [ 'modified', 'apostrophe:styleBorder > apostrophe:styleStyle', 'Solid', 'Dashed' ]
      ]);
    });

    it('should read the presets of the global styles document the same way', async function () {
      const older = await apos.doc.find(req, { type: '@apostrophecms/styles' }).toObject();
      const newer = structuredClone(older);
      newer.bodyPadding = {
        top: 8,
        right: 16,
        bottom: 8,
        left: 16
      };
      newer.bodyBorder = {
        ...older.bodyBorder,
        active: true,
        style: 'dotted'
      };
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      await apos.docVersions.addChangeText(req, rows);
      assert.deepEqual(rows.map(row => [
        row.path.map(segment => segment.label).join(' > '),
        row.oldText,
        row.newText
      ]), [
        [ 'Body padding', '', 'Top 8px, Right 16px, Bottom 8px, Left 16px' ],
        [ 'apostrophe:styleBorder > apostrophe:styleBorder', 'false', 'true' ],
        [ 'apostrophe:styleBorder > apostrophe:styleStyle', 'Solid', 'Dotted' ]
      ]);
    });

    it('should read an added or deleted array item as its title', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.section.rows.pop();
      assert.deepEqual(await texts(older, newer), [
        [ 'root.section.rows.1', 'Title root.section.rows.1', '' ]
      ]);
    });

    it('should label an array item by its ordinal when its title is empty', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      older.section.rows[1].title = '';
      newer.section.rows[1].title = '';
      newer.section.rows[1].count = 5;
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows[0].path[2], {
        name: 'root.section.rows.1',
        label: '#2',
        ordinal: 2
      });
    });

    it('should read a change of order as the items in order, numbered as in the newer document', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      older.section.rows[1].title = '';
      newer.section.rows[1].title = '';
      newer.section.rows.reverse();
      const area = newer.section.rows[1].content;
      const [ nested, richText, opaque ] = area.items;
      const twin = {
        ...structuredClone(richText),
        _id: 'root.section.rows.0.content.3'
      };
      older.section.rows[0].content.items.push(structuredClone(twin));
      area.items = [ twin, opaque, richText, nested ];
      assert.deepEqual(await texts(older, newer), [
        [
          'rows',
          '#2 Title root.section.rows.0, #1',
          '#1, #2 Title root.section.rows.0'
        ],
        [
          'content',
          '#4 Nested 2, #3 Rich Text, #2 Opaque, #1 Rich Text',
          '#1 Rich Text, #2 Opaque, #3 Rich Text, #4 Nested 2'
        ]
      ]);
    });

    it('should give a widget of a change of order its title', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      const cards = [ 'one', 'two' ].map(kind => ({
        _id: `card-${kind}`,
        metaType: 'widget',
        type: 'card',
        kind
      }));
      older.section.rows[0].content.items.push(...structuredClone(cards));
      newer.section.rows[0].content.items.push(...structuredClone(cards).reverse());
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      await apos.docVersions.addChangeText(req, rows);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].newText, '#1 Nested 2, #2 Rich Text, #3 Opaque, #4 Card · Two, #5 Card · One');
      // An item that moved is marked whole, where it was and where it is
      const [ { diff } ] = text.addWordDiff(rows, apos.docVersions.getDiffContext(req));
      const side = change => diff
        .filter(part => [ 'same', change ].includes(part.change))
        .map(part => part.text)
        .join(', ');
      assert.equal(side('removed'), rows[0].oldText);
      assert.equal(side('added'), rows[0].newText);
      assert.deepEqual(diff.map(part => [ part.change, part.text ]), [
        [ 'same', '#1 Nested 2' ],
        [ 'same', '#2 Rich Text' ],
        [ 'same', '#3 Opaque' ],
        [ 'removed', '#5 Card · One' ],
        [ 'same', '#4 Card · Two' ],
        [ 'added', '#5 Card · One' ]
      ]);
    });

    it('should read an added widget as its title, its rich text, or nothing', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      const area = newer.section.rows[0].content;
      area.items.push(
        {
          _id: 'card1',
          metaType: 'widget',
          type: 'card',
          kind: 'two',
          note: 'Hi'
        },
        {
          _id: 'rich1',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>New <em>words</em></p>'
        },
        {
          _id: 'opaque1',
          metaType: 'widget',
          type: 'opaque',
          payload: {}
        }
      );
      assert.deepEqual(await texts(older, newer), [
        [ 'card1', '', 'Two' ],
        [ 'rich1', '', 'New words' ],
        [ 'opaque1', '', '' ]
      ]);
    });

    it('should give a widget with a titleField option a title in its path', async function () {
      const card = {
        _id: 'card1',
        metaType: 'widget',
        type: 'card',
        kind: 'one',
        note: 'Hi'
      };
      const older = buildDoc();
      older.section.rows[0].content.items.push(card);
      const newer = buildDoc();
      newer.section.rows[0].content.items.push({
        ...card,
        note: 'Hello'
      });
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      assert.deepEqual(rows.map(row => row.path.slice(-2)), [
        [
          {
            name: 'card1',
            label: 'Card',
            title: 'One',
            ordinal: 4,
            widgetType: 'card'
          },
          {
            name: 'note',
            label: 'Note'
          }
        ]
      ]);
      newer.section.rows[0].content.items[3].kind = null;
      const untitled = apos.docVersions.getChangeRows(req, older, newer);
      assert.equal(untitled.length, 2);
      assert.ok(untitled.every(row => !('title' in row.path.at(-2))));
    });

    it('should read a titleField through object fields', function () {
      const ctx = apos.docVersions.getDiffContext(req);
      const field = {
        type: 'array',
        titleField: 'meta.name',
        schema: [
          {
            type: 'object',
            name: 'meta',
            schema: [
              {
                type: 'string',
                name: 'name'
              }
            ]
          }
        ]
      };
      assert.equal(text.getItemText(field, { meta: { name: 'Deep' } }, ctx), 'Deep');
      assert.equal(text.getItemText(field, { meta: {} }, ctx), '');
      assert.equal(text.getItemText({ schema: [] }, { title: 'Stray' }, ctx), '');
    });

    it('should compare the text of each row word by word', function () {
      const rows = text.addWordDiff([
        {
          oldText: 'The quick brown fox',
          newText: 'The slow brown fox jumps'
        },
        {
          oldText: '',
          newText: 'Added'
        },
        {
          oldText: 'Gone',
          newText: ''
        },
        {
          oldText: '',
          newText: ''
        },
        {
          oldText: 'Same',
          newText: 'Same'
        }
      ]);
      assert.deepEqual(rows.map(row => row.diff), [
        [
          {
            text: 'The ',
            change: 'same'
          },
          {
            text: 'quick',
            change: 'removed'
          },
          {
            text: 'slow',
            change: 'added'
          },
          {
            text: ' brown fox ',
            change: 'same'
          },
          {
            text: 'jumps',
            change: 'added'
          }
        ],
        [
          {
            text: 'Added',
            change: 'added'
          }
        ],
        [
          {
            text: 'Gone',
            change: 'removed'
          }
        ],
        [],
        [
          {
            text: 'Same',
            change: 'same'
          }
        ]
      ]);
    });

    it('should leave rows without text serializable as before, plus the text', async function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.title = 'Renamed';
      const rows = apos.docVersions.getChangeRows(req, older, newer);
      await apos.docVersions.addChangeText(req, rows);
      assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(rows[0]))), [
        'path',
        'type',
        'fieldType',
        'kind',
        'old',
        'new',
        'oldText',
        'newText'
      ]);
    });

    describe('format changes', function () {
      const src = id => `/api/v1/@apostrophecms/image/${id}/src`;

      it('should show every kind of formatting change as a line of values', async function () {
        const value = text => ({ text });
        const cases = [
          [
            '<p>Read <a href="/one">the guide</a></p>',
            '<p>Read <a href="/two">the guide</a></p>',
            [ {
              change: 'link',
              type: 'modified',
              label: 'Link',
              text: 'the guide',
              old: value('/one'),
              new: value('/two')
            } ]
          ],
          [
            '<p>Read <a href="/one">the guide</a></p>',
            '<p>Read <a href="/one" target="_blank">the guide</a></p>',
            [ {
              change: 'link',
              type: 'modified',
              label: 'Link target',
              text: 'the guide',
              old: value('Same tab'),
              new: value('New tab')
            } ]
          ],
          [
            '<p>Read <a href="/one" target="_blank">the guide</a></p>',
            '<p>Read <a href="/two">the guide</a></p>',
            [
              {
                change: 'link',
                type: 'modified',
                label: 'Link',
                text: 'the guide',
                old: value('/one'),
                new: value('/two')
              },
              {
                change: 'link',
                type: 'modified',
                label: 'Link target',
                text: 'the guide',
                old: value('New tab'),
                new: value('Same tab')
              }
            ]
          ],
          [
            '<p>Read <a href="/one">the guide</a></p>',
            '<p>Read <a href="/one" title="Guide">the guide</a></p>',
            [ {
              change: 'link',
              type: 'modified',
              label: 'Link settings',
              text: 'the guide'
            } ]
          ],
          [
            '<p>Read the guide</p>',
            '<p>Read <a href="/one">the guide</a></p>',
            [ {
              change: 'linkAdded',
              type: 'added',
              label: 'Link',
              text: 'the guide',
              new: value('/one')
            } ]
          ],
          [
            '<p>Read <a href="/one">the guide</a></p>',
            '<p>Read the guide</p>',
            [ {
              change: 'linkRemoved',
              type: 'deleted',
              label: 'Link',
              text: 'the guide',
              old: value('/one')
            } ]
          ],
          [
            '<p>Read the guide</p>',
            '<p>Read <strong><em>the guide</em></strong></p>',
            [ {
              change: 'marksAdded',
              type: 'added',
              label: 'Formatting',
              text: 'the guide',
              new: value('Bold, Italic')
            } ]
          ],
          [
            '<p>Read <sup>the guide</sup></p>',
            '<p>Read the guide</p>',
            [ {
              change: 'marksRemoved',
              type: 'deleted',
              label: 'Formatting',
              text: 'the guide',
              old: value('Superscript')
            } ]
          ],
          [
            '<p>Read <span style="color: #ff0000">the guide</span></p>',
            '<p>Read <span style="color: #0000ff">the guide</span></p>',
            [ {
              change: 'mark',
              type: 'modified',
              label: 'Color',
              text: 'the guide',
              old: value('#ff0000'),
              new: value('#0000ff')
            } ]
          ],
          [
            '<p>Read <span class="small">the guide</span></p>',
            '<p>Read <span class="large">the guide</span></p>',
            [ {
              change: 'mark',
              type: 'modified',
              label: 'Inline Style',
              text: 'the guide',
              old: value('Inline Style (small)'),
              new: value('Inline Style (large)')
            } ]
          ],
          [
            '<p><span id="top">Title</span></p>',
            '<p><span id="start">Title</span></p>',
            [ {
              change: 'anchor',
              type: 'modified',
              label: 'Anchor',
              text: 'Title',
              old: value('top'),
              new: value('start')
            } ]
          ],
          [
            '<p>Title</p>',
            '<p><span id="top">Title</span></p>',
            [ {
              change: 'anchor',
              type: 'added',
              label: 'Anchor',
              text: 'Title',
              new: value('top')
            } ]
          ],
          [
            '<p><span id="top">Title</span></p>',
            '<p>Title</p>',
            [ {
              change: 'anchor',
              type: 'deleted',
              label: 'Anchor',
              text: 'Title',
              old: value('top')
            } ]
          ],
          [
            '<p>Our mission</p>',
            '<h2>Our mission</h2>',
            [ {
              change: 'block',
              type: 'modified',
              label: 'Block style',
              text: 'Our mission',
              old: value('Paragraph (P)'),
              new: value('Heading 2 (H2)')
            } ]
          ],
          [
            '<ul><li><p>One</p></li><li><p>Two</p></li></ul>',
            '<ol><li><p>One</p></li><li><p>Two</p></li></ol>',
            [ {
              change: 'block',
              type: 'modified',
              label: 'Block style',
              text: 'One Two',
              old: value('Bulleted List'),
              new: value('Ordered List')
            } ]
          ],
          [
            '<p>Our mission</p>',
            '<p class="lead">Our mission</p>',
            [ {
              change: 'style',
              type: 'modified',
              label: 'Block style',
              text: 'Our mission',
              old: value('Paragraph (P)'),
              new: value('Paragraph (P) (lead)')
            } ]
          ],
          [
            '<p>Our mission</p>',
            '<p style="text-align: center">Our mission</p>',
            [ {
              change: 'align',
              type: 'modified',
              label: 'Alignment',
              text: 'Our mission',
              old: value('Default'),
              new: value('Align Center')
            } ]
          ],
          [
            '<p>One.</p><p>Two.</p>',
            '<p>One. Two.</p>',
            [ {
              change: 'merged',
              type: 'modified',
              label: 'Paragraphs merged',
              text: 'Two.'
            } ]
          ],
          [
            '<p>One. Two.</p>',
            '<p>One.</p><p>Two.</p>',
            [ {
              change: 'split',
              type: 'modified',
              label: 'Paragraph split',
              text: 'Two.'
            } ]
          ],
          [
            `<p>One</p><figure><img src="${src('gone')}" alt="A fox"></figure>`,
            '<p>One</p>',
            [ {
              change: 'imageRemoved',
              type: 'deleted',
              label: 'Image',
              old: value('A fox')
            } ]
          ],
          [
            `<p>One</p><figure><img src="${src('gone')}" alt="A fox"></figure>`,
            `<p>One</p><figure><img src="${src('gone')}" alt="A red fox"></figure>`,
            [ {
              change: 'image',
              type: 'modified',
              label: 'Image alt text',
              text: 'A red fox',
              old: value('A fox'),
              new: value('A red fox')
            } ]
          ],
          [
            `<p>One</p><figure class="left"><img src="${src('gone')}" alt=""></figure>`,
            `<p>One</p><figure class="right"><img src="${src('gone')}" alt="A red fox"></figure>`,
            [
              {
                change: 'image',
                type: 'added',
                label: 'Image alt text',
                text: 'A red fox',
                new: value('A red fox')
              },
              {
                change: 'image',
                type: 'modified',
                label: 'Image style',
                text: 'A red fox',
                old: value('left'),
                new: value('right')
              }
            ]
          ],
          [
            '<p>One</p><p>Two</p>',
            '<p>One</p><hr><p>Two</p>',
            [ {
              change: 'rules',
              type: 'added',
              label: 'Horizontal rules',
              new: value('1 added')
            } ]
          ],
          [
            '<p>One</p><hr><p>Two</p><p>Three<br>four</p>',
            '<p>One</p><p>Two</p><hr><p>Three four</p><hr>',
            [
              {
                change: 'rules',
                type: 'modified',
                label: 'Horizontal rules',
                old: value('1 removed'),
                new: value('2 added')
              },
              {
                change: 'breaks',
                type: 'deleted',
                label: 'Line breaks',
                old: value('1 removed')
              }
            ]
          ],
          [
            '<p>One two</p>',
            '<p>One<br>two</p>',
            [ {
              change: 'breaks',
              type: 'added',
              label: 'Line breaks',
              new: value('1 added')
            } ]
          ],
          [
            '<p>One<br>two</p>',
            '<p>One two</p>',
            [ {
              change: 'breaks',
              type: 'deleted',
              label: 'Line breaks',
              old: value('1 removed')
            } ]
          ],
          [
            '<p>One<br>two</p><p>Three four five</p><h2>Six</h2>',
            '<p>One two</p><p>Three<br>four<br>five</p><h3>Six</h3>',
            [
              {
                change: 'block',
                type: 'modified',
                label: 'Block style',
                text: 'Six',
                old: value('Heading 2 (H2)'),
                new: value('Heading 3 (H3)')
              },
              {
                change: 'breaks',
                type: 'modified',
                label: 'Line breaks',
                old: value('1 removed'),
                new: value('2 added')
              }
            ]
          ],
          [
            '<table><tbody><tr><td><p>A</p></td></tr></tbody></table>',
            '<table><tbody><tr><td><p>A</p></td></tr>' +
            '<tr><td><p></p></td></tr></tbody></table>',
            [ {
              change: 'table',
              type: 'modified',
              label: 'Table layout'
            } ]
          ]
        ];
        for (const [ before, after, lines ] of cases) {
          const older = buildDoc();
          const newer = buildDoc();
          older.body = before;
          newer.body = after;
          const ctx = apos.docVersions.getDiffContext(req);
          const rows = text.addFormat(
            apos.docVersions.getChangeRows(req, older, newer),
            ctx
          );
          await apos.docVersions.addChangeText(req, rows);
          assert.deepEqual(rows[0].formatChanges, lines);
        }
      });

      it('should name an image by its title, fetched with the related titles', async function () {
        const image = await apos.image.insert(req, { title: 'Fox picture' });
        const older = buildDoc();
        const newer = buildDoc();
        older.body = '<p>One</p>';
        newer.body = `<p>One</p><figure><img src="${src(image.aposDocId)}" alt="A fox"></figure>`;
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        assert.deepEqual(text.getRelatedIds(rows, ctx), [ image.aposDocId ]);
        await apos.docVersions.addChangeText(req, rows);
        assert.deepEqual(rows[0].formatChanges, [ {
          change: 'imageAdded',
          type: 'added',
          label: 'Image',
          new: {
            text: 'Fox picture',
            href: src(image.aposDocId)
          }
        } ]);
      });

      it('should show a replaced image as one change, by both titles', async function () {
        const fox = await apos.image.insert(req, { title: 'Fox picture' });
        const hen = await apos.image.insert(req, { title: 'Hen picture' });
        const older = buildDoc();
        const newer = buildDoc();
        older.body = `<p>One</p><figure><img src="${src(fox.aposDocId)}" alt=""></figure>`;
        newer.body = `<p>One</p><figure><img src="${src(hen.aposDocId)}" alt=""></figure>`;
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        await apos.docVersions.addChangeText(req, rows);
        assert.deepEqual(rows[0].formatChanges, [ {
          change: 'imageReplaced',
          type: 'modified',
          label: 'Image',
          old: {
            text: 'Fox picture',
            href: src(fox.aposDocId)
          },
          new: {
            text: 'Hen picture',
            href: src(hen.aposDocId)
          }
        } ]);
      });

      it('should link no image that is archived or gone', async function () {
        const kept = await apos.image.insert(req, { title: 'Kept picture' });
        const archived = await apos.image.insert(req, {
          title: 'Archived picture',
          archived: true
        });
        const older = buildDoc();
        const newer = buildDoc();
        older.body = `<p>One</p><figure><img src="${src(archived.aposDocId)}" alt=""></figure>`;
        newer.body = `<p>One</p><figure><img src="${src(kept.aposDocId)}" alt=""></figure>`;
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        await apos.docVersions.addChangeText(req, rows);
        assert.deepEqual(rows[0].formatChanges[0].old, { text: 'Archived picture' });
        assert.deepEqual(rows[0].formatChanges[0].new, {
          text: 'Kept picture',
          href: src(kept.aposDocId)
        });

        older.body = `<p>One</p><figure><img src="${src('gone')}" alt="A fox"></figure>`;
        newer.body = '<p>One</p>';
        const gone = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        await apos.docVersions.addChangeText(req, gone);
        assert.deepEqual(gone[0].formatChanges, [ {
          change: 'imageRemoved',
          type: 'deleted',
          label: 'Image',
          old: { text: 'A fox' }
        } ]);
      });

      it('should read an internal link as the document it links to', async function () {
        const home = await apos.page.find(req, { slug: '/' }).toObject();
        const permalink = id => `#apostrophe-permalink-${id}?updateTitle=1`;
        const older = buildDoc();
        const newer = buildDoc();
        older.body = '<p>Read <a href="https://example.com/guide">the guide</a> now.</p>' +
          `<figure><a href="/fox"><img src="${src('fox')}" alt="A fox"></a></figure>`;
        newer.body = `<p>Read <a href="${permalink(home.aposDocId)}">the guide</a> now.</p>` +
          `<figure><a href="#apostrophe-permalink-${home.aposDocId}">` +
          `<img src="${src('fox')}" alt="A fox"></a></figure>`;
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        assert.deepEqual(text.getRelatedIds(rows, ctx), [ home.aposDocId, 'fox' ]);
        await apos.docVersions.addChangeText(req, rows);
        assert.deepEqual(rows[0].formatChanges, [
          {
            change: 'link',
            type: 'modified',
            label: 'Link',
            text: 'the guide',
            old: { text: 'https://example.com/guide' },
            new: {
              text: 'Home',
              url: home._url
            }
          },
          {
            change: 'image',
            type: 'modified',
            label: 'Image link',
            text: 'A fox',
            old: { text: '/fox' },
            new: {
              text: 'Home',
              url: home._url
            }
          }
        ]);
      });

      it('should read an internal link to a document it cannot find neutrally', async function () {
        const older = buildDoc();
        const newer = buildDoc();
        older.body = '<p>Read the guide now.</p>';
        newer.body = '<p>Read <a href="#apostrophe-permalink-gone?updateTitle=0">the guide</a> now.</p>';
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        await apos.docVersions.addChangeText(req, rows);
        assert.deepEqual(rows[0].formatChanges, [ {
          change: 'linkAdded',
          type: 'added',
          label: 'Link',
          text: 'the guide',
          new: { text: 'Internal link' }
        } ]);
      });

      it('should list the changes of a rich text widget in reading order', async function () {
        const build = content => {
          const doc = buildDoc();
          doc.section.rows[0].content.items.push({
            _id: 'text',
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content
          });
          return doc;
        };
        const older = build(
          '<p>Our mission</p><p>Read <a href="/one">the guide</a> now.</p>'
        );
        const newer = build(
          '<h2>Our mission</h2><p>Read <a href="/two">the guide</a> today.</p>'
        );
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        await apos.docVersions.addChangeText(req, rows);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].newText, 'Our mission\nRead the guide today.');
        assert.deepEqual(
          rows[0].formatChanges.map(line => [ line.label, line.text, line.new.text ]),
          [
            [ 'Block style', 'Our mission', 'Heading 2 (H2)' ],
            [ 'Link', 'the guide', '/two' ]
          ]
        );
        assert.equal(Object.keys(rows[0]).includes('format'), false);
      });

      it('should read a figure, its caption and a rule as lines of their own', async function () {
        const older = buildDoc();
        const newer = buildDoc();
        older.body = '<p>One.</p>';
        newer.body = '<p>One.</p><figure><img src="/fox.png" alt="A fox">' +
          '<figcaption>The fox.</figcaption></figure><p>Two.</p><hr><p>Three.</p>';
        const rows = apos.docVersions.getChangeRows(req, older, newer);
        await apos.docVersions.addChangeText(req, rows);
        assert.equal(rows[0].newText, 'One.\nThe fox.\nTwo.\nThree.');
      });

      it('should quote the words affected on one line, cut short', async function () {
        const words = Array.from({ length: 40 }, (value, at) => `word${at}`).join(' ');
        const older = buildDoc();
        const newer = buildDoc();
        older.body = `<p>${words}</p>`;
        newer.body = `<h3>${words}</h3>`;
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        await apos.docVersions.addChangeText(req, rows);
        assert.equal(
          rows[0].formatChanges[0].text,
          `${words.slice(0, 80).trimEnd()}…`
        );
      });

      it('should set nothing when only words changed, and nothing unless asked', async function () {
        const older = buildDoc();
        const newer = buildDoc();
        newer.body = '<p>Body <strong>changed</strong></p>';
        const ctx = apos.docVersions.getDiffContext(req);
        const rows = text.addFormat(
          apos.docVersions.getChangeRows(req, older, newer),
          ctx
        );
        await apos.docVersions.addChangeText(req, rows);
        assert.equal('formatChanges' in rows[0], false);

        newer.body = '<h2>Body root</h2>';
        const plain = apos.docVersions.getChangeRows(req, older, newer);
        await apos.docVersions.addChangeText(req, plain);
        assert.equal('formatChanges' in plain[0], false);
      });
    });
  });

  describe('annotate', function () {
    // Every widget in `doc` carrying any marker, as `[ _id, marker ]`
    function markers(doc) {
      const found = [];
      const visit = node => {
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        if (!node || (typeof node !== 'object')) {
          return;
        }
        if (node.metaType === 'widget') {
          for (const marker of [
            '_inserted',
            '_deleted',
            '_modified',
            '_olderVersion',
            '_moved',
            '_changedWithAi',
            '_movedWithAi'
          ]) {
            if (node[marker] !== undefined) {
              found.push([ node._id, marker ]);
            }
          }
        }
        for (const [ key, value ] of Object.entries(node)) {
          if (key !== '_olderVersion') {
            visit(value);
          }
        }
      };
      visit(doc);
      return found;
    }

    it('should return an unmarked copy when nothing changed', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(doc, newer);
      assert.notEqual(doc, newer);
      assert.deepEqual(markers(doc), []);
    });

    it('should highlight a top-level field changed outside any widget', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.title = 'Renamed';
      newer.section.rows[1].mail = 'other@example.com';
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.equal(doc.aposMeta.title[HIGHLIGHT], true);
      assert.equal(doc.aposMeta.section[HIGHLIGHT], true);
      assert.equal(doc.aposMeta.slug, undefined);
      assert.deepEqual(markers(doc), []);
      assert.equal(newer.aposMeta, undefined);
    });

    it('should mark only the deepest changed widget', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const route = deepestRoute(newer);
      route.at(-1).node.count = 99;
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      const deepestWidget = route.filter(hop => hop.segments.at(-1).widgetType).at(-1);
      assert.deepEqual(markers(doc), [
        [ deepestWidget.node._id, '_modified' ]
      ]);
      assert.equal(doc.aposMeta, undefined);
    });

    it('should mark a parent widget too when it has changes of its own', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const outer = newer.section.rows[0].content.items[0];
      const inner = outer.section.rows[0].content.items[0];
      outer.title = 'Outer, edited';
      inner.title = 'Inner, edited';
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(markers(doc), [
        [ outer._id, '_modified' ],
        [ inner._id, '_olderVersion' ]
      ]);
    });

    it('should hand a widget type that opts in its older version', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const innerWidget = doc => doc.section.rows[0].content.items[0]
        .section.rows[0].content.items[0];
      const widget = innerWidget(newer);
      widget.title = 'Edited';
      widget.section.rows[1].count = 42;
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(markers(doc), [
        [ widget._id, '_olderVersion' ]
      ]);
      const olderWidget = innerWidget(older);
      const annotated = innerWidget(doc);
      assert.deepEqual(annotated._olderVersion, olderWidget);
      assert.notEqual(annotated._olderVersion, olderWidget);
      assert.equal(annotated._modified, undefined);
      assert.equal(annotated.title, 'Edited');
    });

    it('should flag an added widget and nothing inside it', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const area = newer.section.rows[0].content;
      const added = {
        ...structuredClone(area.items[0]),
        _id: 'root.section.rows.0.content.3',
        title: 'Another'
      };
      area.items.push(added);
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(markers(doc), [
        [ added._id, '_inserted' ]
      ]);
    });

    it('should put a deleted widget back in place, flagged', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const area = newer.section.rows[0].content;
      const [ nested, richText, opaque ] = area.items;
      area.items = [ nested, opaque ];
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      const items = doc.section.rows[0].content.items;
      assert.deepEqual(
        items.map(item => item._id),
        [ nested._id, richText._id, opaque._id ]
      );
      assert.deepEqual(markers(doc), [
        [ richText._id, '_deleted' ]
      ]);
      assert.equal(items[1].content, richText.content);
      assert.equal(newer.section.rows[0].content.items.length, 2);
    });

    it('should put a deleted widget back at the end when its neighbours went too', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const olderItems = older.section.rows[0].content.items;
      newer.section.rows[0].content.items = [];
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(
        doc.section.rows[0].content.items.map(item => item._id),
        olderItems.map(item => item._id)
      );
      assert.deepEqual(markers(doc), olderItems.map(item => [ item._id, '_deleted' ]));
    });

    it('should flag a deleted nested widget inside an unmarked parent', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const outer = newer.section.rows[0].content.items[0];
      const innerArea = outer.section.rows[1].content;
      const [ , gone ] = innerArea.items;
      innerArea.items.splice(1, 1);
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(markers(doc), [
        [ gone._id, '_deleted' ]
      ]);
      assert.equal(doc.aposMeta, undefined);
    });

    it('should mark the widget that changed places, not the widgets it passed', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const { items } = newer.section.rows[0].content;
      const last = items.pop();
      items.unshift(last);
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(markers(doc), [
        [ last._id, '_moved' ]
      ]);
      assert.equal(doc.aposMeta, undefined);
    });

    it('should mark a widget that moved and changed with both markers', function () {
      const older = buildDoc();
      const newer = buildDoc();
      const { items } = newer.section.rows[0].content;
      const last = items.pop();
      last.extra = 'Changed';
      items.unshift(last);
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(markers(doc), [
        [ last._id, '_modified' ],
        [ last._id, '_moved' ]
      ]);
    });

    it('should highlight the field of an array whose items changed places', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.section.rows.reverse();
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
      assert.deepEqual(markers(doc), []);
      assert.equal(doc.aposMeta.section[HIGHLIGHT], true);
    });

    it('should say where AI was involved, from rows flagged for it', function () {
      // A fourth widget, so that two moves are not a reversal
      const build = () => {
        const doc = buildDoc();
        doc.section.rows[0].content.items.push({
          _id: 'fourth',
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>Fourth</p>'
        });
        return doc;
      };
      const older = build();
      const middle = build();
      const newer = build();
      // AI edits the third widget and moves it to the top, and renames
      const edit = doc => {
        const { items } = doc.section.rows[0].content;
        const [ third ] = items.splice(2, 1);
        third.extra = 'By AI';
        items.unshift(third);
        doc.title = 'By AI';
        return third;
      };
      edit(middle);
      const byAi = edit(newer);
      // A human edits the fourth widget, moves the first one (now second)
      // to the end, and edits the subtitle
      const { items } = newer.section.rows[0].content;
      items[3].content = '<p>By hand</p>';
      const [ byHand ] = items.splice(1, 1);
      items.push(byHand);
      newer.subtitle = 'By hand';
      const rows = apos.docVersions.getConsolidatedRows(req, [
        {
          older,
          newer: middle,
          ai: true
        },
        {
          older: middle,
          newer
        }
      ]);
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer, { rows });
      assert.deepEqual(markers(doc).sort(), [
        [ 'fourth', '_olderVersion' ],
        [ byAi._id, '_changedWithAi' ],
        [ byAi._id, '_modified' ],
        [ byAi._id, '_moved' ],
        [ byAi._id, '_movedWithAi' ],
        [ byHand._id, '_moved' ]
      ].sort());
      assert.deepEqual(doc.aposMeta.title, {
        [HIGHLIGHT]: true,
        '@apostrophecms/document-versions:ai': true
      });
      assert.deepEqual(doc.aposMeta.subtitle, { [HIGHLIGHT]: true });
    });

    it('should name the widgets the versions moved where fewer moves would name others', async function () {
      const older = buildDoc();
      const middle = buildDoc();
      const newer = buildDoc();
      // AI moves the last widget to the top, a human the first to the end:
      // a reversal, which any two of the three would explain
      for (const doc of [ middle, newer ]) {
        const { items } = doc.section.rows[0].content;
        items.unshift(items.pop());
      }
      const { items } = newer.section.rows[0].content;
      const [ byAi ] = items;
      const [ byHand ] = items.splice(1, 1);
      items.push(byHand);
      const rows = apos.docVersions.getConsolidatedRows(req, [
        {
          older,
          newer: middle,
          ai: true
        },
        {
          older: middle,
          newer
        }
      ]);
      const doc = apos.docVersions.getAnnotatedDoc(req, older, newer, { rows });
      assert.deepEqual(markers(doc).sort(), [
        [ byAi._id, '_moved' ],
        [ byAi._id, '_movedWithAi' ],
        [ byHand._id, '_moved' ]
      ].sort());

      // The panes of the order row mark the same two
      await apos.docVersions.addChangeText(req, rows);
      const text = require('../modules/@apostrophecms/document-versions/lib/text.js');
      const [ row ] = text.addWordDiff(rows, apos.docVersions.getDiffContext(req));
      const {
        diff, oldText, newText
      } = row;
      const side = change => diff
        .filter(part => [ 'same', change ].includes(part.change))
        .map(part => part.text)
        .join(', ');
      assert.equal(side('removed'), oldText);
      assert.equal(side('added'), newText);
      assert.deepEqual(diff.map(part => [ part.change, part.text ]), [
        [ 'added', '#1 Opaque' ],
        [ 'removed', '#3 Nested 2' ],
        [ 'same', '#2 Rich Text' ],
        [ 'added', '#3 Nested 2' ],
        [ 'removed', '#1 Opaque' ]
      ]);
    });

    describe('rich text', function () {
      // The fixture with a rich text widget of `type` holding `content`
      function buildWith(type, content) {
        const doc = buildDoc();
        doc.section.rows[0].content.items.push({
          _id: 'text',
          metaType: 'widget',
          type,
          content
        });
        return doc;
      }

      it('should mark the text that changed inside the content', function () {
        const older = buildWith('@apostrophecms/rich-text', '<p>The quick brown fox</p>');
        const newer = buildWith('@apostrophecms/rich-text', '<p>The quick red fox</p>');
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        const widget = doc.section.rows[0].content.items.at(-1);
        assert.deepEqual(markers(doc), [ [ 'text', '_olderVersion' ] ]);
        assert.equal(
          widget.content,
          '<p>The quick ' +
          '<del data-apos-version-change="removed">' +
          '<span class="apos-sr-only">Removed </span>brown</del>' +
          '<ins data-apos-version-change="added">' +
          '<span class="apos-sr-only">Added </span>red</ins>' +
          ' fox</p>'
        );
        assert.equal(widget._olderVersion.content, '<p>The quick brown fox</p>');
        assert.equal(
          newer.section.rows[0].content.items.at(-1).content,
          '<p>The quick red fox</p>'
        );
      });

      it('should mark the text of a type extending rich text', function () {
        const older = buildWith('quote', '<p>Old</p>');
        const newer = buildWith('quote', '<p>New</p>');
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        const widget = doc.section.rows[0].content.items.at(-1);
        assert.deepEqual(markers(doc), [ [ 'text', '_olderVersion' ] ]);
        assert.match(widget.content, /<del [^>]+>.*Old<\/del><ins [^>]+>.*New<\/ins>/);
      });

      it('should leave the content alone when no text changed', function () {
        const older = buildWith('@apostrophecms/rich-text', '<p><a href="/one">Link</a></p>');
        const newer = buildWith('@apostrophecms/rich-text', '<p><a href="/two">Link</a></p>');
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        const widget = doc.section.rows[0].content.items.at(-1);
        assert.deepEqual(markers(doc), [ [ 'text', '_olderVersion' ] ]);
        assert.equal(widget.content, '<p><a href="/two">Link</a></p>');
      });

      it('should leave the content of a type that opts out alone', function () {
        const older = buildWith('plain-text', '<p>Old</p>');
        const newer = buildWith('plain-text', '<p>New</p>');
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        const widget = doc.section.rows[0].content.items.at(-1);
        assert.deepEqual(markers(doc), [ [ 'text', '_modified' ] ]);
        assert.equal(widget.content, '<p>New</p>');
      });

      it('should mark the text between the ends of consecutive versions', function () {
        const older = buildWith('@apostrophecms/rich-text', '<p>One</p>');
        const middle = buildWith('@apostrophecms/rich-text', '<p>One two</p>');
        const newer = buildWith('@apostrophecms/rich-text', '<p>One three</p>');
        const rows = apos.docVersions.getConsolidatedRows(req, [
          {
            older,
            newer: middle,
            ai: true
          },
          {
            older: middle,
            newer
          }
        ]);
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer, { rows });
        const widget = doc.section.rows[0].content.items.at(-1);
        assert.deepEqual(markers(doc).sort(), [
          [ 'text', '_changedWithAi' ],
          [ 'text', '_olderVersion' ]
        ]);
        assert.equal(
          widget.content,
          '<p>One<ins data-apos-version-change="added">' +
          '<span class="apos-sr-only">Added </span> three</ins></p>'
        );
      });

      it('should mark the text of a top-level richText field', function () {
        const older = buildDoc();
        const newer = buildDoc();
        newer.body = '<p>Body changed</p>';
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        assert.equal(
          doc.body,
          '<p>Body ' +
          '<del data-apos-version-change="removed">' +
          '<span class="apos-sr-only">Removed </span>root</del>' +
          '<ins data-apos-version-change="added">' +
          '<span class="apos-sr-only">Added </span>changed</ins></p>'
        );
        assert.equal(doc.aposMeta.body[HIGHLIGHT], true);
        assert.equal(newer.body, '<p>Body changed</p>');
      });

      it('should mark the text of richText fields in objects and array items', function () {
        const older = buildDoc();
        const newer = buildDoc();
        newer.section.body = '<p>Body root.section and more</p>';
        newer.section.rows[0].body = '';
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        assert.equal(
          doc.section.body,
          '<p>Body root.section<ins data-apos-version-change="added">' +
          '<span class="apos-sr-only">Added </span> and more</ins></p>'
        );
        assert.equal(
          doc.section.rows[0].body,
          '<p><del data-apos-version-change="removed">' +
          '<span class="apos-sr-only">Removed </span>Body root.section.rows.0</del></p>'
        );
        assert.equal(doc.aposMeta.section[HIGHLIGHT], true);
        assert.deepEqual(markers(doc), []);
      });

      it('should leave a richText field alone when no text changed', function () {
        const older = buildDoc();
        const newer = buildDoc();
        older.body = '<p><a href="/one">Link</a></p>';
        newer.body = '<p><a href="/two">Link</a></p>';
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        assert.equal(doc.body, '<p><a href="/two">Link</a></p>');
        assert.equal(doc.aposMeta.body[HIGHLIGHT], true);
      });

      it('should leave richText fields of widgets alone', function () {
        const older = buildDoc();
        const newer = buildDoc();
        const plain = newer.section.rows[0].content.items[0];
        const opted = plain.section.rows[0].content.items[0];
        plain.body = '<p>Plain changed</p>';
        opted.body = '<p>Opted in changed</p>';
        const doc = apos.docVersions.getAnnotatedDoc(req, older, newer);
        const plainDoc = doc.section.rows[0].content.items[0];
        const optedDoc = plainDoc.section.rows[0].content.items[0];
        assert.deepEqual(markers(doc).sort(), [
          [ opted._id, '_olderVersion' ],
          [ plain._id, '_modified' ]
        ].sort());
        assert.equal(plainDoc.body, '<p>Plain changed</p>');
        assert.equal(optedDoc.body, '<p>Opted in changed</p>');
      });
    });

    it('should reuse rows already computed', function () {
      const older = buildDoc();
      const newer = buildDoc();
      newer.title = 'Renamed';
      const schema = apos.nested.schema;
      const ctx = apos.docVersions.getDiffContext(req);
      const diff = require('../modules/@apostrophecms/document-versions/lib/diff.js');
      const rows = diff.walk(schema, older, newer, ctx);
      const doc = diff.annotate(schema, older, newer, ctx, { rows });
      assert.equal(doc.aposMeta.title[HIGHLIGHT], true);
    });
  });

  describe('consolidate', function () {
    // A run of versions, each member editing a copy of the previous
    // document; `ai` marks the members saved with AI
    function run(...members) {
      let doc = buildDoc();
      return members.map(({ ai = false, edit }) => {
        const older = doc;
        doc = structuredClone(older);
        edit(doc);
        return {
          older,
          newer: doc,
          ai
        };
      });
    }
    const brief = row => [ row.type, row.fieldType, row.path.at(-1).name, row.ai ];
    const getRows = doc => doc.section.rows;

    it('should give a single version its rows with its AI flag', function () {
      const pairs = run({
        edit: doc => {
          doc.title = 'Renamed';
          doc.section.rows[0].count = 5;
        }
      });
      const rows = apos.docVersions.getConsolidatedRows(req, pairs);
      assert.deepEqual(
        rows,
        apos.docVersions.getChangeRows(req, pairs[0].older, pairs[0].newer)
          .map(row => ({
            ...row,
            ai: false
          }))
      );
      assert.equal(rows[0].field.name, 'title');
      pairs[0].ai = true;
      assert.deepEqual(
        apos.docVersions.getConsolidatedRows(req, pairs).map(row => row.ai),
        [ true, true ]
      );
    });

    it('should list a path several members changed once, from its first value to its last', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          edit: doc => {
            doc.title = 'Second';
            doc.subtitle = 'Sub';
          }
        },
        {
          ai: true,
          edit: doc => {
            doc.title = 'Third';
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'modified', 'string', 'title', true ],
        [ 'added', 'string', 'subtitle', false ]
      ]);
      assert.equal(rows[0].old, 'Title root');
      assert.equal(rows[0].new, 'Third');
    });

    it('should call a path modified and then deleted deleted, as it was before the run', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          ai: true,
          edit: doc => {
            getRows(doc)[1].title = 'Edited';
          }
        },
        {
          edit: doc => {
            getRows(doc).pop();
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'deleted', 'arrayItem', 'root.section.rows.1', true ]
      ]);
      assert.equal(rows[0].old.title, 'Title root.section.rows.1');
      assert.equal(rows[0].path.at(-1).label, 'Title root.section.rows.1');
    });

    it('should call a path added and then modified added, with its final value', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          edit: doc => {
            getRows(doc).push({
              ...structuredClone(getRows(doc)[1]),
              _id: 'root.section.rows.2',
              title: 'Third'
            });
          }
        },
        {
          ai: true,
          edit: doc => {
            getRows(doc)[2].title = 'Third, edited';
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'added', 'arrayItem', 'root.section.rows.2', true ]
      ]);
      assert.equal(rows[0].new.title, 'Third, edited');
      assert.equal(rows[0].path.at(-1).label, 'Third, edited');
    });

    it('should drop a path added and then deleted', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          ai: true,
          edit: doc => {
            getRows(doc).push({
              ...structuredClone(getRows(doc)[1]),
              _id: 'root.section.rows.2',
              title: 'Third'
            });
          }
        },
        {
          edit: doc => {
            getRows(doc).pop();
          }
        }
      ));
      assert.deepEqual(rows, []);
    });

    it('should drop a path that ends where it started', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          ai: true,
          edit: doc => {
            doc.title = 'Renamed';
          }
        },
        {
          edit: doc => {
            doc.title = 'Title root';
            doc.count = 1;
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'modified', 'integer', 'count', false ]
      ]);
    });

    it('should flag a path an AI member changed, whoever changed it after', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          edit: doc => {
            doc.title = 'Second';
          }
        },
        {
          ai: true,
          edit: doc => {
            doc.subtitle = 'By AI';
          }
        },
        {
          edit: doc => {
            doc.subtitle = 'By hand';
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'modified', 'string', 'title', false ],
        [ 'added', 'string', 'subtitle', true ]
      ]);
    });

    it('should flag an item or widget an AI member changed inside', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          edit: doc => {
            getRows(doc).push({
              ...structuredClone(getRows(doc)[1]),
              _id: 'root.section.rows.2',
              title: 'Third'
            });
            const area = getRows(doc)[0].content;
            area.items.push({
              ...structuredClone(area.items[1]),
              _id: 'root.section.rows.0.content.3'
            });
          }
        },
        {
          ai: true,
          edit: doc => {
            getRows(doc)[2].title = 'Third, by AI';
            getRows(doc)[1].title = 'Second, by AI';
            getRows(doc)[0].content.items[3].content = '<p>By AI</p>';
          }
        },
        {
          edit: doc => {
            getRows(doc).splice(1, 1);
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'added', 'widget', 'root.section.rows.0.content.3', true ],
        [ 'deleted', 'arrayItem', 'root.section.rows.1', true ],
        [ 'added', 'arrayItem', 'root.section.rows.2', true ]
      ]);
    });

    it('should flag a path an AI member created by adding its parent', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          edit: doc => {
            doc.section = null;
          }
        },
        {
          ai: true,
          edit: doc => {
            doc.section = {
              ...buildDoc().section,
              title: 'Rebuilt'
            };
          }
        },
        {
          edit: doc => {
            doc.count = 1;
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'modified', 'integer', 'count', false ],
        [ 'modified', 'string', 'title', true ]
      ]);
      assert.deepEqual(rows[1].path.map(segment => segment.name), [ 'section', 'title' ]);
    });

    it('should keep the order of items apart from the items', function () {
      const reorder = doc => {
        getRows(doc).reverse();
      };
      const edit = doc => {
        getRows(doc).find(item => item._id.endsWith('.0')).title = 'Edited';
      };
      const expected = (order, item) => [
        [ 'modified', 'array', 'rows', order ],
        [ 'modified', 'string', 'title', item ]
      ];
      assert.deepEqual(
        apos.docVersions.getConsolidatedRows(req, run({
          ai: true,
          edit: reorder
        }, { edit })).map(brief),
        expected(true, false)
      );
      assert.deepEqual(
        apos.docVersions.getConsolidatedRows(req, run({ edit: reorder }, {
          ai: true,
          edit
        })).map(brief),
        expected(false, true)
      );
    });

    it('should drop an order that ends where it started', function () {
      const reorder = doc => {
        getRows(doc).reverse();
      };
      assert.deepEqual(apos.docVersions.getConsolidatedRows(req, run(
        { edit: reorder },
        {
          ai: true,
          edit: reorder
        }
      )), []);
    });

    it('should keep a widget\'s schema fields apart from the data it stores beside them', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          ai: true,
          edit: doc => {
            getRows(doc)[0].content.items[0].extra = 'x';
          }
        },
        {
          edit: doc => {
            getRows(doc)[0].content.items[0].title = 'By hand';
          }
        }
      ));
      assert.deepEqual(rows.map(brief), [
        [ 'modified', 'string', 'title', false ],
        [ 'modified', 'widget', 'root.section.rows.0.content.0', true ]
      ]);
    });

    it('should flag every row when every member used AI', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          ai: true,
          edit: doc => {
            doc.title = 'Second';
          }
        },
        {
          ai: true,
          edit: doc => {
            doc.subtitle = 'Sub';
          }
        }
      ));
      assert.deepEqual(rows.map(row => row.ai), [ true, true ]);
    });

    it('should take labels, ordinals and order from the run\'s ends', function () {
      const rows = apos.docVersions.getConsolidatedRows(req, run(
        {
          edit: doc => {
            getRows(doc).shift();
          }
        },
        {
          ai: true,
          edit: doc => {
            getRows(doc)[0].title = 'Edited';
          }
        }
      ));
      assert.deepEqual(rows.map(row => [ row.type, row.path.at(-1).name, row.ai ]), [
        [ 'deleted', 'root.section.rows.0', false ],
        [ 'modified', 'title', true ]
      ]);
      assert.deepEqual(rows.map(row => row.path[2]), [
        {
          name: 'root.section.rows.0',
          label: 'Title root.section.rows.0',
          ordinal: 1
        },
        {
          name: 'root.section.rows.1',
          label: 'Edited',
          ordinal: 1
        }
      ]);
    });
  });

  describe('render-widget', function () {
    let jar;
    let areaFieldId;

    before(async function () {
      await addUser(apos, 'admin');
      jar = await login(apos, 'admin');
      // The CSRF cookie
      await apos.http.get('/', { jar });
      const findArea = schema => {
        for (const field of schema) {
          if (field.type === 'area') {
            return field;
          }
          const found = field.schema && findArea(field.schema);
          if (found) {
            return found;
          }
        }
        return null;
      };
      areaFieldId = findArea(apos.nested.schema)._id;
    });

    // The markup of a widget of `type` with `data`, and with `olderData` as
    // its older version when given
    function render(type, data, olderData) {
      const widget = {
        _id: 'widget',
        metaType: 'widget',
        type,
        ...data
      };
      if (olderData) {
        widget._olderVersion = {
          ...widget,
          ...olderData
        };
      }
      return apos.http.post('/api/v1/@apostrophecms/area/render-widget', {
        jar,
        body: {
          widget,
          areaFieldId,
          type
        }
      });
    }

    it('should hand a type that opts in its older version', async function () {
      const html = await render('version-note', { title: 'New' }, { title: 'Old' });
      assert.ok(html.includes('<p class="note">New|Old</p>'), html);
    });

    it('should hand no older version to a type that opts out', async function () {
      const html = await render('plain-note', { title: 'New' }, { title: 'Old' });
      assert.ok(html.includes('<p class="note">New|</p>'), html);
    });

    it('should hand no older version when the request has none', async function () {
      const html = await render('version-note', { title: 'New' });
      assert.ok(html.includes('<p class="note">New|</p>'), html);
    });
  });
});
