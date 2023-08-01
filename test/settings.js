const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('user settings', function () {
  this.timeout(t.timeout);

  let apos;

  beforeEach(async function() {
    await t.destroy(apos);
    apos = null;
  });

  after(async function() {
    return t.destroy(apos);
  });

  it('should have settings module', async function() {
    apos = await t.create({
      root: module
    });
    assert(apos.modules['@apostrophecms/settings'], 'module not found');
    assert(apos.settings, 'module alias not found');
    assert.deepEqual(apos.settings.options.subforms, {});
    assert.deepEqual(apos.settings.options.groups, {});
    assert.deepEqual(apos.settings.subforms, []);
    assert.deepEqual(apos.settings.userSchema, []);
    assert.equal(apos.settings.hasSchema(), false);
  });

  it('should panic on non-existing or forbidden user field in subforms', async function () {
    apos = await t.create({
      root: module
    });

    apos.settings.options.subforms = {
      test: {
        fields: [ 'nonExistingField' ]
      }
    };
    assert.throws(
      apos.settings.initSubforms,
      {
        message: '[@apostrophecms/settings] The field "nonExistingField" is not a valid user field.'
      }
    );

    const testFields = [ ...apos.settings.systemForbiddenFields ];

    for (const field of testFields) {
      apos.settings.options.subforms = {
        test: {
          fields: [ field ]
        }
      };
      assert.throws(
        apos.settings.initSubforms,
        {
          message: `[@apostrophecms/settings] The field "${field}" is forbidden.`
        }
      );
    }
  });

  // It should process settings schema and register the subset of the user schema that
  // is relevant to the configured subforms.
  it('should init subforms', async function () {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            adminLocales: [
              {
                label: 'English',
                value: 'en'
              },
              {
                label: 'French',
                value: 'fr'
              }
            ]
          }
        },
        '@apostrophecms/user': {
          fields: {
            add: {
              firstName: {
                type: 'string',
                label: 'First Name'
              },
              lastName: {
                type: 'string',
                label: 'Last Name'
              }
            }
          }
        },
        '@apostrophecms/settings': {
          options: {
            subforms: {
              name: {
                label: 'Name',
                fields: [ 'firstName', 'lastName' ],
                preview: '{{ firstName }} {{ lastName }}'
              },
              adminLocale: {
                fields: [ 'adminLocale' ]
              }
            }
            // No groups configured
          }
        }
      }
    });

    // Schema is processed
    const schema = apos.settings.userSchema;
    assert.equal(apos.settings.hasSchema(), true);
    assert.equal(schema.length, 3);
    assert(schema.some(field => field.name === 'firstName'));
    assert(schema.some(field => field.name === 'lastName'));
    assert(schema.some(field => field.name === 'adminLocale'));

    const nameSchema = apos.settings.getSubformSchema('name');
    assert.equal(nameSchema.length, 2);
    assert(nameSchema.some(field => field.name === 'firstName'));
    assert(nameSchema.some(field => field.name === 'lastName'));

    const adminLocaleSchema = apos.settings.getSubformSchema('adminLocale');
    assert.equal(adminLocaleSchema.length, 1);
    assert(adminLocaleSchema.some(field => field.name === 'adminLocale'));

    // Subforms are initialized
    const subforms = apos.settings.subforms;
    assert.equal(subforms.length, 2);

    const nameSubform = subforms.find(subform => subform.name === 'name');
    assert.equal(nameSubform.label, 'Name');
    assert.equal(nameSubform.preview, '{{ firstName }} {{ lastName }}');
    assert.deepEqual(nameSubform.schema, nameSchema);
    assert.deepEqual(nameSubform.group, {
      name: 'ungrouped',
      label: 'apostrophe:ungrouped'
    });

    const adminLocaleSubform = subforms.find(subform => subform.name === 'adminLocale');
    assert.equal(adminLocaleSubform.label, undefined);
    assert.equal(adminLocaleSubform.preview, undefined);
    assert.deepEqual(adminLocaleSubform.schema, adminLocaleSchema);
    assert.deepEqual(adminLocaleSubform.group, {
      name: 'ungrouped',
      label: 'apostrophe:ungrouped'
    });

    // Appropriate browser data is sent
    const browserData = apos.settings.getBrowserData(apos.task.getReq({
      session: {}
    }));
    assert.deepEqual(browserData.subforms, subforms);
    assert.equal(browserData.action, '/api/v1/@apostrophecms/settings');
  });

  it('should init groups', async function () {
    apos = await createCommonInstance();
    const [ first, second, third, fourth ] = apos.settings.subforms;
    assert.equal(apos.settings.subforms.length, 4);

    assert.equal(first.name, 'name');
    assert.deepEqual(first.group, {
      name: 'account',
      label: 'Account'
    });
    assert.equal(second.name, 'password');
    assert.deepEqual(second.group, {
      name: 'account',
      label: 'Account'
    });
    assert.equal(third.name, 'adminLocale');
    assert.deepEqual(third.group, {
      name: 'preferences',
      label: 'Preferences'
    });
    assert.equal(fourth.name, 'display');
    assert.deepEqual(fourth.group, {
      name: 'ungrouped',
      label: 'apostrophe:ungrouped'
    });
  });

  it('should handle protected subforms', async function () {
    apos = await createCommonInstance();
    const [ first, second, third, fourth ] = apos.settings.subforms;
    assert.equal(apos.settings.subforms.length, 4);

    assert.equal(first.name, 'name');
    assert.equal(first.protection, 'password');
    // verify the explicitly set by the config private flag is removed
    assert.equal(typeof first._passwordChangeForm, 'undefined');
    assert.deepEqual(first.fields, [ 'firstName', 'lastName' ]);
    assert.equal(first.schema.length, 3);
    // last field is the current password field
    {
      const pwdField = first.schema[first.schema.length - 1];
      assert.equal(pwdField.type, 'password');
      assert.equal(pwdField.name, 'passwordCurrent');
      assert.equal(pwdField.required, true);
    }

    assert.equal(second.name, 'password');
    assert.equal(second.protection, 'password');
    assert.equal(second._passwordChangeForm, true);
    // displayName is removed
    assert.deepEqual(second.fields, [ 'password' ]);
    assert(second.help);
    assert.equal(second.schema[0].name, 'password');
    assert.equal(second.schema[0].type, 'password');
    assert.equal(second.schema[1].name, 'passwordRepeat');
    assert.equal(second.schema[1].type, 'password');
    assert.equal(second.schema[2].name, 'passwordCurrent');
    assert.equal(second.schema[2].type, 'password');

    assert.equal(third.name, 'adminLocale');
    assert.equal(!!third.protection, false);
    assert.equal(third.schema.length, 1);

    assert.equal(fourth.name, 'display');
    assert.equal(fourth.protection, 'password');
    assert.deepEqual(fourth.fields, [ 'displayName' ]);
    assert.equal(fourth.schema.length, 2);
    // last field is the current password field
    {
      const pwdField = fourth.schema[fourth.schema.length - 1];
      assert.equal(pwdField.type, 'password');
      assert.equal(pwdField.name, 'passwordCurrent');
      assert.equal(pwdField.required, true);
    }
  });

  it('should return 404 when settings user data and no configuration', async function () {
    apos = await t.create({
      root: module
    });
    const { jar } = await login(apos);

    await assert.rejects(
      apos.http.get('/api/v1/@apostrophecms/settings', { jar }),
      {
        status: 404
      }
    );

  });

  it('should load settings user data', async function () {
    apos = await createCommonInstance();
    const { jar, user } = await login(apos);
    const result = await apos.http.get('/api/v1/@apostrophecms/settings', {
      jar
    });

    assert(result._id);
    assert.deepEqual(result, {
      _id: user._id,
      adminLocale: '',
      displayName: '',
      firstName: '',
      lastName: ''
    });
  });

  it('should validate when updating settings user data and no configuration', async function () {
    apos = await t.create({
      root: module
    });

    {
      const { jar } = await login(apos);

      await assert.rejects(
        apos.http.patch('/api/v1/@apostrophecms/settings/name', {
          jar
        }),
        {
          status: 404
        }
      );
      await t.destroy(apos);
    }

    apos = await createCommonInstance();
    {
      const { jar } = await login(apos);
      await assert.rejects(
        apos.http.patch('/api/v1/@apostrophecms/settings/non-existing', {
          jar
        }),
        {
          status: 404
        }
      );
    }
  });

  it('should update settings', async function () {
    apos = await createCommonInstance();
    const { jar, user } = await login(apos);
    const result = await apos.http.patch('/api/v1/@apostrophecms/settings/adminLocale', {
      body: {
        adminLocale: 'fr'
      },
      jar
    });

    assert(result._id);
    assert.deepEqual(result, {
      _id: user._id,
      adminLocale: 'fr'
    });
    const _user = await apos.user.find(apos.task.getReq(), { _id: user._id }).toObject();
    assert.equal(_user.adminLocale, 'fr');
  });

  it('should change password', async function () {
    apos = await createCommonInstance();
    const { jar } = await login(apos);

    // Passwords do not match
    await assert.rejects(
      apos.http.patch('/api/v1/@apostrophecms/settings/password', {
        body: {
          password: 'newpassword',
          passwordRepeat: 'doesNotMatch',
          passwordCurrent: 'invalid'
        },
        jar
      }),
      function (err) {
        assert.equal(err.status, 400);
        assert.equal(err.body.data.errors[0].path, 'passwordRepeat');
        assert.equal(err.body.data.errors[0].message, 'invalid');
        return true;
      }
    );

    // Current password is invalid
    await assert.rejects(
      apos.http.patch('/api/v1/@apostrophecms/settings/password', {
        body: {
          password: 'newpassword',
          passwordRepeat: 'newpassword',
          passwordCurrent: 'invalid'
        },
        jar
      }),
      function (err) {
        assert.equal(err.status, 403);
        assert.equal(err.body.data.path, 'passwordCurrent');
        assert.equal(err.body.name, 'forbidden');
        return true;
      }
    );

    await apos.http.patch('/api/v1/@apostrophecms/settings/password', {
      body: {
        password: 'newpassword',
        passwordRepeat: 'newpassword',
        passwordCurrent: 'editor'
      },
      jar
    });

    await assert.rejects(t.loginAs(apos, 'editor', 'editor'));
    await logout(apos, 'editor', 'editor', jar);
    await t.loginAs(apos, 'editor', 'newpassword');
  });

  it('should password protect subforms', async function () {
    apos = await createCommonInstance();
    const { jar, user } = await login(apos);
    assert(!user.displayName);

    // No current password
    await assert.rejects(
      apos.http.patch('/api/v1/@apostrophecms/settings/display', {
        body: {
          displayName: 'Hacker'
        },
        jar
      }),
      function (err) {
        assert.equal(err.status, 403);
        assert.equal(err.body.data.path, 'passwordCurrent');
        assert.equal(err.body.name, 'forbidden');
        return true;
      }
    );

    // Current password is invalid
    await assert.rejects(
      apos.http.patch('/api/v1/@apostrophecms/settings/display', {
        body: {
          displayName: 'Editor',
          passwordCurrent: 'invalid'
        },
        jar
      }),
      function (err) {
        assert.equal(err.status, 403);
        assert.equal(err.body.data.path, 'passwordCurrent');
        assert.equal(err.body.name, 'forbidden');
        return true;
      }
    );

    await apos.http.patch('/api/v1/@apostrophecms/settings/display', {
      body: {
        displayName: 'Editor',
        passwordCurrent: 'editor'
      },
      jar
    });

    const validateUser = await apos.user
      .find(apos.task.getReq(), { _id: user._id })
      .toObject();

    assert.equal(validateUser.displayName, 'Editor');

  });
});

