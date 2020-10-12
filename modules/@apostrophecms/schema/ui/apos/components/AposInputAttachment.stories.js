import {
  withKnobs,
  boolean
} from '@storybook/addon-knobs';

export default {
  title: 'Input (Attachment)',
  decorators: [ withKnobs ]
};

export const attachmentInput = () => {
  const isDisabled = boolean('Disabled', false);

  return {
    data () {
      return {
        field: {
          name: 'resume',
          label: 'Attach a resume',
          help: 'Acceptable file types are doc, pdf, or json',
          type: 'attachment',
          disabled: isDisabled
        },
        value: {
          data: {
            extension: 'xls',
            title: 'very good spreadsheet',
            _id: 'welkfnw;elfkn',
            length: { size: 1020068 },
            _url: '/some-url'
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
