var async = require('async');
var _ = require('lodash');
var pw = require('credential');

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

    options.removeFields = [ 'published' ].concat(options.removeFields || []);

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
        label: 'Username'
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
    }

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
        self.safe.ensureIndex({ email: 1 }, { safe: true, unique: true }, callback);
      }
    };

    self.docBeforeSave = function(req, doc, callback) {
      if (doc.type !== self.name) {
        return setImmediate(callback);
      }

      if (self.options.groups){
        doc.groupIds = [];
        doc.groupIds.push(doc.group);
        delete doc.group;
      }

      // cool safe things!
      var safeUser = {
        _id: doc._id,
        email: doc.email,
        username: doc.username,
        updatedAt: new Date()
      };

      return async.series({
        passwordHash: function(callback){
          return self.hashPassword(doc, safeUser, callback);
        },
        updateSafe: function(callback){
          return self.updateSafe(doc, safeUser, callback);
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

    self.updateSafe = function(doc, safeUser, callback){
      return self.safe.update({ _id: safeUser._id }, { $set: safeUser }, { upsert: true }, callback);
    };

    // when do you look for an orphan in the safe?
    // TO DO:  we write a task to find orphans which runs periodically
    // and checks for large discrepencies between updatesAts of docs
    // and corresponding users in the safe

    self.verifyPassword = function(userId, password, callback){
      var safeUser;
      return async.series({
         getSafeUser: function(callback){
           return self.safe.findOne({ _id: userId }, function(err, _safeUser){
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

  }
};
