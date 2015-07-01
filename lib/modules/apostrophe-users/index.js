var async = require('async');
var pw = require('credential');

module.exports = {

  alias: 'users',
  extend: 'apostrophe-pieces',
  name: 'apostrophe-user',
  label: 'User',
  pluralLabel: 'Users',
  addFields: [
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
      label: 'Disabled',
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
    },
    {
      type: 'select',
      name: 'permissions',
      label: 'Permissions',
      def: 'guest',
      choices: [
        {
          value: 'admin',
          label: 'Admin'
        },
        {
          value: 'editor',
          label: 'Editor'
        },
        {
          value: 'guest',
          label: 'Guest'
        }
      ]
    }
  ],

  afterConstruct: function(self, callback) {
    return self.ensureSafe(callback);
  },

  construct: function(self, options) {

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

      // cool things!
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
      return superFind(req, criteria, projection).published(null);
    };
  }
};
