// This player is much simpler now because oembed responses are
// manipulated with cheerio on the server side, which allows us
// to eliminate a round trip in cases where the response is
// already cached

export default () => {
  apos.util.widgetPlayers['@apostrophecms/video'] = {
    selector: '[data-apos-video-widget]',
    player: async (el) => {
      const videoUrl = el.getAttribute('data-apos-video-url');

      if (!videoUrl) {
        return;
      }

      if (el.firstElementChild) {
        // The server had the oembed response cached,
        // so the adjusted response has already been inlined
        return;
      }

      try {
        apos.util.addClass(el, 'apos-oembed-busy');
        const result = await apos.http.get('/api/v1/@apostrophecms/video-widget/render', {
          qs: {
            url: videoUrl
          }
        });
        el.innerHTML = result;
      } catch (e) {
        apos.util.removeClass(el, 'apos-oembed-busy');
        apos.util.addClass(el, 'apos-oembed-invalid');
        console.error(e);
        if (e !== 'undefined') {
          el.innerHTML = '<p>Error loading video</p>';
        } else {
          el.innerHTML = '';
        }
      }
    }
  };
};
