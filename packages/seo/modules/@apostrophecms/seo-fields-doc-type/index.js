const _ = require('lodash');

module.exports = {
  improve: '@apostrophecms/doc-type',
  fields(self, options) {
    if (options.seoFields === false) {
      return;
    }

    const configuration = {
      add: {
        seoTitle: {
          label: 'aposSeo:title',
          type: 'string',
          htmlHelp: 'aposSeo:titleHtmlHelp'
        },
        seoDescription: {
          label: 'aposSeo:description',
          type: 'string',
          htmlHelp: 'aposSeo:descriptionHtmlHelp'
        },
        seoRobots: {
          label: 'aposSeo:robots',
          htmlHelp: 'aposSeo:robotsHtmlHelp',
          type: 'checkboxes',
          choices: [
            {
              label: 'aposSeo:robotsNoFollow',
              value: 'nofollow'
            },
            {
              label: 'aposSeo:robotsNoIndex',
              value: 'noindex'
            }
          ]
        }
      },
      group: {
        seo: {
          label: 'aposSeo:group',
          fields: [
            'seoTitle',
            'seoDescription',
            'seoRobots'
          ],
          last: true
        }
      }
    };

    if (self.options.seoCanonicalTypes &&
      Array.isArray(self.options.seoCanonicalTypes) &&
      self.options.seoCanonicalTypes.length) {

      const req = options.apos.task.getReq();
      const choices = [];
      configuration.add.seoSelectType = {
        type: 'select',
        label: req.t('aposSeo:canonicalSelectType'),
        choices,
        def: null
      };
      configuration.group.seo.fields.push('seoSelectType');

      self.options.seoCanonicalTypes.forEach(canonicalType => {
        const name = canonicalType.split(/^apostrophecms\/|apostrophecms-pro\//)[1] || canonicalType;
        const fieldName = `_${_.camelCase(`seoCanonical ${name}`)}`;
        const { label: moduleName = name } = options.apos.modules[canonicalType] || {};
        const label = req.t('aposSeo:canonicalModule', { type: _.startCase(req.t(moduleName)) });
        const help = req.t('aposSeo:canonicalModuleHelp', { type: _.lowerCase(self.__meta.name) });

        choices.push({
          label: _.startCase(req.t(moduleName)),
          value: fieldName
        });
        configuration.add[fieldName] = {
          help,
          label,
          max: 1,
          type: 'relationship',
          withType: canonicalType,
          builders: {
            project: {
              title: 1,
              slug: 1,
              _url: 1
            }
          },
          if: {
            seoSelectType: fieldName
          }
        };

        configuration.group.seo.fields.push(fieldName);
      });
    }

    return configuration;
  }
};
