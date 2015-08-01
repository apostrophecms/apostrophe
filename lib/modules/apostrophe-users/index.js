var async = require('async');
var _ = require('lodash');
var pw = require('credential');
var prompt = require('prompt');

module.exports = {

  alias: 'users',
  extend: 'apostrophe-pieces',
  name: 'apostrophe-user',
  label: 'User',
  pluralLabel: 'Users',

  afterConstruct: function(self, callback) {
    return async.series([
      self.ensureGroups,
      self.ensureSafe
    ], callback);
  },

  construct: function(self, options) {

    options.removeFields = (self.options.minimumRemoved || [ 'published' ])
      .concat(options.removeFields || []);

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
        label: 'Title'
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
      },
      {
        type: 'radioTable',
        name: 'permissions',
        label: 'User Permissions',
        def: '',
        choices: [
          {
            label: 'Admin',
            value: 'admin'
          },
          {
            label: 'Editor',
            value: 'edit'
          },
          {
            label: 'None',
            value: ''
          }
        ],
        rows: [
          {
            name: 'apple',
            label: 'Apple'
          },
          {
            name: 'orange',
            label: 'Orange'
          },
          {
            name: 'watermelon',
            label: 'watermelon'
          }
        ]
      }
    ].concat(options.addFields || []);

    if (options.groups){
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

    self.ensureSafe = function(callback) {
      return async.series([
        self.ensureSafeCollection,
        self.ensureSafeIndexes
      ], callback);
    };

    self.ensureSafeCollection = function(callback) {
      return self.apos.db.collection('aposUsersSafe', function(err, collection) {
        self.safe = collection;
        return callback(err);
      });
    };

    self.ensureSafeIndexes = function(callback) {
      return async.series([ indexUsername, indexEmail ], callback);

      function indexUsername(callback) {
        self.safe.ensureIndex({ username: 1 }, { safe: true, unique: true }, callback);
      }
      function indexEmail(callback) {
        self.safe.ensureIndex({ email: 1 }, { safe: true, unique: true, sparse: true }, callback);
      }
    };

    self.afterConvert = function(req, piece, callback) {
      if (self.options.groups){
        piece.groupIds = [];
        piece.groupIds.push(piece.group);
        delete piece.group;
      }
      return setImmediate(callback);
    };

    self.docBeforeInsert = function(req, doc, callback) {
      return self.insertOrUpdateSafe(req, doc, 'insert', callback);
    };

    self.docBeforeUpdate = function(req, doc, callback) {
      return self.insertOrUpdateSafe(req, doc, 'update', callback);
    };

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
            changes.$unset = {
              email: 1
            };
          }
          return self.safe.update({ _id: safeUser._id }, changes, callback);
        }
      }, callback);
    };

    self.hashPassword = function(doc, safeUser, callback){
      if (!doc.password) {
        return setImmediate(callback);
      }
      return pw.hash(doc.password, function(err, hash){
        if (err){
          return callback(err);
        }
        delete doc.password;
        safeUser.passwordHash = hash;
        return callback(null);
      });
    };

    // when do you look for an orphan in the safe?
    // TO DO:  we write a task to find orphans which runs periodically
    // and checks for large discrepencies between updatesAts of docs
    // and corresponding users in the safe

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
           return pw.verify(safeUser.passwordHash, password, function(err, isValid){
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

    // Since users are never piublished,
    // if you are deliberately fetching users,
    // we assume you don't care if they are published.

    var superFind = self.find;
    self.find = function(req, criteria, projection){
      var cursor = superFind(req, criteria, projection).published(null);
      // Add filters meant specifically for users
      require('./lib/cursor.js')(self, cursor);
      return cursor;

    };

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

    self.apos.tasks.add('apostrophe-users', 'add',
     'Usage: node app apostrophe-users:add username groupname\n\n' +
     'This adds a new user and assigns them to a group.\n' +
     'You will be prompted for a password.',
     function(apos, argv, callback) {
       return self.addFromTask(callback);
     }
   );

   self.addFromTask = function(callback){
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



  }
};
