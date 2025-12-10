module.exports = {
  improve: '@apostrophecms/global',
  options: {
    seoFields: false
  },
  fields(self, options) {
    const add = {
      robotsTxtSelection: {
        label: 'aposSeo:robotsTxtSelection',
        type: 'select',
        def: 'allow',
        help: 'aposSeo:robotsTxtSelectionHelp',
        choices: [
          {
            label: 'aposSeo:robotsTxtAllow',
            value: 'allow'
          },
          {
            label: 'aposSeo:robotsTxtDisallow',
            value: 'disallow'
          },
          {
            label: 'aposSeo:robotsTxtCustom',
            value: 'custom'
          }
        ]
      },
      robotsCustomText: {
        label: 'aposSeo:robotsCustomText',
        type: 'string',
        textarea: true,
        required: true,
        if: {
          robotsTxtSelection: 'custom'
        }
      }
    };
    const group = {
      seo: {
        label: 'aposSeo:group',
        fields: [ 'robotsTxtSelection', 'robotsCustomText' ],
        last: true
      }
    };

    if (options.seoGoogleTagManager) {
      add.seoGoogleTagManager = {
        label: 'aposSeo:gtmIdHelp',
        type: 'string',
        help: 'aposSeo:gtmIdHelp'
      };
      group.seo.fields.push('seoGoogleTagManager');
    }
    if (options.seoGoogleAnalytics) {
      add.seoGoogleTrackingId = {
        label: 'aposSeo:gaId',
        type: 'string',
        help: 'aposSeo:gaIdHelp'
      };
      group.seo.fields.push('seoGoogleTrackingId');
    }
    if (options.seoGoogleVerification) {
      add.seoGoogleVerificationId = {
        label: 'aposSeo:googleVerifyId',
        type: 'string',
        help: 'aposSeo:googleVerifyIdHelp'
      };
      group.seo.fields.push('seoGoogleVerificationId');
    }
    return Object.keys(add).length
      ? {
        add,
        group
      }
      : null;
  },
  apiRoutes(self) {
    return {
      get: {
        '/robots.txt': async (req) => {
          const criteria = {
            type: '@apostrophecms/global'
          };
          try {
            const globalDoc = await self.apos.doc.find(req, criteria).toObject();
            let robotsTxtContent = '';
            switch (globalDoc.robotsTxtSelection) {
              case 'allow':
                robotsTxtContent = 'User-agent: *\nDisallow: \n';
                break;
              case 'disallow':
                robotsTxtContent = 'User-agent: *\nDisallow: /\n';
                break;
              case 'custom':
                robotsTxtContent = globalDoc.robotsCustomText || 'User-agent: *\nDisallow: /\n';
                break;
              default:
                robotsTxtContent = 'User-agent: *\nDisallow: \n';
            }

            req.res.setHeader('Content-Type', 'text/plain');
            return robotsTxtContent;
          } catch (err) {
            console.error(err);
            return 'An error occurred generating robots.txt';
          }
        }
      }
    };
  }
};
