// Provides the `@apostrophecms/video` widget, which displays videos, powered
// by [@apostrophecms/video-field](../@apostrophecms/video-field/index.html) and
// [@apostrophecms/oembed](../@apostrophecms/oembed/index.html). The video
// widget accepts the URL of a video on any website that supports the
// [oembed](http://oembed.com/) standard, including vimeo, YouTube, etc.
// In some cases the results are refined by oembetter filters configured
// by the `@apostrophecms/oembed` module. It is possible to configure new filters
// for that module to handle video sites that don't natively support oembed.
//
// Videos are not actually hosted or stored by Apostrophe.

const cheerio = require('cheerio');

module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:video',
    className: false,
    icon: 'play-box-icon',
    placeholder: true,
    placeholderClass: false,
    placeholderUrl: 'https://youtu.be/Q5UX9yexEyM'
  },
  fields: {
    add: {
      video: {
        type: 'oembed',
        name: 'video',
        oembedType: 'video',
        label: 'apostrophe:videoUrl',
        help: 'apostrophe:videoUrlHelp',
        required: true
      }
    }
  },
  apiRoutes(self) {
    return {
      get: {
        async render(req) {
          const url = self.apos.launder.url(req.query.url);
          if (!url) {
            console.error('throwing here');
            console.log(req.query);
            throw self.apos.error('invalid');
          }
          const oembed = await self.apos.oembed.query(req, url, { alwaysIframe: false });
          return self.renderOembed(oembed);
        }
      }
    }
  },
  extendMethods(self) {
    return {
      async load(_super, req, widgets) {
        await _super(req, widgets);
        for (const widget of widgets) {
          // If the cache already has it, skip the extra round trip to the server and
          // just render it now, otherwise wait for the player to call back so the page
          // is never completely blocked waiting for youtube, vimeo, etc.
          const key = widget.video + ':' + JSON.stringify({ alwaysIframe: false });
          const cached = await self.apos.cache.get('@apostrophecms/oembed', key);
          if (cached) {
            widget._rendered = await self.renderOembed(cached);
          }
        }
      }
    };
  },
  methods(self) {
    return {
      renderOembed(oembed) {
        // This is a port of the old player logic. We can now use cheerio server-side
        // thanks to modern aspect-ratio CSS
        const $inner = cheerio.load(oembed.html)(':first');
        $inner.removeAttr('width');
        $inner.removeAttr('height');
        if (oembed.width && oembed.height) {
          $inner.attr('style', `width: 100%; aspect-ratio: ${oembed.width} / ${oembed.height}`);
        }
        const markup = $inner.html();
        console.log(markup);
        return markup;
      }
    };
  }
};