async function createCommonInstance() {
  return t.create({
    root: module,
    modules: {
      '@apostrophecms/i18n': {
        options: {
          adminLocales: [
            {
              label: 'English',
              value: 'en'
            },
            {
              label: 'French',
              value: 'fr'
            }
          ]
        }
      },
      '@apostrophecms/user': {
        fields: {
          add: {
            firstName: {
              type: 'string',
              label: 'First Name'
            },
            lastName: {
              type: 'string',
              label: 'Last Name'
            },
            displayName: {
              type: 'string',
              label: 'Display Name'
            }
          }
        }
      },
      '@apostrophecms/settings': {
        options: {
          subforms: {
            display: {
              fields: [ 'displayName' ],
              // same as `protection: 'password'`
              protection: true,
              // validate it can't happen
              _passwordChangeForm: true
            },
            adminLocale: {
              fields: [ 'adminLocale' ]
            },
            name: {
              label: 'Name',
              fields: [ 'firstName', 'lastName' ],
              preview: '{{ firstName }} {{ lastName }}',
              protection: 'password'
            },
            password: {
              // Ensure that only `password` will be used
              fields: [ 'password', 'displayName' ],
              // Test system protected fields
              protection: false
            }
          },
          groups: {
            account: {
              label: 'Account',
              subforms: [ 'name', 'nonExisting', 'password' ]
            },
            preferences: {
              label: 'Preferences',
              subforms: [ 'adminLocale' ]
            }
          }
        }
      }
    }
  });
}

async function login(apos) {
  const user = await t.createUser(apos, 'editor', {
    username: 'editor',
    password: 'editor'
  });
  const jar = await t.getUserJar(apos, user);
  await apos.http.get('/', { jar });

  return {
    apos,
    user,
    jar
  };
}

async function logout(apos, username, password, jar) {
  await apos.http.post(
    '/api/v1/@apostrophecms/login/logout',
    {
      body: {
        username,
        password,
        session: true
      },
      jar
    }
  );
  await apos.http.get(
    '/',
    {
      jar
    }
  );
}
