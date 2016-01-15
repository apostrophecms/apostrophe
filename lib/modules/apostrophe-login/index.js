var Passport = require('passport').Passport;
var LocalStrategy = require('passport-local');
var _ = require('lodash');


module.exports = {

  afterConstruct: function(self){
    self.enableSerializeUsers();
    self.enableDeserializeUsers();
    self.enableLocalStrategy();
    self.enableMiddleware();
    self.addRoutes();
    self.pushAssets();
  },

  construct: function(self, options){

    self.passport = new Passport();

    self.enableSerializeUsers = function(){
      self.passport.serializeUser(function(user, done){
        done(null, user._id);
      });
    };

    self.enableDeserializeUsers = function(){
      self.passport.deserializeUser(function(id, done){
        var req = self.apos.tasks.getReq();
        self.apos.users.find(req, { _id: id }).toObject(function(err, user){
          if (err){
            return done(err);
          }
          if (!user) {
            return done(err, null);
          }
          self.apos.callAll('loginDeserialize', user, function(err){
            return done(err, user);
          });
        });
      });
    };

    self.loginDeserialize = function(user){
      user._permissions = {};
      _.each(user._groups, function(group) {
       _.each(group.permissions || [], function(permission) {
          user._permissions[permission] = true;
       });
     });
     _.each(user.permissions || [], function(permission) {
        user._permissions[permission] = true;
     });
     // The standard permissions are progressive
     if (user._permissions.admin) {
       user._permissions.edit = true;
     }
     if (user._permissions.edit) {
       user._permissions.guest = true;
     }
     // If you are admin- for any type of content, you need to be
     // at least guest to effectively attach media to your content,
     // and the edit permission also makes sense because it does not
     // immediately let you do anything, just makes it easier to see
     // you are a candidate to do things like edit pages if given
     // specific rights to them. Also simplifies outerLayout's logic
     if (_.some(user._permissions, function(val, key) {
       return key.match(/^admin\-/);
     })) {
       user._permissions.guest = true;
       user._permissions.edit = true;
      }
    };

    self.enableLocalStrategy = function(){
      self.passport.use(new LocalStrategy(function(username, password, done){
        var req = self.apos.tasks.getReq();
        self.apos.users.find(req, { $or: [{ username: username },{ email: username }] }).toObject(function(err, user){
          if(err){
            return done(err);
          }
          if(!user){
            return done(null, false, { message: 'Your username or password was incorrect'});
          }
          self.apos.users.verifyPassword(user, password, function(err){
            if(err){
              return done(null, false, { message: 'Your username or password was incorrect'});
            }
            self.apos.callAll('login', function(err){
              return done(err, user);
            });
          });
        });
      }));
    };

    self.enableMiddleware = function(){
      self.apos.app.use(self.passport.initialize());
      self.apos.app.use(self.passport.session());
      self.apos.app.use(self.addUserToData);
    };

    self.addRoutes = function(){
      self.apos.app.get('/login', function(req, res){
        req.scene = 'user';
        res.send(self.renderPage(req, 'login', { message: req.flash('error')}));
      });
      self.apos.app.post('/login',
        self.passport.authenticate('local', {
          failureRedirect: '/login',
          failureFlash: true
        }),
        function(req, res){
          // console.log('my prefix is'+self.apos.prefix);
          res.redirect('/');
        }
      );
      self.apos.app.get('/logout', function(req, res){
        req.logout();
        res.redirect('/');
      });
    };

    self.addUserToData = function(req, res, next){
      if (req.user) {
        req.data.user = req.user;
        return next();
      } else {
        return next();
      }
    };

    self.pushAssets = function() {
      self.pushAsset('stylesheet', 'always');
    };

  }
}
