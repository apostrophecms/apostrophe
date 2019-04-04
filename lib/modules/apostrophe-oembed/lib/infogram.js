var request = require('request');
var cheerio = require('cheerio');

module.exports = function(self, oembetter) {
  // Fake oembed for infogr.am
  oembetter.addBefore(function(url, options, response, callback) {
    var parse = require('url').parse;
    var parsed = parse(url);
    var title;
    if (!oembetter.inDomain('infogr.am', parsed.hostname)) {
      return setImmediate(callback);
    }
    var matches = url.match(/infogr\.am\/([^?]+)/);
    if (!matches) {
      return setImmediate(callback);
    }
    var slug = matches[1];
    var anchorId = 'apos_infogram_anchor_0_' + slug;
    return request(url, function(err, response, body) {
      if (err) {
        return callback(err);
      }
      var $ = cheerio.load(body);
      var $title = $('title');
      title = $title.text();
      if (title) {
        title = title.trim();
      }

      return callback(null, url, options, { thumbnail_url: 'https://infogr.am/infogram.png', title: title || 'Infogram', type: 'rich', html: '<div id="' + anchorId + '"></div>' + self.afterScriptLoads("//e.infogr.am/js/embed.js", anchorId, 'infogram_0_' + slug, ';')
      });
    });
  });
};
