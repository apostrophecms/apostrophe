module.exports = {
  extend: '@apostrophecms/widget-type',
  fields: {
    add: {
      columns: {
        type: 'integer'
      },
      desktop: {
        type: 'object',
        fields: {
          add: {
            rows: {
              type: 'integer',
              def: 1
            }
          }
        }
      },
      tablet: {
        type: 'object',
        fields: {
          add: {
            rows: {
              type: 'integer'
            }
          }
        }
      },
      mobile: {
        type: 'object',
        fields: {
          add: {
            rows: {
              type: 'integer'
            }
          }
        }
      }
    }
  }
};
