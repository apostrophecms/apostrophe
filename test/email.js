let t = require('../test-lib/test.js');
let assert = require('assert');
let apos;

describe('Email', function() {

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  it('should be a property of the apos object', async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },  
      modules: {
        'apostrophe-express': {
          port: 7900
        },
        'apostrophe-email': {
          nodemailer: {
            streamTransport: true,
            buffer: true,
            newline: 'unix'
          }
        },
        'email-test': {}
      }
    });
    assert(apos.modules['apostrophe-email']);
  });

  it('can send email on behalf of a module', async function() {
    const info = await apos.modules['email-test'].email(apos.tasks.getReq(),
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
    let message = info.message.toString();
    assert(message.match(/Fred Astaire/));
    assert(message.match(/Subject: Welcome Aboard/));
    assert(message.match(/From: test@example\.com/));
    assert(message.match(/To: recipient@example\.com/));
    assert(message.match(/\[http:\/\/example\.com\/\]/));
  });
});
