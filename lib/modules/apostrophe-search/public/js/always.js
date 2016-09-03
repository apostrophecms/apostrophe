$(function() {
  $('body').on('click', '[data-apos-search-filter]', function() {
    $(this).closest('form').submit();
  });
  $('body').on('keyup', '[data-apos-search-field]', function (e) {
    if (e.keyCode == 13) {
      $(this).closest('form').submit();
      return false;
    }
  });
});

apos.on('notfound', function(info) {
  $(function() {
    $.get('/search', { q: info.suggestedSearch }, function(html) {
      $('[data-apos-notfound-search-results]').html(html);
    });
  });
});
