const fs = require('fs');
const path = require('path');

module.exports = {
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  options: {
    // 1 year. Do not include subdomains as they could be unrelated sites
    'Strict-Transport-Security': 'max-age=31536000',
    // You may also set to DENY, if you are not using features that
    // iframe the site within itself, but that can be useful
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    // Very new. Used to entirely disable browser features like geolocation.
    // Since we don't know what your site uses, we don't try to set this
    // header by default (false means "don't send the header")
    'Permissions-Policy': false,
    // Don't send a "Referer" (sp) header unless the new URL shares the same
    // origin. You can set this to `false` if you prefer cross-origin "Referer"
    // headers be sent. Apostrophe does not rely on them.
    'Referrer-Policy': 'same-origin',
    // `true` means it should be computed according to the `policies` option,
    // which receives defaults from the `minimumPolicies` option. You may also
    // pass your own string, which disables all `policies` sub-options and just
    // sends that string, or `false` to not send this header at all.
    'Content-Security-Policy': true,

    minimumPolicies: {
      general: {
        'default-src': 'HOSTS',
        // Because it is necessary for some of the output of the tiptap
        // rich text editor shipped with Apostrophe
        'style-src': 'HOSTS \'unsafe-inline\'',
        'script-src': 'HOSTS',
        'font-src': 'HOSTS',
        'img-src': 'HOSTS blob:',
        'frame-src': '\'self\''
      },

      // Set this sub-option to false if you wish to forbid google fonts
      googleFonts: {
        'style-src': 'fonts.googleapis.com',
        'font-src': 'fonts.gstatic.com'
      },

      oembed: {
        'frame-src': '*.youtube.com *.vimeo.com',
        'img-src': '*.ytimg.com'
      },

      analytics: {
        'default-src': '*.google-analytics.com *.doubleclick.net',
        // Note that use of google tag manager by definition brings in scripts from
        // more third party sites and you will need to add policies for them
        'script-src': '*.google-analytics.com *.doubleclick.net *.googletagmanager.com'
      }
    },

    policies: {}
  },

  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        determineSecurityHeaders() {
          self.securityHeaders = {};
          const simple = [
            'Strict-Transport-Security',
            'X-Frame-Options',
            'Referrer-Policy',
            'Permissions-Policy',
            'X-Content-Type-Options'
          ];
          for (const header of simple) {
            if (self.options[header]) {
              self.securityHeaders[header] = self.options[header];
            }
          }
          const hosts = self.legitimateHosts();
          if (self.options['Content-Security-Policy'] === true) {
            const hostsString = hosts.join(' ');
            const policies = {};
            const source = Object.assign({}, self.options.minimumPolicies, self.options.policies || {});
            for (const policy of Object.values(source)) {
              for (const [ key, val ] of Object.entries(policy)) {
                if (!policy) {
                  continue;
                }
                if (policies[key]) {
                  policies[key] += ` ${val}`;
                } else {
                  policies[key] = val;
                }
              }
            }
            let flatPolicies = [];
            for (const [ key, val ] of Object.entries(policies)) {
              // Merge hosts and permissions from several 'style-src', 'default-src', etc.
              // spread over different policies like defaultPolicies and googleFontsPolicies
              const words = val.split(/\s+/);
              const newWords = [];
              for (const word of words) {
                if (!newWords.includes(word)) {
                  newWords.push(word);
                }
              }
              flatPolicies.push(`${key} ${newWords.join(' ')}`);
            }
            flatPolicies = flatPolicies.map(policy => policy.replace(/HOSTS/g, hostsString));
            self.securityHeaders['Content-Security-Policy'] = flatPolicies.join('; ');
          } else if (self.options['Content-Security-Policy']) {
            self.securityHeaders['Content-Security-Policy'] = self.options['Content-Security-Policy'];
          }
        }
      }
    };
  },

  middleware(self) {
    return {
      sendHeaders(req, res, next) {
        req.nonce = self.apos.util.generateId();
        // For performance we precomputed everything
        for (let [ key, value ] of Object.entries(self.securityHeaders)) {
          if (key === 'Content-Security-Policy') {
            // We can't precompute the nonce because it is per-request
            value = value.replace('script-src ', `script-src 'nonce-${req.nonce}' `);
          }
          res.setHeader(key, value);
        }
        return next();
      }
    };
  },

  methods(self) {
    return {
      legitimateHosts() {
        if (self.options.legitimateHosts) {
          return self.options.legitimateHosts;
        }
        const hosts = [];
        if (self.apos.baseUrl) {
          hosts.push(self.parseHostname(self.apos.baseUrl));
        }
        for (const locale of Object.values(self.apos.i18n.locales)) {
          if (locale.hostname) {
            hosts.push(locale.hostname);
          }
        }
        const mediaUrl = self.apos.attachment.uploadfs.getUrl();
        if (mediaUrl.includes('//')) {
          hosts.push(self.parseHostname(mediaUrl));
        }
        // Inner quotes intentional
        hosts.push('\'self\'');
        // Keep unique
        return Array.from(new Set(hosts));
      },
      parseHostname(url) {
        const parsed = new URL(url);
        return parsed.hostname;
      }
    };
  }
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}
