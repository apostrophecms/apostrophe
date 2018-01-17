var async = require('async');
var request = require('request');
var cheerio = require('cheerio');

module.exports = function(self, oembetter) {
  // Fake oembed for wufoo
  oembetter.addBefore(function(url, options, response, mainCallback) {
    var who, what, title;
    return async.series({
      // If they used a pretty wufoo URL, we have to
      // fetch it and find the canonical URL in it first.
      canonicalize: function(callback) {
        var matches = url.match(/(\w+)\.wufoo\.com\/forms\/[\w]+-[\w-]+/);
        if (!matches) {
          return setImmediate(callback);
        }
        return request(url, function(err, response, body) {
          if (err) {
            return callback(err);
          }
          var matches = body.match(/"(https?:\/\/\w+\.wufoo\.com\/forms\/\w+)\/"/);
          if (matches) {
            url = matches[1];
          }
          return callback(null);
        });
      },
      canonical: function(callback) {
        // Is it a canonical Wufoo URL?
        var matches = url.match(/(\w+)\.wufoo\.com\/forms\/([\w]+)/);
        if (!matches) {
          // None of our beeswax
          return mainCallback(null);
        }
        who = matches[1];
        what = matches[2];
        return callback(null);
      },
      title: function(callback) {
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

          return callback(null);
        });
      }
    }, function(err) {
      if (err) {
        return mainCallback(err);
      }
      // wufoo embed code as of 2014-07-16. -Tom
      return mainCallback(null, url, options, { type: 'rich',
        html:
        '<div id="wufoo-' + what + '"></div>' +
        self.afterScriptLoads('//wufoo.com/scripts/embed/form.js', false, false,
          'var s = d.createElement(t), options = {' +
          "'userName':'" + who + "'," +
          "'formHash':'" + what + "'," +
          "'autoResize':true," +
          "'height':'363'," +
          "'async':true," +
          "'host':'wufoo.com'," +
          "'header':'show'," +
          "'ssl':true};" +
          "try { " + what + " = new WufooForm();" + what + ".initialize(options);" + what + ".display(); } catch (e) {};"),
        title: title || 'Wufoo Form',
        thumbnail_url: 'https://www.wufoo.com/images/v3/home/banner.jpg'
      });
    });
  });
};
