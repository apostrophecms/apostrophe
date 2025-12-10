const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Schema - follow ancestor fields', function() {

  let apos;
  this.timeout(t.timeout);
  this.slow(2000);

  beforeEach(async function() {
    return t.destroy(apos);
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('should follow a parent field in array and object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        household: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'household'
          },
          fields: {
            add: {
              petPreference: {
                type: 'select',
                label: 'Pet Preference',
                choices: [
                  {
                    value: 'cats',
                    label: 'Cats'
                  },
                  {
                    value: 'dogs',
                    label: 'Dogs'
                  }
                ],
                required: true
              },
              pets: {
                type: 'array',
                label: 'Pets',
                fields: {
                  add: {
                    name: {
                      type: 'string',
                      label: 'Name',
                      // Follow one level up
                      following: [ '<petPreference' ]
                    }
                  }
                }
              },
              favoritePet: {
                type: 'object',
                label: 'Favorite Pet',
                fields: {
                  add: {
                    name: {
                      type: 'string',
                      label: 'Name',
                      // Follow one level up
                      following: [ '<petPreference' ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    const schema = apos.modules.household.schema;
    const petField = schema.find(field => field.name === 'pets');
    const favPetField = schema.find(field => field.name === 'favoritePet');
    assert(petField);
    assert.deepEqual(petField.following, [ 'petPreference' ]);
    assert(favPetField);
    assert.deepEqual(favPetField.following, [ 'petPreference' ]);
  });

  it('should follow a grand parent field in array and object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        household: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'household'
          },
          fields: {
            add: {
              petPreference: {
                type: 'select',
                label: 'Pet Preference',
                choices: [
                  {
                    value: 'cats',
                    label: 'Cats'
                  },
                  {
                    value: 'dogs',
                    label: 'Dogs'
                  }
                ],
                required: true
              },
              rooms: {
                type: 'array',
                label: 'Rooms',
                fields: {
                  add: {
                    pets: {
                      type: 'array',
                      label: 'Pets',
                      fields: {
                        add: {
                          name: {
                            type: 'string',
                            label: 'Name',
                            // Follow two levels up
                            following: [ '<<petPreference' ]
                          }
                        }
                      }
                    },
                    favoritePet: {
                      type: 'object',
                      label: 'Favorite Pet',
                      fields: {
                        add: {
                          name: {
                            type: 'string',
                            label: 'Name',
                            // Follow two levels up
                            following: [ '<<petPreference' ]
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    const schema = apos.modules.household.schema;
    const rooms = schema.find(field => field.name === 'rooms');
    assert(rooms);
    assert.deepEqual(rooms.following, [ 'petPreference' ]);

    const petField = rooms.schema.find(field => field.name === 'pets');
    const favPetField = rooms.schema.find(field => field.name === 'favoritePet');
    assert(petField);
    assert.deepEqual(petField.following, [ '<petPreference' ]);
    assert(favPetField);
    assert.deepEqual(favPetField.following, [ '<petPreference' ]);
  });
});
