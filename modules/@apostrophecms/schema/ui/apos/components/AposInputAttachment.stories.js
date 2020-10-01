import {
  withKnobs,
  select,
  boolean
} from '@storybook/addon-knobs';

export default {
  title: 'Input (Attachment)',
  decorators: [ withKnobs ]
};

export const attachmentInput = () => {
  const isDisabled = boolean('Disabled', false);
  const limit = select(
    'Limit', {
      None: false,
      One: 1,
      Two: 2,
      Three: 3,
      Four: 4,
      Five: 5,
      Six: 6
    },
    6
  );

  return {
    data () {
      return {
        field: {
          name: 'resume',
          label: 'Attach a resume',
          help: 'Acceptable file types are doc, pdf, or json',
          type: 'attachment',
          limit,
          disabled: isDisabled
        },
        value: {
          data: {
            extension: 'xls',
            title: 'very good spreadsheet',
            _id: 'welkfnw;elfkn',
            length: { size: 1020068 },
            url: '/some-url'
          }
        }
      };
    },
    template: `
      <AposInputAttachment
        :field="field"
        :value="value"
      />`
  };
};
