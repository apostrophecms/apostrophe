(function() {
  // Note: this script will not appear in the page in production.
  //
  // eslint-disable-next-line no-var
  var reloadId;
  // eslint-disable-next-line no-var
  var fast = '1';
  check();
  function check() {
    apos.http.get(document.querySelector('[data-apos-refresh-on-restart]').getAttribute('data-apos-refresh-on-restart'), {
      qs: {
        fast: fast
      }
    }, function(err, result) {
      if (err) {
        fast = '1';
        setTimeout(check, 1000);
        return;
      }
      fast = '';
      if (!reloadId) {
        reloadId = result;
      } else if (result !== reloadId) {
        console.log('Apostrophe restarted, refreshing the page');
        window.location.reload();
        return;
      }
      setTimeout(check, 1000);
    });
  }
})();
