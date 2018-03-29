_.extend(apos, {
  enableHtmlPageId: function() {
    if (apos.htmlPageId) {
      $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
        if (!options.crossDomain) {
          jqXHR.setRequestHeader('Apostrophe-Html-Page-Id', apos.htmlPageId);
        }
      });
    }
  }
});
