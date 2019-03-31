let request = require('request-promise');
let cheerio = require('cheerio');

module.exports = function(self, oembetter) {
  // Fake oembed for infogr.am
  oembetter.addBefore(async function(url, options, response, cb) {
    const parse = require('url').parse;
    const parsed = parse(url);
    let title;
    if (!oembetter.inDomain('infogr.am', parsed.hostname)) {
      return cb(null);
    }
    const matches = url.match(/infogr\.am\/([^?]+)/);
    if (!matches) {
      return cb(null);
    }
    const slug = matches[1];
    const anchorId = 'apos_infogram_anchor_0_' + slug;
    const body = await request(url);
    const $ = cheerio.load(body);
    const $title = $('title');
    title = $title.text();
    if (title) {
      title = title.trim();
    }
    return cb(null, url, options, { 
      thumbnail_url: 'https://infogr.am/infogram.png',
      title: title || 'Infogram',
      type: 'rich',
      html: '<div id="' + anchorId + '"></div>' + self.afterScriptLoads("//e.infogr.am/js/embed.js", anchorId, 'infogram_0_' + slug, ';')
    });
  });
};
