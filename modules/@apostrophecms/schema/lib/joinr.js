const joinr = module.exports = {
  // Fetch a one-to-many relationship with related documents via an array property
  // of your documents.
  //
  // If you have users and wish to bring all associated groups into a
  // ._groups property based on a .groupIds array property, this is what
  // you want.
  //
  // The first argument should be an array of documents already fetched.
  //
  // The second argument is the name of an array property in each of those documents
  // that identifies related documents by id (for instance, groupIds).
  //
  // The third argument is the name of an object property in each of
  // those documents that describes the relationship between the document and each
  // of the related documents. This object is expected to be structured like this:
  //
  // personFields: {
  //   idOfPerson1: {
  //     jobTitle: 'Chief Cook'
  //   },
  //   idOfPerson2: {
  //     jobTitle: 'Chief Bottle Washer'
  //   }
  // }
  //
  // If no relationship fields are needed it may be falsy.
  //
  // The fourth argument is the array property name in which to store the related
  // documents after fetching them (for instance, _groups).
  //
  // The fifth argument is the function to call to fetch the related documents.
  // This function will receive an array of IDs and its awaited return value
  // must be an array of documents.
  //
  // The sixth argument is a function to transform each `_id`. This is
  // used to add or rewrite the locale suffix.
  //
  // Afterwards the related documents will be attached directly to the items under the
  // array property name specified by objectsField.
  //
  // *If the fieldsStorage argument is present*, the related documents
  // are returned as usual, with an additional `_fields` property added to
  // each, containing the custom relationship fields for that object.
  //
  // group._people[0].name <-- Person's name
  // group._people[0]._fields.jobTitle <-- Person's job title in
  //   this specific department; they may have other titles in other departments
  //
  // Since the same person may be related to more than one group, but with different
  // custom relationship fields, this method guarantees that the person object will be
  // shallowly cloned so that it can have a distinct `_fields` property.
  //
  // Example:
  //
  // await joinr.byArray(users, 'groupIds', '_groups', async function(ids) {
  //   // returns a promise, as good as awaiting
  //   return groupsCollection.find({ groupIds: { $in: ids } }).toArray();
  // });

  byArray: async function(items, idsStorage, fieldsStorage, objectsField, getter, idMapper) {
    let otherIds = [];
    const othersById = {};
    for (const item of items) {
      if (joinr._has(item, idsStorage)) {
        otherIds = otherIds.concat(joinr._get(item, idsStorage).map(idMapper));
      }
    }
    if (otherIds.length) {
      const others = await getter(otherIds);
      // Make a lookup table of the others by id
      for (const other of others) {
        othersById[idMapper(other._id)] = other;
      }
      // Attach the others to the items
      for (const item of items) {
        for (const id of (joinr._get(item, idsStorage) || []).map(idMapper)) {
          if (othersById[id]) {
            if (!item[objectsField]) {
              item[objectsField] = [];
            }
            if (fieldsStorage) {
              const fieldsById = joinr._get(item, fieldsStorage) || {};
              item[objectsField].push({
                ...othersById[id],
                _fields: fieldsById[id] || {}
              });
            } else {
              item[objectsField].push(othersById[id]);
            }
          }
        }
      }
    }
  },

  // Perform a one-to-many relationship with related documents via an array property
  // of the related documents.
  //
  // If you have groups and wish to bring all associated users into a
  // ._users property based on a .groupIds array property of those users,
  // this is what you want.
  //
  // The first argument should be an array of documents already fetched.
  //
  // The second argument is the array property in each of the related documents
  // that identifies documents in your original collection (for instance,
  // groupIds).
  //
  // The optional third argument is the name of an object property in each of
  // thoe related documents that describes the relationship between the related
  // document and each of your documents. This object is expected to be structured
  // like this:
  //
  // personFields: {
  //   idOfPerson1: {
  //     jobTitle: 'Chief Cook'
  //   },
  //   idOfPerson2: {
  //     jobTitle: 'Chief Bottle Washer'
  //   }
  // }
  //
  // The fourth argument is the array property name in which to store the related
  // documents after fetching them (for instance, _users).
  //
  // The fifth argument is the function to call to fetch the related documents.
  // This function will receive an array of IDs referring to documents in
  // your original collection. It will be awaited, and the resolved value must
  // be an array of documents.
  //
  // The sixth argument is a function to transform each `_id`. This is
  // used to add or rewrite the locale suffix.
  //
  // Afterwards The related documents will be attached directly to the items under the
  // property name specified by `objectsField`.
  //
  // *If the fieldsStorage argument is truthy*, then each related document
  // gains an extra `_fields` property, containing the relationship data
  // for that object. Note that the related documents are shallowly cloned to
  // ensure the same document can be related to two items but with different
  // relationship data.
  //
  // group._people[0].name <-- person's name
  // group._people[0]._fields.jobTitle <-- Person's job title in
  //   this specific department; they may have other titles in other departments
  //
  // Example:
  //
  // await joinr.byArrayReverse(groups, 'groupIds', '_users', async function(ids) {
  //   // returns a promise, as good as awaiting
  //   return usersCollection.find({ placeIds: { $in: ids } }).toArray();
  // });

  byArrayReverse: async function(items, idsStorage, fieldsStorage, objectsField, getter, idMapper) {
    const itemIds = items.map(item => idMapper(item._id));
    if (itemIds.length) {
      const others = await getter(itemIds);
      const itemsById = {};
      for (const item of items) {
        itemsById[idMapper(item._id)] = item;
      }
      // Attach the others to the items
      for (const other of others) {
        for (const id of (joinr._get(other, idsStorage) || []).map(idMapper)) {
          if (itemsById[id]) {
            const item = itemsById[id];
            if (!item[objectsField]) {
              item[objectsField] = [];
            }
            if (fieldsStorage) {
              const fieldsById = joinr._get(other, fieldsStorage) || {};
              item[objectsField].push({
                ...other,
                _fields: fieldsById[idMapper(item._id)] || {}
              });
            } else {
              item[objectsField].push(other);
            }
          }
        }
      }
    }
  },

  _has: function(o, accessor) {
    return !!joinr._get(o, accessor);
  },

  // This supports: foo, foo.bar, foo.bar.baz (dot notation,
  // like mongodb) and also passing in a custom accessor function

  _get: function(o, accessor) {
    let fn = accessor;
    if (typeof (accessor) === 'string') {
      fn = function(o) {
        const keys = accessor.split(/\./);
        for (const key of keys) {
          o = o[key];
        }
        return o;
      };
    }
    return fn(o);
  }
};
