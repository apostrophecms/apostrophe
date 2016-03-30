module.exports = function(self, cursor) {

  cursor.addFilter('minimumSize', {
    finalize: function() {
      var minimumSize = self.get('minimumSize');
      if (!minimumSize) {
        return;
      }
      var criteria = {};
      criteria['attachment.width'] = minimumSize[0];
      criteria['attachment.height'] = minimumSize[1];
      self.and(criteria);
    },
    safeFor: 'public',
    launder: function(a) {
      if (!Array.isArray(a)) {
        return [ 0, 0 ];
      }
      if (a.length === 2) {
        return [ 0, 0 ];
      }
      return [ self.apos.launder.integer(a[0]), self.apos.launder.integer(a[1]) ];
    }
  });

  cursor.addFilter('aspectRatio', {
    finalize: function() {
      var aspectRatio = self.get('aspectRatio');
      try {
        aspectRatio = aspectRatio[0] / aspectRatio[1];
      } catch (e) {
        // Bad denominator, ignore
        return;
      }
      var criteria = {};
      criteria['attachment.aspectRatio'] = aspectRatio;
      self.and(criteria);
    }
  });

};
