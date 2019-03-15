var request = require('request-promise');
var cheerio = require('cheerio');

module.exports = function(self, oembetter) {
  // Fake oembed for wufoo
  oembetter.addBefore(async function(url, options, response, cb) {
    let who, what, title;
    // If they used a pretty wufoo URL, we have to
    // fetch it and find the canonical URL in it first.
    let matches = url.match(/(\w+)\.wufoo\.com\/forms\/[\w]+-[\w-]+/);
    if (matches) {
      const body = await request(url);
      const matches = body.match(/"(https?:\/\/\w+\.wufoo\.com\/forms\/\w+)\/"/);
      if (matches) {
        url = matches[1];
      }
    }
    // OK, now is it a canonical Wufoo URL?
    matches = url.match(/(\w+)\.wufoo\.com\/forms\/([\w]+)/);
    if (!matches) {
      // None of our beeswax
      return cb(null);
    }
    who = matches[1];
    what = matches[2];
    const body = await request(url);
    var $ = cheerio.load(body);
    var $title = $('title');
    title = $title.text();
    if (title) {
      title = title.trim();
    }
    // wufoo embed code as of 2014-07-16. -Tom
    return cb(null, url, options, {
      type: 'rich',
      html:
        `<div id="wufoo-${what}"></div>'` +
        self.afterScriptLoads('//wufoo.com/scripts/embed/form.js', false, false,
          `var s = d.createElement(t), options = {
          'userName': '${who}',
          'formHash': '${what}',
          'autoResize': true,
          'height': '363',
          'async': 'true',
          'host': 'wufoo.com',
          'header': 'show',
          'ssl': true
        };
        try {
          ${what} = new WufooForm();
          ${what}.initialize(options);
          ${what}.display();
        } catch (e) {};`),
      title: title || 'Wufoo Form',
      thumbnail_url: 'https://www.wufoo.com/images/v3/home/banner.jpg'
    });
  });
};
