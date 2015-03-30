var cursor = events.find(req);
cursor.upcoming(null).toArray...


events.find = function(req, criteria, projection) {

  var cursor = self.apos.docs.find(req, criteria, projection);

  cursor.addFilter({
    name: 'upcoming',
    // if you don't specify this, it's the default
    // behavior anyway
    setter: function(v) {
      cursor.setState('upcoming', v);
    },
    finalizer: function(cursor, /* callback */) {
      // finalizer
      var upcoming = cursor.get('upcoming');
      if (upcoming === undefined) {
        upcoming = true;
      }
      cursor.and({ startDate: { $gte: new Date() } });
    }
  });

  cursor.addFilter({
    name: 'join'
  });

};

events.hydrateDocs = function(req, cursor, docs, callback) {
  if (cursor.get('join') === false) {
    return setImmediate(callback);
  }
  return joinAllTheThings(docs, otherThings, callback);
};















// OR PERHAPS WE SHOULD JUST ENABLE THIS:

snippets.afterGetDocs = function(req, cursor, docs, callback) {
  if (!cursor._noJoins) {
    // Perform a join
  } else {
    return setImmediate(callback);
  }
};
