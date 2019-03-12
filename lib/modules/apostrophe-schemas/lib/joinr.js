const joinr = module.exports = {
  // Perform a one-to-one join with related documents.
  //
  // If you have events and wish to bring a place object into a ._place property
  // of each event based on a .placeId property, this is what you want.
  //
  // The first argument should be an array of documents already fetched.
  //
  // The second argument is the property in each of those documents that identifies
  // a related document (for instance, placeId).
  //
  // The third argument is the property name in which to store the related
  // document after fetching it (for instance, _place).
  //
  // The fourth argument is the function to call to fetch the related documents.
  // This function will receive an array of IDs and its awaited return value
  // must be an array of corresponding documents.
  //
  // Example:
  //
  // await joinr.oneToOne(items, 'placeId', '_place', async function(ids) {
  //   // returns promise for an array, same thing as awaiting
  //   return myCollection.find({ _id: { $in: ids } }).toArray();
  // });

  byOne: async function(items, idField, objectField, getterck) {
    const otherIds = [];
    const othersById = {};
    for (const item of items) {
      if (joinr._has(item, idField)) {
        otherIds.push(joinr._get(item, idField));
      }
    }
    if (otherIds.length) {
      const others = await getter(otherIds);
      // Make a lookup table of the others by id
      for (const other of others) {
        othersById[other._id] = other;
      }
      // Attach the others to the items
      for (const item of items) {
        const id = joinr._get(item, idField);
        if (id && othersById[id]) {
          item[objectField] = othersById[id];
        }
      }
    }
  },

  // Join with related documents where the id of documents in your collection
  // is stored in a property on the related side. Since more than one related
  // document might refer to each of your documents, the result is stored in
  // an array property of each document.
  //
  // If you have places and wish to retrieve all the events which have a
  // placeId property referring to those places, this is what you want.
  //
  // The first argument should be an array of documents already fetched.
  //
  // The second argument is the property in each of the related documents
  // that identifies documents in your original collection (for instance, placeId).
  //
  // The third argument is the array property name in which to store the related
  // documents after fetching them (for instance, _events).
  //
  // The fourth argument is the async function to call to fetch the related documents.
  // This function will receive an array of IDs. These IDs refer to documents in
  // your original collection. Its return value will be awaited, and the result must
  // be an array of documents.
  //
  // The related documents will be attached directly to `items` under the
  // property name specified by `objectField`.
  //
  // Example:
  //
  // await joinr.byOneReverse(items, 'placeId', '_place', async function(ids) {
  //   // returns a promise, as good as awaiting
  //   return myCollection.find({ placeId: { $in: ids } }).toArray();
  // });

  byOneReverse: async function(items, idField, objectsField, getter) {
    const itemIds = items.map(item => item._id);
    if (itemIds.length) {
      const others = await getter(itemIds);
      const itemsById = {};
      for (const item of items) {
        itemsById[item._id] = item;
      }
      // Attach the others to the items
      for (const other of others) {
        if (joinr._has(other, idField)) {
          const id = joinr._get(other, idField);
          if (itemsById[id]) {
            const item = itemsById[id];
            if (!item[objectsField]) {
              item[objectsField] = [];
            }
            item[objectsField].push(other);
          }
        }
      }
    }
  },

  // Perform a one-to-many join with related documents via an array property
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
  // The optional third argument is the name of an object property in each of
  // those documents that describes the relationship between the document and each
  // of the related documents. This object is expected to be structured like this:
  //
  // personRelationships: {
  //   idOfPerson1: {
  //     jobTitle: 'Chief Cook'
  //   },
  //   idOfPerson2: {
  //     jobTitle: 'Chief Bottle Washer'
  //   }
  // }
  //
  // The fourth argument is the array property name in which to store the related
  // documents after fetching them (for instance, _groups).
  //
  // The fifth argument is the function to call to fetch the related documents.
  // This function will receive an array of IDs and its awaited return value
  // must be an array of documents.
  //
  // Afterwards the related documents will be attached directly to the items under the
  // array property name specified by objectsField.
  //
  // *If the relationshipsField argument is present*, the related documents
  // are returned as usual, with an additional `_relationship` property added to
  // each, containing the relationship data for that object.
  //
  // group._people[0].name <-- Person's name
  // group._people[0]._relationship.jobTitle <-- Person's job title in
  //   this specific department; they may have other titles in other departments
  //
  // Since the same person may be related to more than one group, but with different
  // relationship data, this method guarantees that the person object will be
  // shallowly cloned so that it can have a distinct `_relationship` property.
  //
  // Example:
  //
  // await joinr.byArray(users, 'groupIds', '_groups', async function(ids) {
  //   // returns a promise, as good as awaiting
  //   return groupsCollection.find({ groupIds: { $in: ids } }).toArray();
  // });

  byArray: function(items, idsField, relationshipsField, objectsField, getter) {
    if (arguments.length === 4) {
      // Allow relationshipsField to be skipped
      getter = objectsField;
      objectsField = relationshipsField;
      relationshipsField = undefined;
    }
    const otherIds = [];
    const othersById = {};
    for (const item of items) {
      if (joinr._has(item, idsField)) {
        otherIds = otherIds.concat(joinr._get(item, idsField));
      }
    }
    if (otherIds.length) {
      const others = await getter(otherIds);
      // Make a lookup table of the others by id
      for (const other of others) {
        othersById[other._id] = other;
      }
      // Attach the others to the items
      for (const item of items) {
        for (const id of (joinr._get(item, idsField) || [])) {
          if (othersById[id]) {
            if (!item[objectsField]) {
              item[objectsField] = [];
            }
            if (relationshipsField) {
              const relationships = joinr._get(item, relationshipsField) || {};
              item[objectsField].push({
                ...item,
                _relationship: relationships[id] || {}
              });
            } else {
              item[objectsField].push(othersById[id]);
            }
          }
        }
      }
    }
  },

  // Perform a one-to-many join with related documents via an array property
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
  // personRelationships: {
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
  // Afterwards The related documents will be attached directly to the items under the
  // property name specified by `objectsField`.
  //
  // *If the relationshipsField argument is present*, then each related document
  // gains an extra `_relationship` property, containing the relationship data
  // for that object. Note that the related documents are shallowly cloned to
  // ensure the same document can be related to two items but with different
  // relationship data.
  //
  // group._people[0].name <-- person's name
  // group._people[0]._relationship.jobTitle <-- Person's job title in
  //   this specific department; they may have other titles in other departments
  //
  // Example:
  //
  // await joinr.byArrayReverse(groups, 'groupIds', '_users', async function(ids) {
  //   // returns a promise, as good as awaiting
  //   return usersCollection.find({ placeIds: { $in: ids } }).toArray();
  // });

  byArrayReverse: function(items, idsField, relationshipsField, objectsField, getter) {
    if (arguments.length === 4) {
      // Allow relationshipsField to be skipped
      getter = objectsField;
      objectsField = relationshipsField;
      relationshipsField = undefined;
    }
    const itemIds = items.map(item => item._id);
    if (itemIds.length) {
      const others = await getter(itemIds);
      const itemsById = {};
      for (const item of items) {
        itemsById[item._id] = item;
      }
      // Attach the others to the items
      for (const other of others) {
        for (const id of (joinr._get(other, idsField) || [])) {
          if (itemsById[id]) {
            const item = itemsById[id];
            if (!item[objectsField]) {
              item[objectsField] = [];
            }
            if (relationshipsField) {
              const relationships = joinr._get(other, relationshipsField) || {};
              item[objectsField].push({
                ...other,
                _relationship: relationships[item._id] || {}
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
    if (accessor === undefined) {
      throw new Error('I think you forgot to set idField or idsField, or you set the wrong one (use idField for byOne, idsField for byArray)');
    }
    return !!joinr._get(o, accessor);
  },

  // This supports: foo, foo.bar, foo.bar.baz (dot notation,
  // like mongodb) and also passing in a custom accessor function

  _get: function(o, accessor) {
    if (accessor === undefined) {
      throw new Error('I think you forgot to set idField or idsField, or you set the wrong one (use idField for byOne, idsField for byArray)');
    }
    var fn = accessor;
    if (typeof(accessor) === 'string') {
      fn = function(o) {
        var keys = accessor.split(/\./);
        for (const key of keys) {
          o = o[key];
        }
        return o;
      };
    }
    return fn(o);
  }
};

