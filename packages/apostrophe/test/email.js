const t = require('../test-lib/test.js');
const assert = require('assert').strict;

describe('Email', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should be a property of the apos object', async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/email': {
          options: {
            nodemailer: {
              streamTransport: true,
              buffer: true,
              newline: 'unix'
            }
          }
        },
        'email-test': {}
      }
    });
    assert(apos.modules['@apostrophecms/email']);
  });

  it('can send email on behalf of a module', async function() {
    const info = await apos.modules['email-test'].email(apos.task.getReq(),
      'welcome',
      {
        name: 'Fred Astaire'
      },
      {
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Welcome Aboard'
      }
    );
    assert(info);
    const message = info.message.toString();
    assert(message.match(/Fred Astaire/));
    assert(message.match(/Subject: Welcome Aboard/));
    assert(message.match(/From: test@example\.com/));
    assert(message.match(/To: recipient@example\.com/));
    assert(message.match(/\[http:\/\/example\.com\/\]/));
  });

  it('should convert html to text', async function () {
    await t.destroy(apos);
    apos = await t.create({
      root: module
    });

    const mockEmail = require('./data/fpw_email_mock.js');
    const mockTransport = () => ({
      sendMail: function (args) {
        return Promise.resolve(args);
      }
    });
    const mockModule = {
      options: { email: { from: mockEmail.from } },
      render: async () => mockEmail.html
    };
    apos.modules['@apostrophecms/email'].getTransport = mockTransport;

    const result = await apos.modules['@apostrophecms/email'].emailForModule(
      apos.task.getReq(), // req
      'anyTemplate', // templateName
      {}, // data
      {
        to: mockEmail.to,
        subject: mockEmail.subject
      }, // options
      mockModule // module
    );
    assert.equal(result.text, mockEmail.text);
  });
});
