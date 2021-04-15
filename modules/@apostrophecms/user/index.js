// The `@apostrophecms/user` module provides user accounts. It is **not** intended to
// be extended with new subclass modules. The `@apostrophecms/login` module only
// looks for instances of `@apostrophecms/user`. Of course you may implicitly subclass
// it at project level (not changing the name) in order to alter its behavior.
//
// ### Public "staff directories" vs. users
//
// In our experience, combining the concept of a "user" who can log in and do things
// with the concept of a "staff member" who appears in a staff directory is more
// trouble than it is worth.
//
// So for a staff directory, we suggest you create a separate `employee` module
// or similar, extending `@apostrophecms/piece-type`, unless it's true that basically
// everyone should be allowed to log in.
//
// ### `secrets` option
//
// For security the `password` property is not stored as plaintext and
// is not kept in the aposDocs collection. Instead, it is hashed and salted
// using the `credential` module and the resulting hash is stored
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

const credential = require('credential');
const prompts = require('prompts');
const Promise = require('bluebird');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'user',
    name: '@apostrophecms/user',
    label: 'User',
    pluralLabel: 'Users',
    quickCreate: false,
    adminOnly: true,
    searchable: false,
    slugPrefix: 'user-',
    localized: false
  },
  fields(self) {
    return {
      add: {
        firstName: {
          type: 'string',
          label: 'First Name'
        },
        lastName: {
          type: 'string',
          label: 'Last Name'
        },
        title: {
          type: 'string',
          label: 'Full Name',
          following: [ 'firstName', 'lastName' ],
          required: true
        },
        slug: {
          type: 'slug',
          label: 'Slug',
          following: 'title',
          required: true
        },
        disabled: {
          type: 'boolean',
          label: 'Login Disabled',
          def: false
        },
        username: {
          type: 'string',
          label: 'Username',
          required: true
        },
        email: {
          type: 'string',
          label: 'Email'
        },
        password: {
          type: 'password',
          label: 'Password'
        },
        role: {
          type: 'role',
          choices: [
            {
              label: 'Guest',
              value: 'guest'
            },
            {
              label: 'Contributor',
              value: 'contributor'
            },
            {
              label: 'Editor',
              value: 'editor'
            },
            {
              label: 'Admin',
              value: 'admin'
            }
          ],
          required: true
        }
      },
      remove: [ 'visibility' ],
      group: {
        basics: {
          label: 'Basics',
          fields: [
            'firstName',
            'lastName',
            'title',
            'slug'
          ]
        },
        utility: {
          fields: [
            'username',
            'email',
            'password',
            'archived'
          ]
        },
        permissions: {
          label: 'Permissions',
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
    self.addRoleMigration();
    await self.ensureSafe();
  },
  apiRoutes(self) {
    return {
      post: {
        async uniqueUsername(req) {
          const username = self.apos.launder.string(req.body.username);
          const user = self.find(req, { username: username }).project({
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
        // from becoming a possible security concern, refuse any new inserts/updates
        // with no role
        async requireRole(req, doc, options) {
          if (![ 'guest', 'editor', 'contributor', 'admin' ].includes(doc.role)) {
            throw self.apos.error('invalid', 'The role property of a user must be guest, editor, contributor or admin');
          }
        }
      },
      // Reflect email and username changes in the safe after deduplicating in the piece
      afterArchived: {
        async updateSafe(req, piece) {
          await self.insertOrUpdateSafe(req, piece, 'update');
        }
      },
      afterRescue: {
        // Reflect email and username changes in the safe after deduplicating in the piece
        async updateSafe(req, piece) {
          await self.insertOrUpdateSafe(req, piece, 'update');
        }
      }
    };
  },
  methods(self) {
    return {

      // Add `username` and `email` to the list of fields that automatically get uniquely prefixed
      // when a user is in the archive, so that they can be reused by another piece. When
      // the piece is rescued from the archive the prefix is removed again, unless the username
      // or email address has been claimed by another user in the meanwhile.

      addOurArchivedPrefixFields() {
        self.addArchivedPrefixFields([
          'username',
          'email'
        ]);
      },

      // See `options.secrets` and also the `addSecret` method. `enableSecrets`
      // is part of the implementation and should not be called directly.

      enableSecrets() {
        self.secrets = self.options.secrets || [];
      },

      // Index and obtain access to the `aposUsersSafe` MongoDB collection as `self.safe`.

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

      // After a user is updated, check to see if the `groups` option is configured for
      // simplified user management. If it is, convert the single-select choice made
      // via `piece.group` to an array stored in `groupIds`, so that all other code
      // can find groups in a consistent way.

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
        if (action === 'insert') {
          await self.safe.insertOne(safeUser);
        } else {
          const changes = { $set: safeUser };
          if (!safeUser.email) {
            // Sparse indexes are only sparse on null/undefined, an empty string is not good enough
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

      async hashSecret(doc, safeUser, secret) {
        if (!doc[secret]) {
          return;
        }
        const hash = await require('util').promisify(self.pw.hash)(doc[secret]);
        delete doc[secret];
        safeUser[secret + 'Hash'] = hash;
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
      // `credential` module and the resulting hash is stored
      // in a separate `aposUsersSafe` collection. This method
      // can be used to verify that `attempt` matches the
      // previously hashed value for the property named `secret`,
      // without ever storing the actual value of the secret
      //
      // If the secret does not match, an `invalid` error is thrown.
      // Otherwise the method returns normally.

      async verifySecret(user, secret, attempt) {
        const verify = Promise.promisify(self.pw.verify);
        const safeUser = await self.safe.findOne({ _id: user._id });
        if (!safeUser) {
          throw new Error('No such user in the safe.');
        }

        const isVerified = await verify(safeUser[secret + 'Hash'], attempt);

        if (isVerified) {
          return null;
        } else {
          throw self.apos.error('invalid', `Incorrect ${secret}`);
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

      // Initialize the [credential](https://npmjs.org/package/credential) module.
      initializeCredential() {
        self.pw = credential();
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
          title: username,
          firstName: username
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

        const user = await self.apos.user.find(req, { username: username }).toObject();
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

      addRoleMigration() {
        self.apos.migration.add('add-role-to-user', async () => {
          return self.apos.doc.db.updateMany({
            type: '@apostrophecms/user',
            role: {
              $exists: 0
            }
          }, {
            $set: {
              role: 'admin'
            }
          });
        });
      }
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
