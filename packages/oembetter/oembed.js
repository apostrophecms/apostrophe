const fetch = require('node-fetch');
const { XMLParser } = require('fast-xml-parser');

const cheerio = require('cheerio');

let forceXml = false;

module.exports = oembed;

// The _canonical option is used internally to prevent
// infinite recursion when retrying with a canonical URL.
// Don't worry about it in your code.

async function oembed(url, options, endpoint, callback, _canonical) {

  let oUrl;

  try {
    const { canonical, url } = await discover();
    oUrl = url;
    if (canonical) {
      return oembed(canonical, options, endpoint, callback, true);
    }
    return callback(null, await retrieve());
  } catch (e) {
    return callback(e);
  }

  async function discover() {
    let resultUrl;
    // if we're being told the endpoint, use it
    if (endpoint) {
      if (!options) {
        options = {};
      }

      options.url = url;
      return { url: endpoint };
    }

    // otherwise discover it
    const body = await get(url, {
      headers: Object.assign({
        'User-Agent': 'oembetter'
      }, options.headers || {})
    });
    const $ = cheerio.load(body);

    // <link rel="alternate" type="application/json+oembed" href="http://www.youtube.com/oembed?format=json&amp;url=http%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dzsl_auoGuy4" title="An Engineer&#39;s Guide to Cats 2.0 - The Sequel">

    // Allow for all the dumb stuff we've seen.
    // (Only application/json+oembed and
    // text/xmloembed are in the standard.)

    const ideas = [
      'link[type="application/json+oembed"]',
      'link[type="text/json+oembed"]',
      'link[type="application/xml+oembed"]',
      'link[type="text/xml+oembed"]'
    ];

    for (let i = 0; (i < ideas.length); i++) {
      const linkUrl = $(ideas[i]).attr('href');
      if (linkUrl) {
        resultUrl = new URL(linkUrl, url);
        if (resultUrl.protocol === 'http:') {
          // Fix for YouTube's bug 12/15/20: issuing HTTP discovery URLs
          // but flunking them with a 403 when they arrive
          if (resultUrl.hostname.match(/youtube/) && resultUrl.hostname.match(/^http:/)) {
            resultUrl.protocol = 'https';
          }
        }
        break;
      }
    }

    if (!resultUrl) {
      if (!_canonical) {
        // No oembed information here, however if
        // there is a canonical URL retry with that instead
        const canonical = $('link[rel="canonical"]').attr('href');
        if (canonical && (canonical !== url)) {
          return { canonical };
        }
      }
      throw new Error('no oembed discovery information available');
    }
    return { url: resultUrl.toString() };
  }

  async function retrieve() {
    // Just for testing - a lot of modern services
    // default to JSON and we want to make sure we
    // still test XML too
    if (forceXml) {
      oUrl = oUrl.replace('json', 'xml');
    }
    if (options) {
      // make sure parsed.query is an object by passing true as
      // second argument
      const parsed = new URL(oUrl, url);
      const keys = Object.keys(options);
      keys.forEach(function(key) {
        if (key !== 'headers') {
          parsed.searchParams.set(key, options[key]);
        }
      });
      // Clean up things url.format defaults to if they are already there,
      // ensuring that parsed.query is actually used
      delete parsed.href;
      delete parsed.search;
      oUrl = parsed.toString();
    }
    const body = await get(oUrl, {
      headers: Object.assign({
        'User-Agent': 'oembetter'
      }, options.headers || {})
    });
    if (body[0] === '<') {
      return parseXmlString(body);
    } else {
      return JSON.parse(body);
    }
  }
};

async function get(url, options) {
  const response = await fetch(url, options);
  if (response.status >= 400) {
    throw response;
  }
  return response.text();
}

async function parseXmlString(body) {
  const parser = new XMLParser();
  const response = parser.parse(body);
  if (!response.oembed) {
    throw new Error('XML response lacks oembed element');
  }
  const result = response.oembed;
  result._xml = true;
  return result;
}

// For testing
module.exports.setForceXml = function(flag) {
  forceXml = flag;
};
