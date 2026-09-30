module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'jsxFieldTest',
    name: 'jsx-field-test',
    label: 'JSX Field Test'
  },
  fields: {
    add: {
      body: {
        type: 'richText',
        label: 'Body'
      },
      name: {
        type: 'string',
        label: 'Name'
      },
      wordCount: {
        type: 'integer',
        label: 'Word Count'
      },
      main: {
        type: 'area',
        label: 'Main',
        options: {
          widgets: {
            '@apostrophecms/rich-text': {}
          }
        }
      },
      sections: {
        type: 'array',
        label: 'Sections',
        fields: {
          add: {
            caption: {
              type: 'string',
              label: 'Caption'
            }
          }
        }
      }
    }
  }
};
