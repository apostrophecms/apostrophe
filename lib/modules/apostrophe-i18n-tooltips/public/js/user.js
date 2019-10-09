$(function() {

  var keys = false;
  var i18nMap = {};
  var i18nReverseMap = {};

  $('body').on('click', '[data-i18n-tooltips-activate]', function() {
    if (window.location.search && window.location.search.length) {
      window.location.search += '&i18nTooltips=1';
    } else {
      window.location.search = 'i18nTooltips=1';
    }
    return false;
  });

  $('body').on('click', '[data-i18n-tooltips-deactivate]', function() {
    if (window.location.search && window.location.search.length) {
      window.location.search += '&i18nTooltips=0';
    } else {
      window.location.search = 'i18nTooltips=0';
    }
    return false;
  });

  $('body').on('click', '[data-i18n-tooltips-toggle]', function() {
    keys = !keys;
    retrieve(function(err) {
      if (err) {
        apos.utils.error(err);
        return;
      }
      display();
      $('[data-i18n-tooltips-toggle]').removeClass('apos-active');
      if (keys) {
        $('[data-i18n-tooltips-toggle="keys"]').addClass('apos-active');
      } else {
        $('[data-i18n-tooltips-toggle="translations"]').addClass('apos-active');
      }
    });
    return false;
  });

  function retrieve(callback) {
    return apos.utils.post('/modules/apostrophe-templates/i18n-tooltips', {}, function(err, data) {
      if (err) {
        return callback(err);
      }
      i18nMap = data.tooltips;
      i18nReverseMap = _.invert(i18nMap);
      return callback(null);
    });
  }

  function display() {

    var map = i18nMap;
    var open = '⸨';
    var close = '⸩';
    var newOpen = '《'; 
    var newClose = '》';

    if (!keys) {
      map = i18nReverseMap;
      open = '《';
      close = '》';
      newOpen = '⸨';
      newClose = '⸩';
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
        var match = text.indexOf(open, i);
        if (match === -1) {
          break;
        }
        var end = text.indexOf(close, match);
        if (end === -1) {
          break;
        }
        var s = text.substring(match + 1, end);
        i = end + 1;

        if (map[s]) {
          text = text.substring(0, match) + newOpen + map[s] + newClose + text.substring(i);
          i += (map[s].length - s.length);
        }
      }
      textNode.textContent = text;
    }
  }
});

