_.extend(apos, {
  enableHtmlPageId: function() {
    if (apos.htmlPageId) {
      $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
        jqXHR.setRequestHeader('Apostrophe-Html-Page-Id', apos.htmlPageId);
      });
    }
  }
});
