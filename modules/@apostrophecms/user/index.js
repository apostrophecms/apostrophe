// The `@apostrophecms/user` module provides user accounts. It is **not**
// intended to be extended with new subclass modules. The `@apostrophecms/login`
// module only looks for instances of `@apostrophecms/user`. Of course you may
// implicitly subclass it at project level (not changing the name) in order to
// alter its behavior.
//
// ### Public "staff directories" vs. users
//
// In our experience, combining the concept of a "user" who can log in and do
// things with the concept of a "staff member" who appears in a staff directory
// is more trouble than it is worth.
//
// So for a staff directory, we suggest you create a separate `employee` module
// or similar, extending `@apostrophecms/piece-type`, unless it's true that
// basically everyone should be allowed to log in.
//
// ### `secrets` option
//
// For security the `password` property is not stored as plaintext and
// is not kept in the aposDocs collection. Instead, it is hashed and salted
// using the `credentials` module and the resulting hash is stored
// in a separate `aposUsersSafe` collection.
//
// Additional secrets may be hashed in this way. If you set the
// `secrets` option to an array of property names, those properties
// are never stored directly to the database. Instead, only their
// hashes are stored, and only in `aposUsersSafe`.
//
// You may also call `apos.user.addSecret('name')` to add a new
// secret property. This is convenient when implementing a module
// such as `@apostrophecms/signup`.
//
// ### `adminLocale` schema field
// A select field auto-created by the module, allowing the user to choose
// their preferred language for the admin UI. It will be added only if
// @apostrophecms/i18n is configured with `adminLocales`.

