// The `apostrophe-users` module provides user accounts. It is **not** intended to
// be extended with new subclass modules. The `apostrophe-login` module only
// looks for instances of `apostrophe-user`. Of course you may implicitly subclass
// it at project level (not changing the name) in order to alter its behavior.
//
// A user's permissions are determined by their membership in groups. See the
// join with `apostrophe-group` in the schema.
//
// Groups are managed by the `apostrophe-groups` module.
//
// There is also a simplified permissions model in which you just specify
// an array of `groups` as an option to `apostrophe-users`, and a single-select
// dropdown menu allows you to pick one and only one of those groups for each user.
// The recommended properties of each group in the array are `title`,
// `slug`, and `permissions`, which is an array of permission names such as
// `guest`, `edit` and `admin`. If you specify the `groups` option when
// configuring `apostrophe-users`, the admin interface for
// `apostrophe-groups` will hide itself. Specifying `slug` is optional,
// however if your site has many documents there will be a startup time
// penalty when specifying only `title` due to the lack of indexing
// on that property. For most larger sites we recommend not using the
// `groups` option at all; just manage groups via the admin bar.
//
// ### Public "staff directories" vs. users
//
// In our experience, combining the concept of a "user" who can log in and do things
// with the concept of a "staff member" who appears in a staff directory is more
// trouble than it is worth. That's why the `published` field is not present in
// `apostrophe-users`. You can add it back in, but then you have to deal with
// the confusing concept of "users" who shouldn't actually be allowed to log in.
//
// So for a staff directory, we suggest you create a separate `employee` module
// or similar, extending `apostrophe-pieces`, unless it's true that basically
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
// You may also call `apos.users.addSecret('name')` to add a new
// secret property. This is convenient when implementing a module
// such as `apostrophe-signup`.
//
// ### `disableInactiveAccounts` option
//
// If set to true, users from the "admin" group are whitelisted
// and the inactivity period is 90 days. Default values can be changed:
// - `neverDisabledGroups` must be an array of group names that should NOT be disabled due to
// not having logged in recently, like `[ 'admin' ]`.
// - `inactivityDuration` must be an integer number of days.
// Users who have not logged in in more than `inactivityDuration` days will not be permitted to
// log in again until an admin clears the `disabled` flag via
// "Manage Users."

var async = require('async');
var _ = require('@sailshq/lodash');
var credential = require('credential');
var Promise = require('bluebird');

