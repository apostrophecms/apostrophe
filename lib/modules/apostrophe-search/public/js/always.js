$(function() {
  $('body').on('click', '[data-apos-search-filter]', function() {
    $(this).closest('form').submit();
  });
  $('body').on('keyup', '[data-apos-search-field]', function (e) {
    if (e.keyCode === 13) {
      $(this).closest('form').submit();
      return false;
    }
  });
});

apos.on('notfound', function(info) {
  $(function() {
    var url = '/search';
    if (apos.searchSuggestions === false) {
      // Explicitly disabled
      return;
    }
    if (apos.searchSuggestions && apos.searchSuggestions.url) {
      url = apos.searchSuggestions.url;
    }
    $.get(url, { q: info.suggestedSearch }, function(html) {
      $('[data-apos-notfound-search-results]').html(html);
    });
  });
});