const passwordHash = require('./lib/password-hash.js');
const prompts = require('prompts');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'user',
    name: '@apostrophecms/user',
    label: 'apostrophe:user',
    pluralLabel: 'apostrophe:users',
    quickCreate: false,
    searchable: false,
    slugPrefix: 'user-',
    localized: false,
    versions: false,
    editRole: 'admin',
    publishRole: 'admin',
    viewRole: 'admin',
    showPermissions: true,
    relationshipSuggestionIcon: 'account-box-icon',
    scrypt: {
      // These are the defaults. If you choose to pass
      // this option, you can pass one or more new values.
      // "cost" must be a power of 2. See:
      //
      // https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
      //
      // Do not pass maxmem, it is calculated automatically.
      //
      // cost: 131072,
      // parallelization: 1,
      // blockSize: 8
    }
  },
  fields(self, options) {
    const fields = {};
    // UI Locale
    const locales = [ ...options.apos.i18n.adminLocales ];
    if (locales.length > 0) {
      const def = options.apos.i18n.defaultAdminLocale || '';
      fields.localeField = {
        type: 'select',
        name: 'adminLocale',
        label: 'apostrophe:uiLanguageLabel',
        choices: [
          {
            label: 'apostrophe:uiLanguageWebsite',
            value: ''
          },
          ...locales
        ],
        def
      };
    }

    return {
      add: {
        title: {
          type: 'string',
          label: 'apostrophe:displayName',
          required: true
        },
        disabled: {
          type: 'boolean',
          label: 'apostrophe:loginDisabled',
          def: false
        },
        username: {
          type: 'string',
          label: 'apostrophe:username',
          required: true,
          following: 'title'
        },
        email: {
          type: 'email',
          label: 'apostrophe:email'
        },
        password: {
          type: 'password',
          label: 'apostrophe:password'
        },
        role: {
          type: 'role',
          label: 'apostrophe:role',
          choices: [
            {
              label: 'apostrophe:guest',
              value: 'guest'
            },
            {
              label: 'apostrophe:contributor',
              value: 'contributor'
            },
            {
              label: 'apostrophe:editor',
              value: 'editor'
            },
            {
              label: 'apostrophe:admin',
              value: 'admin'
            }
          ],
          def: 'guest',
          required: true
        },
        ...fields
      },
      remove: [ 'visibility' ],
      group: {
        basics: {
          label: 'apostrophe:basics',
          fields: [
            'title',
            'adminLocale'
          ]
        },
        utility: {
          fields: [
            'username',
            'email',
            'password',
            'slug',
            'archived'
          ]
        },
        permissions: {
          label: 'apostrophe:permissions',
          fields: [
            'disabled',
            'role'
          ]
        }
      }
    };
  },

  filters: {
    remove: [ 'visibility' ]
  },

  columns: {
    remove: [ 'visibility' ]
  },

  async init(self) {
    self.initializeCredential();
    self.addOurArchivedPrefixFields();
    self.enableSecrets();
    self.addLegacyMigrations();
    await self.ensureSafe();
  },
  apiRoutes(self) {
    return {
      post: {
        async uniqueUsername(req) {
          const username = self.apos.launder.string(req.body.username);
          const user = self.find(req, { username }).project({
            _id: 1,
            username: 1
          }).toObject();
          if (user) {
            throw self.apos.error('conflict');
          }
        }
      }
    };
  },
  handlers(self) {
    return {
      beforeInsert: {
        async ensurePassword(req, doc, options) {
          if (!doc.password) {
            doc.password = self.apos.util.generateId();
          }
        },
        async insertSafe(req, doc, options) {
          return self.insertOrUpdateSafe(req, doc, 'insert');
        }
      },
      beforeUpdate: {
        async updateSafe(req, doc, options) {
          return self.insertOrUpdateSafe(req, doc, 'update');
        }
      },
      beforeSave: {
        // There is a migration that sets the role to admin if the role does
        // not exist, accommodating databases prior to 3.0 beta 1. To keep this
        // from becoming a possible security concern, refuse any new
        // inserts/updates with no role
        async requireRole(req, doc, options) {
          if (![ 'guest', 'editor', 'contributor', 'admin' ].includes(doc.role)) {
            throw self.apos.error('invalid', 'The role property of a user must be guest, editor, contributor or admin');
          }
        },
        async invalidatePriorLogins(req, doc, options) {
          const effectiveUserId = req.user && req.user._id;
          // Invalidate prior login sessions if the password field changes or
          // the user is newly marked as disabled.
          if (doc._id && doc._passwordUpdated && (effectiveUserId !== doc._id)) {
            // Invalidate old sessions
            doc.loginInvalidBefore = Date.now();
            // Just delete old bearer tokens
            return self.apos.login.bearerTokens.removeMany({
              userId: doc._id
            });
          }
        }
      },
      // Reflect email and username changes in the safe after deduplicating in
      // the piece
      afterArchive: {
        async updateSafe(req, piece) {
          await self.insertOrUpdateSafe(req, piece, 'update');
        }
      },
      afterRescue: {
        // Reflect email and username changes in the safe after deduplicating
        // in the piece
        async updateSafe(req, piece) {
          await self.insertOrUpdateSafe(req, piece, 'update');
        }
      }
    };
  },
  methods(self) {
    return {

      // Add `username` and `email` to the list of fields that automatically
      // get uniquely prefixed when a user is in the archive, so that they can
      // be reused by another piece. When the piece is rescued from the archive
      // the prefix is removed again, unless the username or email address has
      // been claimed by another user in the meanwhile.

      addOurArchivedPrefixFields() {
        self.addDeduplicatePrefixFields([
          'username',
          'email'
        ]);
      },

      // See `options.secrets` and also the `addSecret` method. `enableSecrets`
      // is part of the implementation and should not be called directly.

      enableSecrets() {
        self.secrets = self.options.secrets || [];
      },

      // Index and obtain access to the `aposUsersSafe` MongoDB collection as
      // `self.safe`.

      async ensureSafe() {
        await self.ensureSafeCollection();
        await self.ensureSafeIndexes();
      },

      // Obtain the `aposUsersSafe` MongoDB collection as `self.safe`.

      async ensureSafeCollection() {
        self.safe = await self.apos.db.collection('aposUsersSafe');
      },

      // Index the safe.

      async ensureSafeIndexes() {
        await self.safe.createIndex({ username: 1 }, { unique: true });
        await self.safe.createIndex({ email: 1 }, {
          unique: true,
          sparse: true
        });
      },

      // After a user is updated, check to see if the `groups` option is
      // configured for simplified user management. If it is, convert the
      // single-select choice made via `piece.group` to an array stored in
      // `groupIds`, so that all other code can find groups in a consistent way.

      async afterConvert(req, piece) {
        if (self.options.groups) {
          piece.groupIds = [];
          piece.groupIds.push(piece.group);
          delete piece.group;
        }
      },

      // Insert or update a user's record in the safe, which stores the
      // password hash completely outside of the `aposDocs` collection.
      // First checks to be sure this is an `@apostrophecms/user` and returns
      // immediately if not. Invoked on promise events.
      async insertOrUpdateSafe(req, doc, action) {
        // Store password hash exclusively in the safe so that it can never be
        // accidentally exposed as part of a query on docs. Also store the
        // username and, if present, the email address to take advantage of
        // unique and sparse indexes which prevent duplication.
        const safeUser = {
          _id: doc._id,
          username: doc.username,
          updatedAt: new Date()
        };

        if (doc.email) {
          safeUser.email = doc.email;
        }

        await self.hashPassword(doc, safeUser);
        await self.hashSecrets(doc, safeUser);

        await self.emit('beforeSaveSafe', req, safeUser, doc);

        if (action === 'insert') {
          await self.safe.insertOne(safeUser);
        } else {
          const changes = { $set: safeUser };
          if (!safeUser.email) {
            // Sparse indexes are only sparse on null/undefined, an empty
            // string is not good enough
            changes.$unset = { email: 1 };
          }
          await self.safe.updateOne({ _id: safeUser._id }, changes);
        }
      },

      // Hash the `password` property of `doc`, then delete that property
      // and update the `passwordHash` property of `safeUser`. This method is
      // called by the `docBeforeInsert` and `docBeforeSave handlers of this
      // module. If `password` is falsy (i.e. the user left it blank,
      // requesting no change), it is left alone and `safeUser` is
      // not updated.

      async hashPassword(doc, safeUser) {
        await self.hashSecret(doc, safeUser, 'password');
      },

      // Similar to `hashPassword`, this method hashes all of the properties
      // enumerated in `options.secrets` and via `addSecrets`, then deletes them
      // and updates the corresponding properties of `safeUser`. If
      // a secret is named `signup`, the corresponding property in
      // `safeUser` will be named `signupHash`.
      //
      // This method is called by the `docBeforeInsert` and `docBeforeSave`
      // handlers of this module.

      async hashSecrets(doc, safeUser) {
        for (const secret of self.secrets) {
          await self.hashSecret(doc, safeUser, secret);
        }
      },

      // Add the property specified by `name` to a list of
      // secret properties. These are never stored directly
      // to the user's doc in mongodb. Instead, if any of
      // them have non-falsy values at the time a user is saved,
      // those values are hashed and the hash is recorded
      // in a separate mongodb collection used only for this purpose.
      // You may then call `verifySecret` later to verify that
      // a newly entered value matches the previously hashed
      // value. This is useful to verify password reset codes,
      // signup verification codes and the like with security
      // just as good as that used for the password.

      addSecret(name) {
        self.secrets.push(name);
      },

      // Hashes a secret property of `doc`, deletes the property,
      // and stores only the hash in `safeUser`. `secret` is
      // the name of the property of `doc`, not the secret itself.
      //
      // If `secret` is the string `'password'`, then the `password`
      // property will be deleted from `doc` and the `passwordHash`
      // property of `safeUser` will be set.
      //
      // If the secret property is falsy (i.e. the user left the
      // password field blank, requesting no change), it is left
      // alone and `safeUser` is not updated.
      //
      // Called automatically by `hashSecrets`, above.
      //
      // The secret property itself is immediately deleted from doc
      // to avoid any risk of accidentally storing it in cleartext.
      // However there is a way to detect that it was updated:
      // if `secret` is `password`, then the `_passwordUpdated` temporary
      // property is set to true. This provides a way to take additional
      // actions stemming from this change in a `beforeSave` handler, etc.

      async hashSecret(doc, safeUser, secret) {
        if (!doc[secret]) {
          return;
        }
        const hash = await self.pw.hash(doc[secret]);
        const annotatedHash = JSON.stringify({
          ...JSON.parse(hash),
          credentials3: true
        });
        delete doc[secret];
        safeUser[secret + 'Hash'] = annotatedHash;
        doc[`_${secret}Updated`] = true;
      },

      // Verify the given password by checking it against the
      // hash in the safe. `user` is an `@apostrophecms/user` doc.
      // Throws `'invalid'` as an exception if the password is incorrect.

      async verifyPassword(user, password) {
        return self.verifySecret(user, 'password', password);
      },

      // Check whether the provided value `attempt` matches
      // the hash of the secret property `secret`. For security
      // the user's password and other property names specified
      // in `options.secrets` when configuring this module or via
      // `addSecrets` are not stored as plaintext and are not kept in the
      // aposDocs collection. Instead, they are hashed and salted using the
      // the same algorithm applied to passwords and the resulting hash is
      // stored in a separate `aposUsersSafe` collection. This method can be
      // used to verify that `attempt` matches the previously hashed value for
      // the property named `secret`, without ever storing the actual value of
      // the secret.
      //
      // If the secret does not match, an `invalid` error is thrown.
      // Otherwise the method returns normally.

      async verifySecret(user, secret, attempt) {
        const safeUser = await self.safe.findOne({ _id: user._id });
        if (!safeUser) {
          throw new Error('No such user in the safe.');
        }
        const key = secret + 'Hash';
        const isVerified = await self.pw.verify(migrate(safeUser[key]), attempt);

        if (isVerified) {
          if ((typeof isVerified) === 'string') {
            // "verify" updated the hash, store the new one
            const $set = {};
            $set[key] = isVerified;
            await self.safe.updateOne({
              _id: user._id
            }, {
              $set
            });
          }
          return null;
        } else {
          throw self.apos.error('invalid', `Incorrect ${secret}`);
        }

        function migrate(json) {
          const data = JSON.parse(json);

          // * Do not re-encode legacy salt generated by credentials@3
          // * Do not alter salts not generated by the credentials module
          if (data.credentials3 || (data.hashMethod !== 'pbkdf2')) {
            return json;
          }

          return JSON.stringify({
            ...data,
            salt: Buffer.from(data.salt, 'utf8').toString('base64')
          });
        }
      },

      // Forget the secret associated with the property name
      // passed in `secret`. If `secret` is `'passwordReset'`,
      // then the `passwordResetHash` property is deleted from
      // the appropriate record in the `aposUsersSafe`
      // collection. Note that the plaintext of the secret
      // was never stored in the database in the first place.

      async forgetSecret(user, secret) {
        const changes = { $unset: {} };
        changes.$unset[secret + 'Hash'] = 1;
        await self.safe.updateOne({ _id: user._id }, changes);
      },

      // Initialize password hashing system. Name is for
      // legacy reasons

      initializeCredential() {
        self.pw = passwordHash({
          error(s) {
            return self.apos.error('invalid', s);
          },
          scrypt: self.options.scrypt
        });
      },

      // Implement the `@apostrophecms/user:add` command line task.

      async addFromTask() {
        const argv = self.apos.argv;
        // Support positional arguments for bc, but the named
        // arguments make the intent clear
        const username = argv._[1] || argv.username;
        if (!username) {
          throw 'You must specify --username=usernamehere';
        }
        const req = self.apos.task.getReq();

        const user = {
          username,
          title: username
        };

        await self.addPermissionsFromTask(argv, user);

        user.password = (await prompts(
          {
            type: 'password',
            name: 'password',
            message: `Enter a password for ${username}:`,
            validate (input) {
              return input ? true : 'Password is required';
            }
          }
        )).password;

        return self.apos.user.insert(req, user);
      },

      async addPermissionsFromTask(argv, user) {
        let role = argv._[2] || argv.role;
        if (!role) {
          role = 'admin';
          console.log('You did not pass a second argument or --role, assuming admin');
        }
        if (![ 'guest', 'contributor', 'editor', 'admin' ].includes(role)) {
          throw 'Second argument or --role must be one of: guest, contributor, editor, admin';
        }
        user.role = role;
      },

      // Implement the `@apostrophecms/user:change-password` task.

      async changePasswordFromTask() {
        const argv = self.apos.argv;
        if (argv._.length !== 2) {
          throw 'Incorrect number of arguments.';
        }
        const username = argv._[1];
        const req = self.apos.task.getReq();

        const user = await self.apos.user.find(req, { username }).toObject();
        if (!user) {
          throw new Error('No such user.');
        }

        const { password } = await prompts(
          {
            type: 'password',
            name: 'password',
            message: `Change password for ${username} to:`,
            validate (input) {
              return input ? true : 'Password is required';
            }
          }
        );

        // This module's docBeforeUpdate handler does all the magic here
        user.password = password;
        return self.update(req, user);
      },
      ...require('./lib/legacy-migrations')(self)
    };
  },
  tasks(self) {
    return {
      add: {
        usage: 'Usage: node app @apostrophecms/user:add username groupname\n\nThis adds a new user and assigns them to a group.\nYou will be prompted for a password.',
        task: self.addFromTask
      },
      'change-password': {
        usage: 'Usage: node app @apostrophecms/user:change-password username\n\nThis prompts you for a new password for the given user.',
        task: self.changePasswordFromTask
      }
    };
  }
};
