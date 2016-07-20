var page = require('webpage').create();
var url = 'http://localhost:3000/modules/apostrophe-documentation/scripts';
page.onConsoleMessage = function(msg, lineNum, sourceId) {
  console.log(msg);
};
page.open(url, function (status) {
  console.log('in callback');
  if ( status !== "success" ) {
    console.log('status was', status);
    throw status;
  }
  setTimeout(function() {
    console.log('exiting');
    phantom.exit();
  }, 5000);
});


