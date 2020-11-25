apos.util.widgetPlayers['@apostrophecms/video'] = {
  selector: '[data-apos-video-widget]',
  player: function(el) {
    const videoUrl = el.getAttribute('data-apos-video-url');

    if (!videoUrl) {
      return;
    }

    queryAndPlay(el, {
      url: videoUrl,
      neverOpenGraph: 1
    });

    function queryAndPlay(el, options) {
      apos.util.removeClass(el, 'apos-oembed-invalid');
      apos.util.addClass(el, 'apos-oembed-busy');
      if (!options.url) {
        return fail('undefined');
      }
      return query(options, function(err, result) {
        if (err || (options.type && (result.type !== options.type))) {
          return fail(err || 'inappropriate');
        }
        apos.util.removeClass(el, 'apos-oembed-busy');
        return play(el, result);
      });
    }

    function query(options, callback) {
      const opts = {
        qs: {
          url: options.url
        }
      };
      return apos.http.get('/api/v1/@apostrophecms/oembed/query', opts, callback);
    }

    function play(el, result) {
      const shaker = document.createElement('div');
      shaker.innerHTML = result.html;
      const inner = shaker.firstChild;
      el.innerHTML = '';
      if (!inner) {
        return;
      }
      inner.removeAttribute('width');
      inner.removeAttribute('height');
      el.append(inner);
      // wait for CSS width to be known
      apos.util.onReady(function() {
        // If oembed results include width and height we can get the
        // video aspect ratio right
        if (result.width && result.height) {
          inner.style.width = '100%';
          inner.style.height = ((result.height / result.width) * inner.offsetWidth) + 'px';
        } else {
          // No, so assume the oembed HTML code is responsive.
        }
      });
    }

    function fail(err) {
      apos.util.removeClass(el, 'apos-oembed-busy');
      apos.util.addClass(el, 'apos-oembed-invalid');
      console.error(err);
      if (err !== 'undefined') {
        el.innerHTML = '<p>Error loading video</p>';
      } else {
        el.innerHTML = '';
      }
    }
  }
};
