apos.util.widgetPlayers['@apostrophecms/video'] = {
  selector: '[data-apos-video-widget]',
  player: function(el) {
    const videoUrl = el.getAttribute('data-apos-video-url');
    let queryResult;

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
        queryResult = result;
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
      inner.setAttribute('data-apos-video-canvas', '');
      el.innerHTML = '';
      if (!inner) {
        return;
      }
      inner.removeAttribute('width');
      inner.removeAttribute('height');
      el.append(inner);
      // wait for CSS width to be known
      setTimeout(function() {
        // If oembed results include width and height we can get the
        // video aspect ratio right
        if (result.width && result.height) {
          inner.style.width = '100%';
          resizeVideo(inner);
          // If we need to iniitally size the video, also resize it on window resize.
          window.addEventListener('resize', resizeHandler);
        } else {
          // No, so assume the oembed HTML code is responsive.
        }
      }, 0);
    }

    function resizeVideo(canvasEl) {
      canvasEl.style.height = ((queryResult.height / queryResult.width) * canvasEl.offsetWidth) + 'px';
    };

    function resizeHandler() {
      if (document.contains(el)) {
        resizeVideo(el.querySelector('[data-apos-video-canvas]'));
      } else {
        window.removeEventListener('resize', resizeHandler);
      }
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
