const assert = require('assert').strict;
const testUtil = require('apostrophe/test-lib/test');
const fileUtils = require('./lib/file-utils');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

describe('Forms module', function () {
  let apos;

  this.timeout(25000);

  after(function () {
    return testUtil.destroy(apos);
  });

  // Existence
  const formWidgets = {
    '@apostrophecms/form-widget': {},
    '@apostrophecms/form-text-field-widget': {},
    '@apostrophecms/form-textarea-field-widget': {},
    '@apostrophecms/form-select-field-widget': {},
    '@apostrophecms/form-radio-field-widget': {},
    '@apostrophecms/form-checkboxes-field-widget': {},
    '@apostrophecms/form-file-field-widget': {},
    '@apostrophecms/form-boolean-field-widget': {},
    '@apostrophecms/form-conditional-widget': {},
    '@apostrophecms/form-divider-widget': {},
    '@apostrophecms/form-group-widget': {}
  };

  let forms;
  let textWidgets;
  let textareaWidgets;
  let selectWidgets;
  let radioWidgets;
  let checkboxesWidgets;
  let fileWidgets;
  let booleanWidgets;
  let conditionalWidgets;
  let dividerWidgets;
  let groupWidgets;

  it('should be a property of the apos object', async function () {
    apos = await testUtil.create({
      shortname: 'formsTest',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 4242,
            csrfExceptions: [ '/api/v1/@apostrophecms/form-widget/upload' ],
            session: {
              secret: 'test-the-forms'
            },
            apiKeys: {
              skeleton_key: { role: 'admin' }
            }
          }
        },
        '@apostrophecms/form': {
          options: {
            formWidgets: {
              '@apostrophecms/form-text-field': {},
              '@apostrophecms/form-textarea-field': {},
              '@apostrophecms/form-select-field': {},
              '@apostrophecms/form-radio-field': {},
              '@apostrophecms/form-checkboxes-field': {},
              '@apostrophecms/form-file-field': {},
              '@apostrophecms/form-boolean-field': {},
              '@apostrophecms/form-conditional': {},
              '@apostrophecms/form-divider': {},
              '@apostrophecms/form-group': {}
            }
          }
        },
        ...formWidgets
      }
    });

    const aposForm = '@apostrophecms/form';
    forms = apos.modules[`${aposForm}`];
    const widgets = apos.modules[`${aposForm}-widget`];
    textWidgets = apos.modules[`${aposForm}-text-field-widget`];
    textareaWidgets = apos.modules[`${aposForm}-textarea-field-widget`];
    selectWidgets = apos.modules[`${aposForm}-select-field-widget`];
    radioWidgets = apos.modules[`${aposForm}-radio-field-widget`];
    checkboxesWidgets = apos.modules[`${aposForm}-checkboxes-field-widget`];
    fileWidgets = apos.modules[`${aposForm}-file-field-widget`];
    booleanWidgets = apos.modules[`${aposForm}-boolean-field-widget`];
    conditionalWidgets = apos.modules[`${aposForm}-conditional-widget`];
    dividerWidgets = apos.modules[`${aposForm}-divider-widget`];
    groupWidgets = apos.modules[`${aposForm}-group-widget`];

    assert(forms.__meta.name === `${aposForm}`);
    assert(widgets.__meta.name === `${aposForm}-widget`);
    assert(textWidgets.__meta.name === `${aposForm}-text-field-widget`);
    assert(textareaWidgets.__meta.name === `${aposForm}-textarea-field-widget`);
    assert(selectWidgets.__meta.name === `${aposForm}-select-field-widget`);
    assert(radioWidgets.__meta.name === `${aposForm}-radio-field-widget`);
    assert(checkboxesWidgets.__meta.name === `${aposForm}-checkboxes-field-widget`);
    assert(fileWidgets.__meta.name === `${aposForm}-file-field-widget`);
    assert(booleanWidgets.__meta.name === `${aposForm}-boolean-field-widget`);
    assert(conditionalWidgets.__meta.name === `${aposForm}-conditional-widget`);
    assert(dividerWidgets.__meta.name === `${aposForm}-divider-widget`);
    assert(groupWidgets.__meta.name === `${aposForm}-group-widget`);
  });

  // Submissions collection exists.
  it('should have a default collection for submissions', async function () {
    apos.db.collection('aposFormSubmissions', function (err, collection) {
      assert(!err);
      assert(collection);
    });
  });

  // Create a form
  const form1 = {
    _id: 'form1:en:published',
    archived: false,
    type: '@apostrophecms/form',
    title: 'First test form',
    slug: 'test-form-one',
    contents: {
      _id: 'form1ContentsArea890',
      metaType: 'area',
      items: [
        {
          _id: 'dogNameId',
          fieldLabel: 'Dog name',
          fieldName: 'DogName',
          required: true,
          type: '@apostrophecms/form-text-field'
        },
        {
          _id: 'dogTraitsId',
          fieldLabel: 'Check all that apply',
          fieldName: 'DogTraits',
          required: true,
          type: '@apostrophecms/form-checkboxes-field',
          choices: [
            {
              label: 'Runs fast',
              value: 'Runs fast'
            },
            {
              label: 'It\'s a dog',
              value: 'It\'s a dog'
            },
            {
              label: 'Likes treats',
              value: 'Likes treats'
            }
          ]
        },
        {
          _id: 'dogBreedId',
          fieldLabel: 'Dog breed',
          fieldName: 'DogBreed',
          required: false,
          type: '@apostrophecms/form-radio-field',
          choices: [
            {
              label: 'Irish Wolfhound',
              value: 'Irish Wolfhound'
            },
            {
              label: 'Cesky Terrier',
              value: 'Cesky Terrier'
            },
            {
              label: 'Dachshund',
              value: 'Dachshund'
            },
            {
              label: 'Pumi',
              value: 'Pumi'
            }
          ]
        },
        {
          _id: 'dogPhotoId',
          fieldLabel: 'Photo of your dog',
          fieldName: 'DogPhoto',
          required: false,
          type: '@apostrophecms/form-file-field'
        },
        {
          _id: 'agreeId',
          fieldLabel: 'Opt-in to participate',
          fieldName: 'agree',
          required: true,
          checked: false,
          type: '@apostrophecms/form-boolean-field'
        }
      ]
    },
    enableQueryParams: true,
    queryParamList: [
      {
        id: 'source',
        key: 'source'
      },
      {
        id: 'memberId',
        key: 'member-id',
        lengthLimit: 6
      }
    ]
  };

  let savedForm1;

  it('should create a form', async function () {
    const req = apos.task.getReq();

    await apos.doc.db.insertOne(form1);

    const form = await apos.doc.getManager('@apostrophecms/form').find(req, {}).toObject();

    savedForm1 = form;
    assert(form);
    assert(form.title === 'First test form');
  });

  it('should have the same widgets in conditional widget area as the main form widgets area, execpt conditional itself', function () {
    const formWidgets = {
      ...forms.schema.find(field => field.name === 'contents').options.widgets
    };

    const conditionalWidgetWidgets = conditionalWidgets.schema.find(field => field.name === 'contents').options.widgets;

    const actual = (Object.keys(formWidgets)).sort();
    const expected = (Object.keys(conditionalWidgetWidgets).concat('@apostrophecms/form-conditional')).sort();

    assert.deepEqual(actual, expected);
  });

  it('should have the same widgets in group widget area as the main form widgets area, execpt group itself', function () {
    const formWidgets = {
      ...forms.schema.find(field => field.name === 'contents').options.widgets
    };

    const groupWidgetWidgets = groupWidgets.schema.find(field => field.name === 'contents').options.widgets;

    const actual = (Object.keys(formWidgets)).sort();
    const expected = (Object.keys(groupWidgetWidgets).concat('@apostrophecms/form-group')).sort();

    assert.deepEqual(actual, expected);
  });

  // Submitting gets 200 response
  const submission1 = {
    DogName: 'Jasper',
    DogTraits: [
      'Runs fast',
      'Likes treats'
    ],
    DogPhoto: 'files-pending', // Indicating a file upload.
    DogBreed: 'Irish Wolfhound',
    DogToy: 'Frisbee',
    LifeStory: 'Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. Donec ullamcorper nulla non metus auctor fringilla.',
    agree: true,
    queryParams: {
      'member-id': '123456789',
      source: 'newspaper',
      malicious: 'evil'
    }
  };

  it('should accept a valid submission', async function () {
    const formData = new FormData();
    submission1._id = savedForm1._id;
    formData.append('data', JSON.stringify(submission1));
    formData.append('DogPhoto-0', fs.createReadStream(path.join(__dirname, '/lib/upload_tests/upload-test.txt')));

    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/form/submit?apikey=skeleton_key',
        {
          body: formData
        }
      );
    } catch (error) {
      assert(!error);
    }
  });

  // Submission is stored in the db
  it('can find the form submission in the database', async function () {
    try {
      const doc = await apos.db.collection('aposFormSubmissions').findOne({
        'data.DogName': 'Jasper'
      });

      const uploadRegex = /^\/uploads\/attachments\/\w+-upload-test.txt$/;
      assert(doc.data.DogPhoto[0].match(uploadRegex));

      assert(doc.data.DogBreed === 'Irish Wolfhound');
    } catch (err) {
      assert(!err);
    }
  });

  // Submission captures and limits query parameters
  it('can find query parameter data saved and limited', async function () {
    const doc = await apos.db.collection('aposFormSubmissions').findOne({
      'data.DogName': 'Jasper'
    });

    assert(doc.data['member-id'] === '123456');
    assert(doc.data.source === 'newspaper');
    assert(doc.data.malicious === undefined);
  });

  // Submission is not stored in the db if disabled.
  let apos2;
  const form2 = { ...form1 };
  form2.slug = 'test-form-two';
  form2._id = 'form2:en:published';
  let savedForm2;
  const submission2 = { ...submission1 };

  it('should be a property of the apos2 object', async function () {
    apos2 = await testUtil.create({
      shortName: 'formsTest2',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 5252,
            session: {
              secret: 'test-the-forms-more'
            },
            apiKeys: {
              skeleton_key: { role: 'admin' }
            }
          }
        },
        '@apostrophecms/form': {
          options: {
            saveSubmissions: false
          }
        },
        ...formWidgets
      }
    });

    const forms = apos2.modules['@apostrophecms/form'];

    assert(forms.__meta.name === '@apostrophecms/form');
  });

  it('should not save in the database if disabled', async function () {
    const req = apos2.task.getReq();

    await apos2.doc.db.insertOne(form2);

    const form = await apos2.doc.getManager('@apostrophecms/form').find(req, {}).toObject();

    savedForm2 = form;

    submission2._id = savedForm2._id;
    const formData = new FormData();
    formData.append('data', JSON.stringify(submission2));

    try {
      await apos2.http.post(
        '/api/v1/@apostrophecms/form/submit?apikey=skeleton_key',
        {
          body: formData
        }
      );
    } catch (error) {
      assert(!error);
    }

    const doc = await apos2.db.collection('aposFormSubmissions').findOne({
      'data.DogName': 'Jasper'
    });

    assert(!doc);
  });

  it('destroys the second instance', async function () {
    testUtil.destroy(apos2);
  });

  // Get form errors returned from missing required data.
  const submission3 = {
    agree: true
  };

  it('should return errors for missing data', async function () {
    submission3._id = savedForm1._id;
    const formData = new FormData();
    formData.append('data', JSON.stringify(submission3));

    try {
      await apos.http.post(
        '/api/v1/@apostrophecms/form/submit?apikey=skeleton_key',
        {
          body: formData
        }
      );
      assert(false);
    } catch (error) {
      assert(error);
      assert(error.status === 400);
      assert(error.body.data.formErrors.length === 2);
      assert(error.body.data.formErrors[0].error === 'required');
      assert(error.body.data.formErrors[1].error === 'required');
    }
  });

  // Test basic reCAPTCHA requirements.
  let apos3;
  let savedForm3;
  const submission4 = { ...submission1 };
  const form3 = {
    ...form1,
    emails: [
      {
        id: 'emailCondOne',
        email: 'emailOne@example.net',
        conditions: []
      },
      {
        id: 'emailCondTwo',
        email: 'emailTwo@example.net',
        conditions: [
          {
            field: 'DogTraits',
            value: 'Likes treats, It\'s a dog'
          },
          {
            field: 'DogBreed',
            value: 'Cesky Terrier, Pumi'
          }
        ]
      },
      {
        id: 'emailCondThree',
        email: 'emailThree@example.net',
        conditions: [
          {
            field: 'DogTraits',
            value: 'Likes treats, "Comma, test"'
          }
        ]
      }
    ]
  };
  form3.slug = 'test-form-three';
  form3._id = 'form3:en:published';
  form3.enableRecaptcha = true;

  it('should be a property of the apos3 object', async function () {
    apos3 = await testUtil.create({
      shortName: 'formsTest3',
      testModule: true,
      modules: {
        '@apostrophecms/express': {
          options: {
            port: 6000,
            session: {
              secret: 'test-the-forms-more'
            },
            apiKeys: {
              skeleton_key: { role: 'admin' }
            }
          }
        },
        '@apostrophecms/form': {
          options: {
            emailSubmissions: true,
            testing: true,
            // reCAPTCHA test keys https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha-what-should-i-do
            recaptchaSite: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
            recaptchaSecret: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'
          }
        },
        ...formWidgets
      }
    });

    const forms = apos3.modules['@apostrophecms/form'];
    assert(forms.__meta.name === '@apostrophecms/form');
  });

  it('should return a form error if missing required reCAPTHCA token', async function () {
    const req = apos3.task.getReq();

    await apos3.doc.db.insertOne(form3)
      .then(function () {
        return apos3.doc.getManager('@apostrophecms/form').find(req, {})
          .toObject();
      })
      .then(function (form) {
        savedForm3 = form;
      })
      .catch(function (err) {
        console.error(err);
        assert(!err);
      });

    submission4._id = savedForm3._id;
    const formData = new FormData();
    formData.append('data', JSON.stringify(submission4));

    try {
      await apos3.http.post(
        '/api/v1/@apostrophecms/form/submit?apikey=skeleton_key',
        {
          body: formData
        }
      );
      // Don't make it here.
      assert(false);
    } catch (error) {
      assert(error.status === 400);
      assert(error.body.data.formErrors[0].error === 'recaptcha');
      assert(error.body.data.formErrors[0].global === true);
    }
  });

  it('should submit successfully with a reCAPTCHA token', async function () {
    submission4.recaptcha = 'validRecaptchaToken';
    const formData = new FormData();
    formData.append('data', JSON.stringify(submission4));

    try {
      await apos3.http.post(
        '/api/v1/@apostrophecms/form/submit?apikey=skeleton_key',
        {
          body: formData
        }
      );
      assert('👍');
    } catch (error) {
      assert(!error);
    }
  });

  const submission5 = {
    DogName: 'Jenkins',
    DogTraits: [
      'Runs fast',
      'Comma, test'
    ],
    DogBreed: 'Irish Wolfhound'
  };

  const submission6 = {
    DogName: 'Jenkins',
    DogTraits: [
      'Runs fast',
      'Likes treats'
    ],
    DogBreed: 'Cesky Terrier'
  };

  it('should populate email notification lists based on conditions', async function () {
    const req = apos3.task.getReq();

    const emailSetOne = await apos3.modules['@apostrophecms/form']
      .sendEmailSubmissions(req, savedForm3, submission5);

    assert(emailSetOne.length === 2);
    assert(emailSetOne.indexOf('emailOne@example.net') > -1);
    assert(emailSetOne.indexOf('emailTwo@example.net') === -1);
    assert(emailSetOne.indexOf('emailThree@example.net') > -1);

    const emailSetTwo = await apos3.modules['@apostrophecms/form']
      .sendEmailSubmissions(req, savedForm3, submission6);

    assert(emailSetTwo.length === 3);
    assert(emailSetTwo.indexOf('emailOne@example.net') > -1);
    assert(emailSetTwo.indexOf('emailTwo@example.net') > -1);
    assert(emailSetTwo.indexOf('emailThree@example.net') > -1);
  });

  it('destroys the third instance', async function () {
    await testUtil.destroy(apos3);
  });

  // Individual tests for sanitizeFormField methods on field widgets.
  it('sanitizes text widget input', function () {
    const widget = { fieldName: 'textField' };
    const output1 = {};
    const input1 = { textField: 'A valid string.' };

    textWidgets.sanitizeFormField(widget, input1, output1);

    assert(output1.textField === 'A valid string.');

    const input2 = { textField: 127 };
    const output2 = {};

    textWidgets.sanitizeFormField(widget, input2, output2);

    assert(output2.textField === '127');

    const input3 = { textField: null };
    const output3 = {};

    textWidgets.sanitizeFormField(widget, input3, output3);

    assert(output3.textField === '');
  });

  it('sanitizes textArea widget input', function () {
    const widget = { fieldName: 'textAreaField' };
    const longText = 'Nullam id dolor id nibh ultricies vehicula ut id elit. Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Aenean lacinia bibendum nulla sed consectetur.';

    const input1 = { textAreaField: longText };
    const output1 = {};

    textareaWidgets.sanitizeFormField(widget, input1, output1);
    assert(output1.textAreaField === longText);

    const input2 = { textAreaField: [ 127, 0 ] };
    const output2 = {};

    textareaWidgets.sanitizeFormField(widget, input2, output2);

    assert(!output2.textAreaField);
  });

  it('sanitizes select widget input', function () {
    const widget = {
      fieldName: 'selectField',
      choices: [
        { value: 'first' },
        { value: 'second' },
        { value: 'third' },
        { value: 'fourth' }
      ]
    };
    const input1 = { selectField: 'second' };
    const output1 = {};

    selectWidgets.sanitizeFormField(widget, input1, output1);

    assert(output1.selectField === 'second');

    const input2 = { selectField: 'ninetieth' };
    const output2 = {};

    selectWidgets.sanitizeFormField(widget, input2, output2);

    assert(!output2.selectField);
  });

  it('sanitizes radio widget input', function () {
    const widget = {
      fieldName: 'radioField',
      choices: [
        { value: 'first' },
        { value: 'second' },
        { value: 'third' },
        { value: 'fourth' }
      ]
    };
    const input1 = { radioField: 'second' };
    const output1 = {};

    radioWidgets.sanitizeFormField(widget, input1, output1);

    assert(output1.radioField === 'second');

    const input2 = { radioField: 'ninetieth' };
    const output2 = {};

    radioWidgets.sanitizeFormField(widget, input2, output2);

    assert(!output2.radioField);
  });

  it('sanitizes checkbox widget input', function () {
    const widget = {
      fieldName: 'checkboxField',
      choices: [
        { value: 'first' },
        { value: 'second' },
        { value: 'third' },
        { value: 'fourth' }
      ]
    };
    const input1 = { checkboxField: [ 'second', 'fourth', 'seventeenth' ] };
    const output1 = {};

    checkboxesWidgets.sanitizeFormField(widget, input1, output1);

    assert(output1.checkboxField.length === 2);
    assert(output1.checkboxField[0] === 'second');
    assert(output1.checkboxField[1] === 'fourth');
  });

  let fileId;

  it('should upload a test file using the attachments api', async function () {
    const attachment = await fileUtils.insert('upload-test.txt', apos);

    fileId = attachment._id;
  });

  it('sanitizes file widget input', async function () {
    const widget = { fieldName: 'fileField' };
    const output1 = {};
    const input1 = { fileField: [ fileId ] };

    await fileWidgets.sanitizeFormField(widget, input1, output1);

    assert(output1.fileField[0] === `/uploads/attachments/${fileId}-upload-test.txt`);

    const input2 = { fileField: '8675309' };
    const output2 = {};

    await fileWidgets.sanitizeFormField(widget, input2, output2);

    assert(Array.isArray(output2.fileField));
    assert(output2.fileField.length === 0);
  });

  const uploadTarget = `${__dirname}/public/uploads/`;

  it('should clear uploads material if any', async function () {
    await fileUtils.wipeIt(uploadTarget, apos);
  });

  it('sanitizes boolean widget input', function () {
    const widget = { fieldName: 'booleanField' };
    const output1 = {};
    const input1 = { booleanField: true };

    booleanWidgets.sanitizeFormField(widget, input1, output1);

    assert(output1.booleanField === true);

    const input2 = { booleanField: false };
    const output2 = {};

    booleanWidgets.sanitizeFormField(widget, input2, output2);

    assert(output2.booleanField === false);
  });

  it('should accept multiple files for a single file field when allowMultiple is true', async function () {
    // Update the existing form's file field to allow multiple
    await apos.doc.db.updateOne(
      { _id: savedForm1._id },
      { $set: { 'contents.items.$[w].allowMultiple': true } },
      { arrayFilters: [ { 'w._id': 'dogPhotoId' } ] }
    );

    const formData = new FormData();
    const multi = {
      ...submission1,
      _id: savedForm1._id,
      DogName: 'Cerberus'
    };
    formData.append('data', JSON.stringify(multi));

    // Two files for the same field: DogPhoto-1 and DogPhoto-2
    formData.append('DogPhoto-1', fs.createReadStream(path.join(__dirname, '/lib/upload_tests/upload-test.txt')));
    formData.append('DogPhoto-2', fs.createReadStream(path.join(__dirname, '/lib/upload_tests/upload-test.txt')));

    await apos.http.post(
      '/api/v1/@apostrophecms/form/submit?apikey=skeleton_key',
      { body: formData }
    );

    const doc = await apos.db.collection('aposFormSubmissions').findOne({
      'data.DogName': 'Cerberus'
    });

    const uploadRegex = /^\/uploads\/attachments\/\w+-upload-test.txt$/;
    // Expect at least two entries for DogPhoto
    assert(Array.isArray(doc.data.DogPhoto));
    assert(doc.data.DogPhoto.length >= 2);
    assert(uploadRegex.test(doc.data.DogPhoto[0]));
    assert(uploadRegex.test(doc.data.DogPhoto[1]));
  });

});
