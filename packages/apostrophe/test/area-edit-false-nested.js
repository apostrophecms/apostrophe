const assert = require('node:assert/strict');
const t = require('../test-lib/test.js');
const { createId } = require('@paralleldrive/cuid2');

// Stable has no apos.area.renderAreaTag (it came with the WYSIWYG fields
// feature), so render an area exactly as the {% area %} tag does on stable
async function renderAreaTag(apos, req, doc, name, _with) {
  const area = doc[name] ||
    await apos.area.addMissingArea(doc, name, { throwIfNotFound: true });
  area._edit = area._edit || doc._edit;
  apos.area.prepForRender(area, doc, name);
  return apos.area.renderArea(req, area, _with);
}

// `edit: false` on an area must also make the areas nested inside its
// widgets non-editable in context, at any depth.
describe('Areas with edit: false', function() {
  let apos;

  this.timeout(t.timeout);

  after(async function() {
    await t.destroy(apos);
    apos = null;
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'nest-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            label: 'Nest'
          },
          fields: {
            add: {
              inner: {
                type: 'area',
                options: {
                  widgets: {
                    nest: {},
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          },
          methods(self) {
            return {
              // Equivalent of a widget.html containing
              // {% area data.widget, 'inner' %}
              async output(req, widget, options, _with) {
                const inner = await renderAreaTag(self.apos, req, widget, 'inner', {});
                return `<section class="nest">${inner}</section>`;
              }
            };
          }
        },
        'edit-false-thing': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              locked: {
                type: 'area',
                options: {
                  edit: false,
                  widgets: {
                    nest: {}
                  }
                }
              },
              open: {
                type: 'area',
                options: {
                  widgets: {
                    nest: {}
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  function richText(text) {
    return {
      _id: createId(),
      metaType: 'widget',
      type: '@apostrophecms/rich-text',
      content: `<p>${text}</p>`
    };
  }

  // An area holding a nest widget whose inner area holds another nest
  // widget, so that there are three levels of areas
  function nestArea() {
    return {
      _id: createId(),
      metaType: 'area',
      items: [
        {
          _id: createId(),
          metaType: 'widget',
          type: 'nest',
          inner: {
            _id: createId(),
            metaType: 'area',
            items: [
              {
                _id: createId(),
                metaType: 'widget',
                type: 'nest',
                inner: {
                  _id: createId(),
                  metaType: 'area',
                  items: [ richText('Deepest') ]
                }
              }
            ]
          }
        }
      ]
    };
  }

  function countEditable(html) {
    return (html.match(/data-apos-area-newly-editable/g) || []).length;
  }

  it('does not make areas nested in an edit: false area editable', async function() {
    const req = apos.task.getReq({ query: { aposEdit: '1' } });
    const manager = apos.modules['edit-false-thing'];
    const inserted = await manager.insert(req, {
      title: 'Edit false',
      locked: nestArea(),
      open: nestArea()
    });
    const piece = await manager.find(req, { _id: inserted._id }).toObject();
    assert.equal(piece._edit, true);

    const openHtml = await renderAreaTag(apos, req, piece, 'open', {});
    const lockedHtml = await renderAreaTag(apos, req, piece, 'locked', {});

    // The control area and both areas nested inside it are editable
    assert.equal(countEditable(openHtml), 3);
    // Neither the edit: false area nor anything inside it is editable,
    // but its content still renders
    assert.equal(countEditable(lockedHtml), 0);
    assert.match(lockedHtml, /Deepest/);
  });

  it('does not leave editing suppressed for areas rendered afterwards', async function() {
    const req = apos.task.getReq({ query: { aposEdit: '1' } });
    const manager = apos.modules['edit-false-thing'];
    const inserted = await manager.insert(req, {
      title: 'Edit false order',
      locked: nestArea(),
      open: nestArea()
    });
    const piece = await manager.find(req, { _id: inserted._id }).toObject();

    await renderAreaTag(apos, req, piece, 'locked', {});
    const openHtml = await renderAreaTag(apos, req, piece, 'open', {});
    assert.equal(countEditable(openHtml), 3);
  });
});
