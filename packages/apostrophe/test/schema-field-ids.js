const t = require('../test-lib/test.js');
const assert = require('node:assert/strict');

// Two piece types with deliberately identical field definitions. Field ids are
// derived from where a field lives, not from what it contains, so these must
// still be told apart.
const pieceType = (name) => ({
  extend: '@apostrophecms/piece-type',
  fields: {
    add: {
      flavor: {
        type: 'string',
        label: 'Flavor'
      },
      topping: {
        type: 'select',
        label: 'Topping',
        following: [ 'flavor' ],
        choices: 'getToppings'
      },
      pets: {
        type: 'array',
        label: 'Pets',
        // Legacy override, deliberately different from the field name
        arrayName: 'critters',
        fields: {
          add: {
            petName: {
              type: 'string',
              label: 'Pet Name',
              following: [ '<flavor' ]
            }
          }
        }
      },
      favorite: {
        type: 'object',
        label: 'Favorite',
        // Legacy override, deliberately different from the field name
        objectName: 'preferred',
        fields: {
          add: {
            favoriteName: {
              type: 'string',
              label: 'Favorite Name'
            },
            toys: {
              type: 'array',
              label: 'Toys',
              fields: {
                add: {
                  toyLabel: {
                    type: 'string',
                    label: 'Toy Label'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  methods() {
    return {
      // Reports which module actually ran and which followed fields the
      // relative path walk resolved, so the route test can prove both
      async getToppings(req, { docId }, following) {
        return [
          {
            value: name,
            label: `${name}:${Object.keys(following || {}).sort().join(',')}`
          }
        ];
      }
    };
  }
});

// Collect every registered field, recursing exactly as register() does
function collectFields(schema, acc = []) {
  for (const field of schema) {
    acc.push(field);
    if (((field.type === 'array') || (field.type === 'object')) && field.schema) {
      collectFields(field.schema, acc);
    }
  }
  return acc;
}

describe('Schema - field ids', function() {

  this.timeout(t.timeout);

  let apos;

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: pieceType('article'),
        dessert: pieceType('dessert'),
        'nested-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              flavor: {
                type: 'string',
                label: 'Flavor'
              },
              pets: {
                type: 'array',
                label: 'Pets',
                fields: {
                  add: {
                    petName: {
                      type: 'string',
                      label: 'Pet Name'
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  function fieldOf(schema, name) {
    const field = schema.find(field => field.name === name);
    assert(field, `expected a field named ${name}`);
    return field;
  }

  describe('id format', function() {

    it('should give a top level doc field a metaType.type.name id', function() {
      const schema = apos.modules.article.schema;
      assert.equal(fieldOf(schema, 'flavor')._id, 'doc.article.flavor');
    });

    it('should give an array field and its subfields a full path id', function() {
      const schema = apos.modules.article.schema;
      const pets = fieldOf(schema, 'pets');
      assert.equal(pets._id, 'doc.article.pets');
      assert.equal(fieldOf(pets.schema, 'petName')._id, 'doc.article.pets.petName');
    });

    it('should give an object field and its subfields a full path id', function() {
      const schema = apos.modules.article.schema;
      const favorite = fieldOf(schema, 'favorite');
      assert.equal(favorite._id, 'doc.article.favorite');
      assert.equal(
        fieldOf(favorite.schema, 'favoriteName')._id,
        'doc.article.favorite.favoriteName'
      );
    });

    it('should carry the full breadcrumb trail through nested array and object fields', function() {
      const favorite = fieldOf(apos.modules.article.schema, 'favorite');
      const toys = fieldOf(favorite.schema, 'toys');
      assert.equal(toys._id, 'doc.article.favorite.toys');
      assert.equal(
        fieldOf(toys.schema, 'toyLabel')._id,
        'doc.article.favorite.toys.toyLabel'
      );
    });

    it('should scope widget field ids by the widget type', function() {
      const schema = apos.modules['nested-widget'].schema;
      assert.equal(fieldOf(schema, 'flavor')._id, 'widget.nested.flavor');
      const pets = fieldOf(schema, 'pets');
      assert.equal(
        fieldOf(pets.schema, 'petName')._id,
        'widget.nested.pets.petName'
      );
    });

  });

  describe('id uniqueness', function() {

    it('should give identically defined fields in two doc types different ids', function() {
      const articleFlavor = fieldOf(apos.modules.article.schema, 'flavor');
      const dessertFlavor = fieldOf(apos.modules.dessert.schema, 'flavor');
      assert.notEqual(articleFlavor._id, dessertFlavor._id);
    });

    it('should give identically named doc and widget fields different ids', function() {
      const docFlavor = fieldOf(apos.modules.article.schema, 'flavor');
      const widgetFlavor = fieldOf(apos.modules['nested-widget'].schema, 'flavor');
      assert.notEqual(docFlavor._id, widgetFlavor._id);
    });

    it('should give every registered field in the app a unique id', function() {
      const fields = [];
      for (const manager of Object.values(apos.doc.managers)) {
        collectFields(manager.schema, fields);
      }
      for (const manager of Object.values(apos.area.widgetManagers)) {
        collectFields(manager.schema, fields);
      }
      const missing = fields.filter(field => !field._id);
      assert.deepEqual(
        missing.map(field => field.name),
        [],
        'every registered field should have an _id'
      );
      const seen = new Map();
      const duplicates = [];
      for (const field of fields) {
        if (seen.has(field._id) && (seen.get(field._id) !== field)) {
          duplicates.push(field._id);
        }
        seen.set(field._id, field);
      }
      assert.deepEqual(duplicates, [], 'field ids should not collide');
    });

    it('should look up each field by its own id via getFieldById', function() {
      const pets = fieldOf(apos.modules.article.schema, 'pets');
      const petName = fieldOf(pets.schema, 'petName');
      assert.equal(apos.schema.getFieldById(petName._id), petName);
      assert.equal(
        apos.schema.getFieldById('doc.dessert.pets.petName'),
        fieldOf(fieldOf(apos.modules.dessert.schema, 'pets').schema, 'petName')
      );
    });

  });

  describe('getFieldByRelativePath', function() {

    it('should resolve a sibling within the correct doc type', function() {
      const topping = fieldOf(apos.modules.article.schema, 'topping');
      const resolved = apos.schema.getFieldByRelativePath(topping._id, 'flavor');
      assert.equal(resolved._id, 'doc.article.flavor');
    });

    it('should resolve a sibling of an identically defined field in another doc type', function() {
      const topping = fieldOf(apos.modules.dessert.schema, 'topping');
      const resolved = apos.schema.getFieldByRelativePath(topping._id, 'flavor');
      // The two schemas are identical apart from the module they live in, so
      // this is the case most at risk of walking into the wrong doc type
      assert.equal(resolved._id, 'doc.dessert.flavor');
    });

    it('should resolve a parent field from inside an array in the correct doc type', function() {
      const pets = fieldOf(apos.modules.dessert.schema, 'pets');
      const petName = fieldOf(pets.schema, 'petName');
      const resolved = apos.schema.getFieldByRelativePath(petName._id, '<flavor');
      assert.equal(resolved._id, 'doc.dessert.flavor');
    });

    it('should throw for an unknown field id', function() {
      assert.throws(
        () => apos.schema.getFieldByRelativePath('doc.article.nonesuch', 'flavor'),
        /no such field id/
      );
    });

  });

  describe('register', function() {

    it('should refuse to register a schema without a parentPath', function() {
      assert.throws(
        () => apos.schema.register('doc', 'article', []),
        /parentPath/
      );
    });

  });

  describe('scoped array and object names', function() {

    // These are persisted on array items and objects inside stored documents,
    // so they intentionally keep the legacy flat form and continue to honor
    // arrayName and objectName. Changing them is a data migration, not a
    // refactor. See the _id tests above for the newer path based scheme.
    it('should honor arrayName in scopedArrayName', function() {
      const pets = fieldOf(apos.modules.article.schema, 'pets');
      assert.equal(pets.scopedArrayName, 'doc.article.critters');
      assert(apos.schema.getArrayManager('doc.article.critters'));
    });

    it('should honor objectName in scopedObjectName', function() {
      const favorite = fieldOf(apos.modules.article.schema, 'favorite');
      assert.equal(favorite.scopedObjectName, 'doc.article.preferred');
      assert(apos.schema.getObjectManager('doc.article.preferred'));
    });

    it('should fall back to the field name when no override is given', function() {
      const favorite = fieldOf(apos.modules.article.schema, 'favorite');
      const toys = fieldOf(favorite.schema, 'toys');
      assert.equal(toys.scopedArrayName, 'doc.article.toys');
      assert(apos.schema.getArrayManager('doc.article.toys'));
    });

    it('should keep the scoped name distinct from the field id', function() {
      const pets = fieldOf(apos.modules.article.schema, 'pets');
      assert.equal(pets._id, 'doc.article.pets');
      assert.equal(pets.scopedArrayName, 'doc.article.critters');
      assert.notEqual(pets._id, pets.scopedArrayName);
    });

  });

  describe('field ids over HTTP', function() {

    it('should accept a path style field id in a query string and follow the right sibling', async function() {
      const topping = fieldOf(apos.modules.article.schema, 'topping');
      const res = await apos.http.get(
        `/api/v1/@apostrophecms/schema/choices?fieldId=${encodeURIComponent(topping._id)}&docId=some-doc-id`,
        {}
      );
      assert.deepEqual(res.choices, [
        {
          value: 'article',
          label: 'article:flavor'
        }
      ]);
    });

    it('should reach the right module for an identically defined field in another doc type', async function() {
      const topping = fieldOf(apos.modules.dessert.schema, 'topping');
      const res = await apos.http.get(
        `/api/v1/@apostrophecms/schema/choices?fieldId=${encodeURIComponent(topping._id)}&docId=some-doc-id`,
        {}
      );
      assert.deepEqual(res.choices, [
        {
          value: 'dessert',
          label: 'dessert:flavor'
        }
      ]);
    });

  });

});

// A field id must depend only on where the field sits in the schema tree, not
// on the rest of its definition. Processes running slightly different code, as
// during a rolling deploy, have to agree on ids for a field id held by the
// browser to stay meaningful.
describe('Schema - field id stability', function() {

  this.timeout(t.timeout);

  let apos;

  after(async function() {
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        // Same module name and same field names as the suite above, but every
        // other property of every field is different
        article: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              flavor: {
                type: 'string',
                label: 'A Totally Different Label',
                help: 'Help text that did not exist before',
                def: 'vanilla'
              },
              pets: {
                type: 'array',
                label: 'Renamed Pets',
                arrayName: 'critters',
                fields: {
                  add: {
                    petName: {
                      type: 'string',
                      label: 'Renamed Pet Name',
                      required: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  it('should not change a field id when unrelated properties of the field change', function() {
    const schema = apos.modules.article.schema;
    const flavor = schema.find(field => field.name === 'flavor');
    const pets = schema.find(field => field.name === 'pets');
    const petName = pets.schema.find(field => field.name === 'petName');
    assert.equal(flavor._id, 'doc.article.flavor');
    assert.equal(pets._id, 'doc.article.pets');
    assert.equal(petName._id, 'doc.article.pets.petName');
  });

});
