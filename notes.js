// we don't need chainable methods for type-specific
// features like "upcoming" in a generic apos.docs.get.
//
// we do need type-specific joins in apos.docs.get.
//
// we do want chainable methods as a replacement
// for the "options" object in all get methods.
//
// we don't want to shovel state into _ properties.


// 0.5 way

events.find = function(req, crit, options, cb) {
  if (options.upcoming === true) {
    crit.startDate = { $gte: new Date() };
  }
  return apos.find(req, crit, options, cb);
}

events.save, events.update?



// ideas toward possible interfaces

// Fetch only snippets, and invoke upcoming(true) by default

events.find = function(req, crit) {
  crit = { $and: [ crit, { type: 'event' } ] };
  var cursor = apos.find(req, crit).upcoming(true);
  cursor.upcoming = function(flag) {
    cursor.state.set('upcoming', flag);
    return cursor;
  };
  cursor.sort(options.sort || { startDate: 1 });
  return cursor;
};

events.find(req, crit).sort({ startDate: -1 }).toArray()


apos.docs.extendCursor(
  'apostrophe-events.upcoming',
)

apos.docs.find()['apostrophe-events.upcoming'](true)

apos.events.find().upcoming(true);
apos.soirees.find().upcoming(true);

// Just before a toArray() does the actual work, take the
// settings we've attached to the cursor into account

snippets.beforeDocsHydrate = function(req, cursor) {
  if (cursor.state.find('upcoming') === true) {
    crit = apos.docs.andCriteria(crit, { startDate: { $gte: new Date() } });
  } else if (cursor.state.find('upcoming') === false) {
    crit = apos.docs.andCriteria(crit, { startDate: { $lt: new Date() } });
  }
}

// Do async things after a call to apos.docs.get

snippets.afterGetDocs = function(req, cursor, docs, callback) {
  if (!cursor._noJoins) {
    // Perform a join
  } else {
    return setImmediate(callback);
  }
};