module.exports = {

  alias: 'users',
  extend: 'apostrophe-pieces',
  name: 'apostrophe-user',
  label: 'User',
  pluralLabel: 'Users',
  // You can't give someone permission to edit users because that
  // allows them to make themselves an admin. -Tom
  adminOnly: true,
  // Means not included in public sitewide search. -Tom
  searchable: false,
  // Always prefix slugs for this type of piece to prevent conflicts
  // with frontend pieces
  slugPrefix: 'user-',

  afterConstruct: function(self, callback) {
    self.initializeCredential();
    self.addOurTrashPrefixFields();
    self.enableSecrets();
    self.addNonNullJoinMigration();
    return async.series([
      self.ensureGroups,
      self.ensureSafe
    ], callback);
  },

  beforeConstruct: function(self, options) {

    options.addFields = [
      {
        type: 'string',
        name: 'firstName',
        label: 'First Name'
      },
      {
        type: 'string',
        name: 'lastName',
        label: 'Last Name'
      },
      {
        type: 'string',
        name: 'title',
        label: 'Full Name',
        required: true
      },
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        required: true
      },
      {
        type: 'boolean',
        name: 'disabled',
        label: 'Login Disabled',
        def: false
      },
      {
        type: 'string',
        name: 'username',
        label: 'Username',
        required: true
      },
      {
        type: 'email',
        name: 'email',
        label: 'Email'
      },
      {
        type: 'password',
        name: 'password',
        label: 'Password'
      }
    ].concat(options.apos.login.options.totp ? [
      {
        type: 'boolean',
        name: 'resetTotp',
        label: 'Reset TOTP 2-Factor Authentication',
        help: 'For Google Authenticator. Use if the user no longer has access to their previous device.',
        def: false
      }
    ] : []).concat(options.addFields || []);

    if (options.groups) {
      options.addFields = options.addFields.concat([
        {
          type: 'select',
          name: 'group',
          label: 'Permission Group',
          def: 'guest',
          choices: []
        },
        {
          type: 'joinByArray',
          name: '_groups',
          label: 'Groups',
          idsField: 'groupIds',
          withType: 'apostrophe-group',
          contextual: true
        }
      ]);
    } else {
      options.addFields = options.addFields.concat([
        {
          type: 'joinByArray',
          name: '_groups',
          label: 'Groups',
          idsField: 'groupIds',
          withType: 'apostrophe-group'
        }
      ]);
    }

    options.removeFields = (options.defaultRemoveFields || [ 'published', 'tags' ])
      .concat(options.removeFields || []);

    options.removeFilters = (options.defaultRemoveFilters || [ 'published' ])
      .concat(options.removeFilters || []);

    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [ 'firstName', 'lastName', 'title', 'username', 'email', 'password', 'slug', 'group', '_groups', 'disabled', 'slug' ].concat(options.apos.login.totp ? [ 'resetTotp' ] : []).concat(options.apos.docs.trashInSchema ? [ 'trash' ] : [])
      }
    ].concat(options.arrangeFields || []);

    if (options.disableInactiveAccounts) {
      var defaults = {
        neverDisabledGroups: ['admin'],
        inactivityDuration: 90
      };

      options.disableInactiveAccounts = Object.assign({}, defaults, options.disableInactiveAccounts);
    }
  },

  construct: function(self, options) {
    // Add `username` and `email` to the list of fields that automatically get uniquely prefixed
    // when a user is in the trash, so that they can be reused by another piece. When
    // the piece is rescued from the trash the prefix is removed again, unless the username
    // or email address has been claimed by another user in the meanwhile.

    self.addOurTrashPrefixFields = function() {
      self.addTrashPrefixFields([ 'username', 'email' ]);
    };

    // See `options.secrets` and also the `addSecret` method. `enableSecrets`
    // is part of the implementation and should not be called directly.

    self.enableSecrets = function() {
      self.secrets = self.options.secrets || [];
    };

    // Index and obtain access to the `aposUsersSafe` MongoDB collection as `self.safe`.

    self.ensureSafe = function(callback) {
      return self.ensureSafeCollection(function(err) {
        if (err) {
          return callback(err);
        }
        self.on('apostrophe:migrate', 'ensureSafeIndexesPromisified', function() {
          return require('bluebird').promisify(self.ensureSafeIndexes)();
        });
        return callback(null);
      });
    };

    // Obtain the `aposUsersSafe` MongoDB collection as `self.safe`.

    self.ensureSafeCollection = function(callback) {
      return self.apos.db.collection('aposUsersSafe', function(err, collection) {
        self.safe = collection;
        return callback(err);
      });
    };

    // Index the safe.

    self.ensureSafeIndexes = function(callback) {
      return async.series([ indexUsername, indexEmail ], callback);

      function indexUsername(callback) {
        self.safe.ensureIndex({ username: 1 }, { unique: true }, callback);
      }
      function indexEmail(callback) {
        self.safe.ensureIndex({ email: 1 }, { unique: true, sparse: true }, callback);
      }
    };

    // After a user is updated, check to see if the `groups` option is configured for
    // simplified user management. If it is, convert the single-select choice made
    // via `piece.group` to an array stored in `groupIds`, so that all other code
    // can find groups in a consistent way.

    self.afterConvert = function(req, piece, callback) {
      if (self.options.groups) {
        piece.groupIds = [];
        piece.groupIds.push(piece.group);
        delete piece.group;
      }
      return setImmediate(callback);
    };

    // For security, on **ANY** insert of a doc, we check to see if it is
    // an `apostrophe-user` and, if so, hash the password, remove it from the doc
    // and store the hash in the safe instead.
    //
    // This method also checks password rules if they are in force
    // and local logins are enabled.

    self.docBeforeInsert = function(req, doc, options, callback) {
      if (doc.type !== self.name) {
        return setImmediate(callback);
      }
      if (self.apos.login.options.localLogin !== false) {
        // Do not reject accounts with no password at all at
        // this level. This is already prevented in the UI by other rules,
        // and we don't want to reject all accounts created by
        // apostrophe-passport, which does not involve passwords
        if ((typeof doc.password) === 'string') {
          var errors = self.apos.login.checkPasswordRules(req, doc.password);
          if (errors.length) {
            req.errorMessages = errors;
            return callback('rules');
          }
        }
      }
      return self.insertOrUpdateSafe(req, doc, 'insert', callback);
    };

    // For security, on **ANY** update of a doc, we check to see if it is
    // an `apostrophe-user` and, if so, hash the password, remove it from the doc
    // and store the hash in the safe instead.

    self.docBeforeUpdate = function(req, doc, options, callback) {
      if (doc.type !== self.name) {
        return setImmediate(callback);
      }
      // For an update we are only concerned with the password rules if a
      // new value is being set
      if (((typeof doc.password) === 'string') && doc.password.length && self.apos.login.options.localLogin !== false) {
        var errors = self.apos.login.checkPasswordRules(req, doc.password);
        if (errors.length) {
          req.errorMessages = errors;
          return callback('rules');
        }
      }
      return self.insertOrUpdateSafe(req, doc, 'update', callback);
    };

    self.on('apostrophe-docs:beforeSave', 'resetTotp', function(req, doc) {
      if (doc.type !== self.name) {
        return;
      }
      if (self.apos.login.options.totp) {
        if (doc.resetTotp) {
          delete doc.resetTotp;
          return self.safe.update({
            _id: doc._id
          }, {
            $unset: {
              totp: 1
            }
          });
        }
      }
    });

    // Insert or update a user's record in the safe, which stores the
    // password hash completely outside of the `aposDocs` collection.
    // First checks to be sure this is an `apostrophe-user` and invokes
    // its callback immediately if not. Invoked by `docBeforeInsert`
    // and `docBeforeUpdate`.

    self.insertOrUpdateSafe = function(req, doc, action, callback) {
      if (doc.type !== self.name) {
        return setImmediate(callback);
      }

      // Store password hash exclusively in the safe so that it can never be
      // accidentally exposed as part of a query on docs. Also store the username
      // and, if present, the email address to take advantage of unique and
      // sparse indexes which prevent duplication.
      var safeUser = {
        _id: doc._id,
        username: doc.username,
        updatedAt: new Date()
      };

      if (doc.email) {
        safeUser.email = doc.email;
      }

      return async.series({
        passwordHash: function(callback) {
          return self.hashPassword(doc, safeUser, callback);
        },
        secrets: function(callback) {
          return self.hashSecrets(doc, safeUser, callback);
        },
        safe: function(callback) {
          if (action === 'insert') {
            return self.safe.insert(safeUser, callback);
          }
          var changes = {
            $set: safeUser
          };
          if (!safeUser.email) {
            // Sparse indexes are only sparse on null/undefined, an empty string is not good enough
            changes.$unset = {
              email: 1
            };
          }
          return self.safe.update({ _id: safeUser._id }, changes, callback);
        }
      }, callback);
    };

    // Hash the `password` property of `doc`, then delete that property
    // and update the `passwordHash` property of `safeUser`. This method is
    // called by the `docBeforeInsert` and `docBeforeSave handlers of this
    // module. If `password` is falsy (i.e. the user left it blank,
    // requesting no change), it is left alone and `safeUser` is
    // not updated.

    self.hashPassword = function(doc, safeUser, callback) {
      return self.hashSecret(doc, safeUser, 'password', callback);
    };

    // Similar to `hashPassword`, this method hashes all of the properties
    // enumerated in `options.secrets` and via `addSecrets`, then deletes them
    // and updates the corresponding properties of `safeUser`. If
    // a secret is named `signup`, the corresponding property in
    // `safeUser` will be named `signupHash`.
    //
    // This method is called by the `docBeforeInsert` and `docBeforeSave`
    // handlers of this module.

    self.hashSecrets = function(doc, safeUser, callback) {
      return async.eachSeries(self.secrets, function(secret, callback) {
        return self.hashSecret(doc, safeUser, secret, callback);
      }, callback);
    };

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

    self.addSecret = function(name) {
      self.secrets.push(name);
    };

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

    self.hashSecret = function(doc, safeUser, secret, callback) {
      if (!doc[secret]) {
        return callback(null);
      }
      return self.pw.hash(doc[secret], function(err, hash) {
        if (err) {
          return callback(err);
        }
        delete doc[secret];
        safeUser[secret + 'Hash'] = hash;
        return callback(null);
      });
    };

    // Verify the given password by checking it against the
    // hash in the safe. `user` is an `apostrophe-user` doc.

    self.verifyPassword = function(user, password, callback) {
      return self.verifySecret(user, 'password', password, callback);
    };

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
    // without ever storing the actual value of the secret.
    //
    // If no callback is passed, a promise is returned.
    // If the verification fails the promise is rejected.

    self.verifySecret = function(user, secret, attempt, callback) {
      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)();
      }
      function body(callback) {
        var safeUser;
        return async.series({
          getSafeUser: function(callback) {
            return self.safe.findOne({ _id: user._id }, function(err, _safeUser) {
              if (err) {
                return callback(err);
              }
              safeUser = _safeUser;
              return callback(null);
            });
          },
          verifyHash: function(callback) {
            if (!safeUser) {
              return callback(new Error('No such user in the safe.'));
            }
            return self.pw.verify(safeUser[secret + 'Hash'], attempt, function(err, isValid) {
              if (err) {
                return callback(err);
              }
              if (!isValid) {
                return callback(new Error('Incorrect ' + secret));
              }
              return callback(null);
            });
          }
        }, callback);
      }
    };

    // Forget the secret associated with the property name
    // passed in `secret`. If `secret` is `'passwordReset'`,
    // then the `passwordResetHash` property is deleted from
    // the appropriate record in the `aposUsersSafe`
    // collection. Note that the plaintext of the secret
    // was never stored in the database in the first place.
    //
    // If no callback is passed, a promise is returned.

    self.forgetSecret = function(user, secret, callback) {
      if (callback) {
        return body(callback);
      } else {
        return Promise.promisify(body)();
      }
      function body(callback) {
        var changes = {
          $unset: {}
        };
        changes.$unset[secret + 'Hash'] = 1;
        return self.safe.update({
          _id: user._id
        }, changes, callback);
      }
    };

    var superDeduplicateTrash = self.deduplicateTrash;
    // Reflect email and username changes in the safe after deduplicating in the piece
    self.deduplicateTrash = function(req, piece, callback) {
      return superDeduplicateTrash(req, piece, function(err) {
        if (err) {
          return callback(err);
        }
        return self.insertOrUpdateSafe(req, piece, 'update', callback);
      });
    };

    var superDeduplicateRescue = self.deduplicateRescue;
    // Reflect email and username changes in the safe after deduplicating in the piece
    self.deduplicateRescue = function(req, piece, callback) {
      return superDeduplicateRescue(req, piece, function(err) {
        if (err) {
          return callback(err);
        }
        return self.insertOrUpdateSafe(req, piece, 'update', callback);
      });
    };

    // Ensure the existence of the groups configured via the `groups` option,
    // if any, and refresh their permissions.

    self.ensureGroups = function(callback) {
      if (!options.groups) {
        return setImmediate(callback);
      }

      return async.eachSeries(options.groups, function(group, callback) {
        return self.ensureGroup(group, callback);
      }, function(err) {
        if (err) {
          return callback(err);
        }
        var groupField = _.find(self.schema, {name: 'group'});
        _.each(options.groups, function(group) {
          groupField.choices.push({
            label: group.title,
            value: group._id
          });
        });
        if (options.groups.length) {
          groupField.def = options.groups[0]._id;
        }
        return callback(null);
      });
    };

    // Create and/or refresh a group as specified by the
    // `groups` option. The group is the second argument
    // to the callback.

    self.ensureGroup = function(group, callback) {
      var criteria = {};
      var req = self.apos.tasks.getReq();

      if (group._id) {
        criteria._id = group._id;
      } else if (group.slug) {
        criteria.slug = group.slug;
      } else {
        criteria.title = group.title;
      }

      return self.apos.groups.find(req, criteria).joins(false).toObject(function(err, _group) {
        if (err) {
          return callback(err);
        }
        if (_group) {
          group._id = _group._id;
          if (group.permissions) {
            _group.permissions = group.permissions;
          }
          return self.apos.groups.update(req, _group, function(err) {
            if (err) {
              return callback(err);
            }
            return callback(null, _group);
          });
        }
        return self.apos.groups.insert(req, group, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, group);
        });
      });
    };

    var superRequirePiece = self.requirePiece;
    // Extend the standard middleware for the piece-editing routes
    // so that the `group` single-select property is automatically set
    // to the id of the first group in `groupIds`. This allows the single-select
    // dropdown element to work with data that actually lives in an array.
    self.requirePiece = function(req, res, next) {
      return superRequirePiece(req, res, function() {
        if (req.piece && req.piece.groupIds && req.piece.groupIds.length) {
          req.piece.group = req.piece.groupIds[0];
        }
        return next();
      });
    };

    // Initialize the [credential](https://npmjs.org/package/credential) module.
    self.initializeCredential = function() {
      self.pw = credential();
    };

    self.apos.tasks.add('apostrophe-users', 'add',
      'Usage: node app apostrophe-users:add username groupname\n\n' +
      'This adds a new user and assigns them to a group.\n' +
      'You will be prompted for a password.',
      function(apos, argv, callback) {
        return self.addFromTask(callback);
      }
    );

    // Implement the `apostrophe-users:add` command line task.

    self.addFromTask = function(callback) {
      var argv = self.apos.argv;
      if (argv._.length !== 3) {
        return callback('Incorrect number of arguments.');
      }
      var username = argv._[1];
      var groupname = argv._[2];
      var req = self.apos.tasks.getReq();
      // find the group
      self.apos.groups.find(req, { title: groupname }).joins(false).toObject(function(err, group) {
        if (err) {
          return callback(err);
        }
        if (!group) {
          return callback('That group does not exist.');
        }
        return promptForPassword('Password: ', function(err, password) {
          if (!err) {
            // If we call this ourselves we can report the error details nicely
            var errors = self.apos.login.checkPasswordRules(req, password);
            if (errors.length) {
              err = errors.join('\n');
            }
          }
          if (err) {
            return callback(err);
          }
          self.apos.users.insert(req, {
            username: username,
            password: password,
            title: username,
            firstName: username,
            groupIds: [ group._id ]
          }, callback);
        });
      });
    };

    self.apos.tasks.add('apostrophe-users', 'change-password',
      'Usage: node app apostrophe-users:change-password username\n\n' +
      'This prompts you for a new password for the given user.',
      function(apos, argv, callback) {
        return self.changePasswordFromTask(callback);
      }
    );

    if (self.apos.login.options.totp) {
      self.apos.tasks.add('apostrophe-users', 'reset-totp',
        'Usage: node app apostrophe-users:reset-totp username\n\n' +
        'This resets two-factor Google authentication (TOTP) for the user.',
        function(apos, argv) {
          return self.safe.update({
            username: argv._[1]
          }, {
            $unset: {
              totp: 1
            }
          }).then(function(result) {
            if (result.result.n !== 1) {
              throw 'No such user.';
            } else if (result.result.nModified !== 1) {
              throw 'That user is already reset for two-factor authentication.';
            }
          });
        }
      );
    }

    // Implement the `apostrophe-users:change-password` task.

    self.changePasswordFromTask = function(callback) {
      var argv = self.apos.argv;
      if (argv._.length !== 2) {
        return callback('Incorrect number of arguments.');
      }
      var username = argv._[1];
      var req = self.apos.tasks.getReq();
      var user;
      var password;

      return async.series([
        findUser, getPassword, setPassword
      ], callback);

      function findUser(callback) {
        return self.apos.users.find(req, { username: username }).toObject(function(err, _user) {
          if (err) {
            return callback(err);
          }
          if (!_user) {
            return callback(new Error('No such user.'));
          }
          user = _user;
          return callback(null);
        });
      }

      function getPassword(callback) {
        return promptForPassword('New Password: ', function(err, _password) {
          password = _password;
          if (!err) {
            // If we call this ourselves we can report the error details nicely
            var errors = self.apos.login.checkPasswordRules(req, password);
            if (errors.length) {
              err = errors.join('\n');
            }
          }
          return callback(err);
        });
      }

      function setPassword(callback) {
        // This module's docBeforeUpdate handler does all the magic here
        user.password = password;
        return self.update(req, user, callback);
      }
    };

    // A route which accepts a `username` POST parameter and responds
    // with `{ status: 'ok', available: true}` if that username is
    // NOT TAKEN, otherwise `{ status: 'ok', available: false }`.
    // If `status` is not `ok` then an error occurred. Used to help
    // users discover available usernames when creating accounts.

    self.apiRoute('post', 'unique-username', function(req, res, next) {
      var username = self.apos.launder.string(req.body.username);
      return self.find(req, { username: username }).projection({ _id: 1, username: 1 }).toObject(function(err, user) {
        return next(err, { available: !user });
      });
    });

    self.addNonNullJoinMigration = function() {
      self.apos.migrations.add(self.__meta.name + ':non-null-joins', function() {
        var fields = {
          'viewUsersIds': [],
          'viewGroupsIds': [],
          'editUsersIds': [],
          'editGroupsIds': []
        };
        return Promise.mapSeries(_.keys(fields), function(name) {
          var criteria = {};
          criteria[name] = { $type: 10 };
          var $set = {};
          $set[name] = fields[name];
          return self.apos.docs.db.update(criteria, {
            $set: $set
          }, {
            multi: true
          });
        });
      });
    };
  }
};

function promptForPassword(prompt, callback) {
  // readline is standard in node
  var rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  // secrecy is not standard. Only output the prompt
  var first = true;
  rl._writeToOutput = function _writeToOutput(s) {
    if (first) {
      process.stdout.write(s);
      first = false;
    }
  };
  rl.question(prompt, function(answer) {
    rl.close();
    // eslint-disable-next-line
    console.log();
    return callback(null, answer);
  });
}
