module.exports = function(self, cursor) {

  cursor.addFilter('minSize', {
    finalize: function() {
      var minSize = cursor.get('minSize');
      if (!minSize) {
        console.log('there is no minimum size');
        return;
      }
      console.log('there is a minimum size');
      var criteria = {};
      criteria['attachment.width'] = { $gte: minSize[0] };
      criteria['attachment.height'] = { $gte: minSize[1] };
      cursor.and(criteria);
    },
    safeFor: 'public',
    launder: function(a) {
      if (!Array.isArray(a)) {
        return undefined;
      }
      if (a.length !== 2) {
        return undefined;
      }
      return [ self.apos.launder.integer(a[0]), self.apos.launder.integer(a[1]) ];
    }
  });

  // This is more hint than filter. It shouldn't affect the db query. -Tom
  // cursor.addFilter('aspectRatio', {
  //   finalize: function() {
  //     var aspectRatio = cursor.get('aspectRatio');
  //     try {
  //       aspectRatio = aspectRatio[0] / aspectRatio[1];
  //     } catch (e) {
  //       // Bad denominator, ignore
  //       return;
  //     }
  //     var criteria = {};
  //     criteria['attachment.aspectRatio'] = aspectRatio;
  //     self.and(criteria);
  //   },
  //   safeFor: 'public',
  //   launder: function(a) {
  //     if (!Array.isArray(a)) {
  //       return undefined;
  //     }
  //     if (a.length !== 2) {
  //       return undefined;
  //     }
  //     var numerator = self.apos.launder.integer(a[0]);
  //     var denominator = self.apos.launder.integer(a[1]);
  //     if (numerator <= 0) {
  //       return undefined;
  //     }
  //     if (denominator <= 0) {
  //       return undefined;
  //     }
  //     return [ numerator, denominator ];
  //   }
  // });

};
