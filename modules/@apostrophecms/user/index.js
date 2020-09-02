// The `@apostrophecms/user` module provides user accounts. It is **not** intended to
// be extended with new subclass modules. The `@apostrophecms/login` module only
// looks for instances of `@apostrophecms/user`. Of course you may implicitly subclass
// it at project level (not changing the name) in order to alter its behavior.
//
// A user's permissions are determined by their membership in groups. See the
// join with `@apostrophecms/group` in the schema.
//
// Groups are managed by the `@apostrophecms/group` module.
//
// There is also a simplified permissions model in which you just specify
// an array of `groups` as an option to `@apostrophecms/user`, and a single-select
// dropdown menu allows you to pick one and only one of those groups for each user.
// The properties of each group in the array are `name`, `label` and
// `permissions`, which is an array of permission names such as `guest`, `edit` and
// `admin`. If you specify the `groups` option when configuring
// `@apostrophecms/user`, the admin interface for `@apostrophecms/group` will hide itself.
//
// ### Public "staff directories" vs. users
//
// In our experience, combining the concept of a "user" who can log in and do things
// with the concept of a "staff member" who appears in a staff directory is more
// trouble than it is worth. That's why the `published` field is not present in
// `@apostrophecms/user`. You can add it back in, but then you have to deal with
// the confusing concept of "users" who shouldn't actually be allowed to log in.
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

const _ = require('lodash');
const credential = require('credential');
const prompt = require('prompt');
const Promise = require('bluebird');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'user',
    name: '@apostrophecms/user',
    label: 'User',
    pluralLabel: 'Users',
    adminOnly: true,
    searchable: false
  },
  fields(self, options) {
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
          label: 'Full Name'
        },
        slug: {
          type: 'slug',
          label: 'Slug',
          prefix: 'user',
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
          name: 'email',
          label: 'Email'
        },
        password: {
          type: 'password',
          name: 'password',
          label: 'Password'
        },
        ...(options.groups
          ? {
            group: {
              type: 'select',
              label: 'Permission Group',
              def: 'guest',
              choices: []
            },
            _groups: {
              type: 'join',
              label: 'Groups',
              idsField: 'groupIds',
              withType: '@apostrophecms/group',
              contextual: true
            }
          } : {
            _groups: {
              type: 'join',
              label: 'Groups',
              withType: '@apostrophecms/group'
            }
          }
        )
      },
      remove: [ 'published' ],
      group: {
        basics: {
          label: 'Basics',
          fields: [
            'firstName',
            'lastName',
            'title',
            'username',
            'email',
            'password',
            'slug',
            'group',
            '_groups',
            'disabled',
            'slug'
          ]
        }
      }
    };
  },

  async init(self, options) {

    self.apos.task.add('@apostrophecms/user', 'add', 'Usage: node app @apostrophecms/user:add username groupname\n\n' + 'This adds a new user and assigns them to a group.\n' + 'You will be prompted for a password.', async function (apos, argv) {
      await self.addFromTask();
    });

    self.apos.task.add('@apostrophecms/user', 'change-password', 'Usage: node app @apostrophecms/user:change-password username\n\n' + 'This prompts you for a new password for the given user.', async function (apos, argv) {
      return self.changePasswordFromTask();
    });
    self.initializeCredential();
    self.addOurTrashPrefixFields();
    self.enableSecrets();
    await self.ensureGroups();
    await self.ensureSafe();
  },
  apiRoutes(self, options) {
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
  handlers(self, options) {
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
      // Reflect email and username changes in the safe after deduplicating in the piece
      afterTrash: {
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
  methods(self, options) {
    return {

      // Add `username` and `email` to the list of fields that automatically get uniquely prefixed
      // when a user is in the trash, so that they can be reused by another piece. When
      // the piece is rescued from the trash the prefix is removed again, unless the username
      // or email address has been claimed by another user in the meanwhile.

      addOurTrashPrefixFields() {
        self.addTrashPrefixFields([
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
      // If the secret does not match, the string `'invalid'` is
      // thrown as an exception. Otherwise the method returns
      // normally.

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
          throw new Error(`Incorrect ${secret}`);
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

      // Ensure the existence of the groups configured via the `groups` option,
      // if any, and refresh their permissions.

      async ensureGroups() {
        if (!options.groups) {
          return;
        }

        for (const group of options.groups) {
          await self.ensureGroup(group);
        }
        const groupField = _.find(self.schema, { name: 'group' });

        for (const group of options.groups) {
          groupField.choices.push({
            label: group.title,
            value: group._id
          });
        }
        if (options.groups.length) {
          groupField.def = options.groups[0]._id;
        }
      },

      // Create and/or refresh a group as specified by the
      // `groups` option. The group object is returned.
      //
      // The argument passed must have a `title` and
      // may have a `permissions` array and other
      // properties supported by groups. This is similar
      // to parked pages.

      async ensureGroup(group) {

        const criteria = {};
        const req = self.apos.task.getReq();

        if (group._id) {
          criteria._id = group._id;
        } else {
          criteria.title = group.title;
        }

        const _group = await self.apos.group.find(req, criteria).toObject();
        if (_group) {
          group._id = _group._id;
          if (group.permissions) {
            _group.permissions = group.permissions;
          }
          return self.apos.group.update(req, _group);
        }

        return self.apos.group.insert(req, group);
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
        const groupname = argv._[2] || argv.group || argv.groupname;
        if (!(username && groupname)) {
          throw 'You must specify --username=usernamehere and --group=groupnamehere';
        }
        const req = self.apos.task.getReq();
        // find the group
        const group = await self.apos.group.find(req, { title: groupname }).toObject();
        if (!group) {
          throw 'That group does not exist.';
        }
        prompt.start();
        const result = await Promise.promisify(prompt.get, { context: prompt })({
          properties: {
            password: {
              required: true,
              hidden: true
            }
          }
        });
        return self.apos.user.insert(req, {
          username: username,
          password: result.password,
          title: username,
          firstName: username,
          groupIds: [ group._id ]
        });
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

        prompt.start();

        const { password } = await Promise.promisify(prompt.get, { context: prompt })({
          properties: {
            password: {
              required: true,
              hidden: true
            }
          }
        });

        // This module's docBeforeUpdate handler does all the magic here
        user.password = password;
        return self.update(req, user);
      }
    };
  },
  extendMethods(self, options) {
    return {
      // Extend the standard middleware for the piece-editing routes
      // so that the `group` single-select property is automatically set
      // to the id of the first group in `groupIds`. This allows the single-select
      // dropdown element to work with data that actually lives in an array.
      requirePiece(_super, req, res, next) {
        return _super(req, res, function () {
          if (req.piece && req.piece.groupIds && req.piece.groupIds.length) {
            req.piece.group = req.piece.groupIds[0];
          }
          return next();
        });
      },
      find(_super, req, criteria, projection) {
        return _super(req, criteria, projection).published(null);
      }
    };
  },

  queries(self, query) {
    return {
      builders: {
        singleGroup: {
          def: self.options.groups,
          after(results) {
            const options = query.get('singleGroup');
            if (!options) {
              return;
            }
            for (const result of results) {
              if (result.groupIds) {
                result.group = result.groupIds[0];
              }
            }
          }
        }
      }
    };
  }
};
