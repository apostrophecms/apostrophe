let t = require('../test-lib/test.js');
let assert = require('assert');
let _ = require('lodash');

let apos;

describe('Users', function() {

  // Password hashing can be slow
  this.timeout(20000);

  after(async () => {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should initialize', async () => {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          options: {
            secret: 'xxx',
            port: 7900
          }
        }
      }
    });
  });

  // Test pieces.newInstance()
  it('should be able to insert a new user', async () => {
    assert(apos.users.newInstance);
    let user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Jane';
    user.lastName = 'Doe';
    user.title = 'Jane Doe';
    user.username = 'JaneD';
    user.password = '123password';
    user.email = 'jane@aol.com';

    assert(user.type === 'apostrophe-user');
    assert(apos.users.insert);
    await apos.users.insert(apos.tasks.getReq(), user);
  });

  // verify a user's password
  // fail to verify the wrong password
  // fail to insert another user with the same email address
  // succeed in updating a user's property
  // verify a user's password after that user has been updated
  // change an existing user's password and verify the new password
  // verify that the user doc does not contain a password property at all

  // retrieve a user by their username

  let janeId;

  it('should be able to retrieve a user by their username', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { username: 'JaneD' }).toObject();
    assert(user && user.username === 'JaneD');
    janeId = user._id;
  });

  it('should verify a user password', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { username: 'JaneD' }).toObject();
    assert(user && user.username === 'JaneD');
    await apos.users.verifyPassword(user, '123password');
  });

  it('should not verify an incorrect user password', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { username: 'JaneD' }).toObject();
    try {
      await apos.users.verifyPassword(user, '321password');
      // Getting this far is bad, the password is intentionally wrong
      assert(false);
    } catch (e) {
      assert(e);
   }
  });

  it('should not be able to insert a new user if their email already exists', async () => {
    assert(apos.users.newInstance);
    let user = apos.users.newInstance();
    assert(user);

    user.firstName = 'Dane';
    user.lastName = 'Joe';
    user.title = 'Dane Joe';
    user.username = 'DaneJ';
    user.password = '321password';
    user.email = 'jane@aol.com';
    assert(user.type === 'apostrophe-user');

    assert(apos.users.insert);
    try {
      await apos.users.insert(apos.tasks.getReq(), user);
      assert(false);
    } catch (e) {
      assert(true);
    }
  });

  it('should be able to move a user to the trash', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { _id: janeId }).toObject();
    user.trash = true;
    await apos.users.update(apos.tasks.getReq(), user);
    const doc = await apos.docs.db.findOne({ _id: user._id, trash: true });
    assert(doc);
  });

  it('should be able to insert a user with a previously used email if the other is in the trash', async () => {
    let user = apos.users.newInstance();

    user.firstName = 'Dane';
    user.lastName = 'Joe';
    user.title = 'Dane Joe';
    user.username = 'DaneJ';
    user.password = '321password';
    user.email = 'jane@aol.com';
    await apos.users.insert(apos.tasks.getReq(), user);
  });

  it('should be able to rescue the first user from the trash and the username should revert, but the email should not because it is in use by a newer account', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { _id: janeId }).trash(true).toObject();
    user.trash = false;
    await apos.users.update(apos.tasks.getReq(), user);
    const doc = await apos.docs.db.findOne({ _id: user._id, trash: { $ne: true } });
    assert(doc);
    assert(doc.username === 'JaneD');
    assert(doc.email.match(/deduplicate.*jane/));
  });

  it('there should be two users in the safe at this point and neither with a null username', async () => {
    const docs = await apos.users.safe.find({}).toArray();
    assert(docs.length === 2);
    for (const doc of docs) {
      assert(doc.username);
    }
  });

  it('should be able to move a user to the trash', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { _id: janeId }).toObject();
    user.trash = true;
    await apos.users.update(apos.tasks.getReq(), user);
    const doc = await apos.docs.db.findOne({ _id: user._id, trash: true });
    assert(doc);
  });

  it('should be able to insert a user with a previously used username if the other is in the trash', async () => {
    let user = apos.users.newInstance();

    user.firstName = 'Dane';
    user.lastName = 'Joe';
    user.title = 'Dane Joe';
    user.username = 'JaneD';
    user.password = '321password';
    user.email = 'somethingelse@aol.com';
    await apos.users.insert(apos.tasks.getReq(), user);
  });

  it('should be able to rescue the first user from the trash and the email and username should be deduplicated', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { _id: janeId }).trash(true).toObject();
    user.trash = false;
    await apos.users.update(apos.tasks.getReq(), user);
    const doc = await apos.docs.db.findOne({ _id: user._id, trash: { $ne: true } });
    assert(doc);
    assert(doc.username.match(/deduplicate.*JaneD/));
    assert(doc.email.match(/deduplicate.*jane/));
  });

  it('there should be three users in the safe at this point and none with a null username', async () => {
    const docs = await apos.users.safe.find({}).toArray();
    assert(docs.length === 3);
    for (const doc of docs) {
      assert(doc.username);
    }
  });

  it('should succeed in updating a user\'s property', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { username: 'JaneD' }).toObject();
    assert(user);
    assert(user.username === 'JaneD');
    user.firstName = 'Jill';
    await apos.users.update(apos.tasks.getReq(), user);
    const user2 = await apos.users.find(apos.tasks.getReq(), { _id: user._id }).toObject();
    assert(user2);
    assert(user2.firstName === 'Jill');
  });

  it('should verify a user password after their info has been updated', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { username: 'JaneD' }).toObject();
    assert(user);
    assert(user.username === 'JaneD');
    await apos.users.verifyPassword(user, '321password');
  });

  // change an existing user's password and verify the new password
  it('should change an existing user password and verify the new password', async () => {
    const user = await apos.users.find(apos.tasks.getReq(), { username: 'JaneD' }).toObject();
    assert(user);
    assert(user.username === 'JaneD');
    assert(!user.password);
    user.password = 'password123';
    await apos.users.update(apos.tasks.getReq(), user);
    const user2 = await apos.users.find(apos.tasks.getReq(), { username: 'JaneD' }).toObject();
    await apos.users.verifyPassword(user2, 'password123');
  });

});
