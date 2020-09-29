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

  const fileBank = [
    {
      ext: 'xls',
      title: 'very good spreadsheet',
      _id: 'welkfnw;elfkn',
      size: '102kb',
      url: '/some-url'
    },
    {
      ext: 'json',
      title: 'big big long title As far as we can estimate, the turnips could be said to resemble averse furs.',
      _id: 'wf;wf',
      size: '1.2mb',
      url: '/some-url'
    },
    {
      ext: 'key',
      title: 'fundraising deck',
      _id: 'wdddf;wf',
      size: '1.2mb',
      url: '/some-url'
    },
    {
      ext: 'doc',
      title: 'word doc',
      _id: 'wf;ffffwf',
      size: '1.2mb',
      url: '/some-url'
    },
    {
      ext: 'pdf',
      title: 'Big nasty pdf restaraunt menu',
      _id: 'wf;fffdddfwf',
      size: '8.2mb',
      url: '/some-url'
    }
  ];

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

  const files = select(
    'Number of Files', {
      None: null,
      One: 1,
      Two: 2,
      All: fileBank.length
    },
    fileBank.length
  );

  const fileValues = [];
  if (files) {
    for (let index = 0; index < files; index++) {
      fileValues.push(fileBank[index]);
    }
  }
  console.log('fileValues ====> ', fileValues)
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
          data: fileValues
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
