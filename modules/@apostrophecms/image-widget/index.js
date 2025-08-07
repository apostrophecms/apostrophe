module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'apostrophe:image',
    className: false,
    icon: 'image-icon',
    dimensionAttrs: false,
    placeholder: true,
    initialModal: false,
    linkWithType: [ '@apostrophecms/any-page-type' ],
    // Should we write e.g. a reset style for the `figure` element?
    inlineStyles: true,
    components: {
      widget: 'AposImageWidget'
    }
  },
  widgetOperations(self, options) {
    const {
      relationshipEditor = 'AposImageRelationshipEditor',
      relationshipEditorLabel = 'apostrophe:editImageAdjustments',
      relationshipEditorIcon = 'image-edit-outline'
    } = options.apos.image.options || {};
    return {
      add: {
        adjustImage: {
          label: relationshipEditorLabel,
          icon: relationshipEditorIcon,
          modal: relationshipEditor,
          tooltip: relationshipEditorLabel,
          if: {
            '_image.0': {
              $exists: true
            }
          }
        }
      }
    };
  },
  fields(self, options) {
    const slugify = options.apos.util.slugify;
    const linkWithType = options.linkWithType;
    const linkWithTypeChoices = linkWithType
      .map(type => ({
        label: type,
        value: type
      }))
      .concat([
        {
          label: 'apostrophe:url',
          value: '_url'
        }
      ]);
    linkWithTypeChoices.unshift({
      label: 'apostrophe:none',
      value: 'none'
    });
    const linkWithTypeFields = linkWithType.reduce((fields, type) => {
      const name = `_${slugify(type)}`;
      fields[name] = {
        type: 'relationship',
        label: type,
        withType: type,
        required: true,
        max: 1,
        if: {
          linkTo: type
        }
      };
      return fields;
    }, {});
    const orTypes = linkWithType.map(type => ({
      linkTo: type
    }));

    return {
      add: {
        _image: {
          type: 'relationship',
          label: 'apostrophe:image',
          max: 1,
          required: true,
          withType: '@apostrophecms/image'
        },
        caption: {
          label: 'apostrophe:caption',
          type: 'string'
        },
        linkTo: {
          label: 'apostrophe:linkTo',
          type: 'select',
          choices: linkWithTypeChoices,
          def: 'none'
        },
        ...linkWithTypeFields,
        linkHref: {
          label: 'apostrophe:url',
          help: 'apostrophe:linkHrefHelp',
          type: 'string',
          required: true,
          if: {
            linkTo: '_url'
          }
        },
        linkHrefTitle: {
          label: 'apostrophe:linkTitle',
          type: 'string',
          if: {
            linkTo: '_url'
          }
        },
        linkTitle: {
          label: 'apostrophe:linkTitle',
          help: 'apostrophe:linkTitleRelHelp',
          type: 'string',
          if: {
            $or: orTypes
          }
        },
        linkTarget: {
          label: 'apostrophe:linkTarget',
          type: 'checkboxes',
          choices: [
            {
              label: 'apostrophe:openLinkInNewTab',
              value: '_blank'
            }
          ],
          if: {
            $or: orTypes.concat([
              {
                linkTo: '_url'
              }
            ])
          }
        }
      }
    };
  },
  init(self) {
    self.showPlaceholder = self.options.placeholder !== false;
    self.options.placeholder = true;
    self.determineBestAssetUrl('placeholder');
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        validateAndAddSchemaLabels() {
          self.validateAndAddSchemaLabels();
        }
      }
    };
  },
  methods(self) {
    return {
      validateAndAddSchemaLabels() {
        const linkWithType = self.options.linkWithType;

        for (const type of linkWithType) {
          if (!self.apos.modules[type]) {
            throw new Error(
              `The "linkWithType" option of ${self.__meta.name} contains an invalid module "${type}"`
            );
          }

          // Patch the schema label directly now that we have access to all modules
          const field = self.schema.find(field => field.name === `_${self.apos.util.slugify(type)}`);
          field.label = getLabel(type);

          const choice = self.schema.find(field => field.name === 'linkTo').choices
            .find(choice => choice.value === type);
          choice.label = getLabel(type);
        }

        function getLabel(type) {
          if ([ '@apostrophecms/any-page-type', '@apostrophecms/page' ].includes(type)) {
            return 'apostrophe:page';
          }
          return self.apos.modules[type].options?.label ?? type;
        }
      }
    };
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        return {
          ..._super(req),
          showPlaceholder: self.showPlaceholder,
          placeholderUrl: self.options.placeholderUrl
        };
      }
    };
  }
};
