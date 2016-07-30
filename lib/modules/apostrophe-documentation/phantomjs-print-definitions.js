var page = require('webpage').create();
var url = 'http://localhost:3000/modules/apostrophe-documentation/scripts';
page.onConsoleMessage = function(msg, lineNum, sourceId) {
  console.log(msg);
};
page.open(url, function (status) {
  if ( status !== "success" ) {
    throw status;
  }
  setTimeout(function() {
    phantom.exit();
  }, 5000);
});


