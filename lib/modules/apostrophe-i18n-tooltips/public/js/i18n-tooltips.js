apos.on('ready', function() {
  apos.utils.post('/modules/apostrophe-templates/i18n-tooltips', {}, function(err, data) {
    if (err) {
      return apos.utils.error(err);
    }
    var walker = document.createTreeWalker(
      document.body, 
      NodeFilter.SHOW_TEXT, 
      null, 
      false
    );

    var textNode;
    var textNodes = [];

    while (textNode = walker.nextNode()) {
      var text = textNode.textContent;
      var i = 0;
      while (true) {
        var match = text.indexOf('⸨', i);
        if (match === -1) {
          break;
        }
        var end = text.indexOf('⸩', match);
        if (end === -1) {
          break;
        }
        var s = text.substring(match + 1, end);
        i = end + 1;
        if (data.tooltips[s]) {
          console.log(s + ' -> ' + data.tooltips[s]);
        }
      }
    }
  });
});

