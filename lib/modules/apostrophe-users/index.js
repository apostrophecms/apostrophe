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
// The properties of each group in the array are `name`, `label` and
// `permissions`, which is an array of permission names such as `guest`, `edit` and
// `admin`. If you specify the `groups` option when configuring
// `apostrophe-users`, the admin interface for `apostrophe-groups` will hide itself.
//
// ### Public "staff directories" vs. users
//
// In our experience, combing the concept of a "user" who can log in and do things
// with the concept of a "staff member" who appears in a staff directory is more
// trouble than it is worth. That's why the `published` field is not present in
// `apostrophe-users`. You can add it back in, but then you have to deal with
// the confusing concept of "users" who shouldn't actually be allowed to log in.
//
// So for a staff directory, we suggest you create a separate `employee` module
// or similar, extending `apostrophe-pieces`, unless it's true that basically
// everyone should be allowed to log in.

var async = require('async');
var _ = require('lodash');
var credential = require('credential');
var prompt = require('prompt');

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

  afterConstruct: function(self, callback) {
    self.initializeCredential();
    self.addOurTrashPrefixFields();
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
        label: 'Full Name'
      },
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        prefix: 'user',
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
        type: 'string',
        name: 'email',
        label: 'Email'
      },
      {
        type: 'password',
        name: 'password',
        label: 'Password'
      }
    ].concat(options.addFields || []);

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
        fields: [ 'firstName', 'lastName', 'title', 'username', 'email', 'password', 'slug', 'group', '_groups', 'disabled', 'slug' ]
      }
    ].concat(options.arrangeFields || []);
  },

  construct: function(self, options) {

    // Add `username` and `email` to the list of fields that automatically get uniquely prefixed
    // when a user is in the trash, so that they can be reused by another piece. When
    // the piece is rescued from the trash the prefix is removed again, unless the username
    // or email address has been claimed by another user in the meanwhile.

    self.addOurTrashPrefixFields = function() {
      self.addTrashPrefixFields([ 'username', 'email' ]);
    };

    // Index and obtain access to the `aposUsersSafe` MongoDB collection as `self.safe`.

    self.ensureSafe = function(callback) {
      return async.series([
        self.ensureSafeCollection,
        self.ensureSafeIndexes
      ], callback);
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
      if (self.options.groups){
        piece.groupIds = [];
        piece.groupIds.push(piece.group);
        delete piece.group;
      }
      return setImmediate(callback);
    };

    // For security, on **ANY** insert of a doc, we check to see if it is
    // an `apostrophe-user` and, if so, hash the password, remove it from the doc
    // and store the hash in the safe instead.

    self.docBeforeInsert = function(req, doc, options, callback) {
      return self.insertOrUpdateSafe(req, doc, 'insert', callback);
    };

    // For security, on **ANY** update of a doc, we check to see if it is
    // an `apostrophe-user` and, if so, hash the password, remove it from the doc
    // and store the hash in the safe instead.

    self.docBeforeUpdate = function(req, doc, options, callback) {
      return self.insertOrUpdateSafe(req, doc, 'update', callback);
    };

    // Insert or update a user's record in the safe, which stores the
    // password hash completely outside of the `aposDocs` collection.
    // First checks to be sure this is an `apostrophe-user` and invokes
    // its callback immediately if not. Invoked by `docBeforeInsert`
    // and `docBeforeSave`.

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
    // called by the `docBeforeSave` handler of this module.

    self.hashPassword = function(doc, safeUser, callback){
      if (!doc.password) {
        return setImmediate(callback);
      }
      return self.pw.hash(doc.password, function(err, hash){
        if (err){
          return callback(err);
        }
        delete doc.password;
        safeUser.passwordHash = hash;
        return callback(null);
      });
    };

    // Verify the given password by checking it against the
    // hash in the safe. `user` is an `apostrophe-user` doc.

    self.verifyPassword = function(user, password, callback){
      var safeUser;
      return async.series({
         getSafeUser: function(callback){
           return self.safe.findOne({ _id: user._id }, function(err, _safeUser){
             if (err){
               return callback(err);
             }
             safeUser = _safeUser;
             return callback(null);
           });
         },
         verifyHash: function(callback){
           if (!safeUser){
             return callback(new Error('No such user in the safe.'));
           }
           return self.pw.verify(safeUser.passwordHash, password, function(err, isValid){
             if (err){
               return callback(err);
             }
             if (!isValid) {
               return callback(new Error('Incorrect password'));
             }
             return callback(null);
           });
         }
      }, callback);
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

    self.ensureGroups = function(callback){
      if (!options.groups){
        return setImmediate(callback);
      }

      return async.eachSeries(options.groups, function(group, callback){
        return self.ensureGroup(group, callback);
      }, function(err){
        if(err) {
          return callback(err);
        }
        var groupField = _.find(self.schema, {name: 'group'});
        _.each(options.groups, function(group){
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
    // `groups` option.

    self.ensureGroup = function(group, callback) {
      var criteria = {};
      var req = self.apos.tasks.getReq();

      if (group._id) {
        criteria._id = group._id;
      } else {
        criteria.title = group.title;
      }

      return self.apos.groups.find(req, criteria).toObject(function(err, _group){
        if (err){
          return callback(err);
        }
        if (_group){
          group._id = _group._id
          _group.permissions = group.permissions;
          return self.apos.groups.update(req, _group, callback);
        }
        return self.apos.groups.insert(req, group, callback);
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
      if(argv._.length !== 3 ){
        return callback('Incorrect number of arguments.');
      }
      var username = argv._[1];
      var groupname = argv._[2];
      var req = self.apos.tasks.getReq();
      // find the group
      self.apos.groups.find(req, {title: groupname}).toObject(function(err, group){
        if(err){
          return callback(err);
        }
        if(!group){
          return callback('That group does not exist.');
        }
        prompt.start();
        prompt.get({
          properties: {
            password: {
              required: true,
              hidden: true
            }
          }
        }, function(err, result){
          if(err){
            return callback(err);
          }
          self.apos.users.insert(req, {
            username: username,
            password: result.password,
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

    // Implement the `apostrophe-users:change-password` task.

    self.changePasswordFromTask = function(callback) {
      var argv = self.apos.argv;
      if(argv._.length !== 2){
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
        prompt.start();
        return prompt.get({
          properties: {
            password: {
              required: true,
              hidden: true
            }
          }
        }, function(err, result) {
          if (err) {
            return callback(err);
          }
          password = result.password;
          return callback(null);
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

    self.route('post', 'unique-username', function(req, res) {
      var username = self.apos.launder.string(req.body.username);
      return self.find(req, { username: username }).projection({ _id: 1, username: 1 }).toObject(function(err, user) {
        if (err) {
          return res.send({ status: 'error' });
        }
        return res.send({ status: 'ok', available: !user });
      });
    });

  }
};
