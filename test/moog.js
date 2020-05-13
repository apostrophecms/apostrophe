const assert = require('assert');

describe('moog', function() {
  it('should exist', function() {
    const moog = require('../lib/moog.js')({ });
    assert(moog);
  });

  it('should be initialized without arguments', function() {
    const moog = require('../lib/moog.js')();
    assert(moog);
  });

  describe('methods', function() {
    it('should have a `define` method', function() {
      const moog = require('../lib/moog.js')({});
      assert(moog.define);
    });

    it('should have a `redefine` method', function() {
      const moog = require('../lib/moog.js')({});
      assert(moog.redefine);
    });

    it('should have a `create` method', function() {
      const moog = require('../lib/moog.js')({});
      assert(moog.create);
    });

    it('should have an `isDefined` method', function() {
      const moog = require('../lib/moog.js')({});
      assert(moog.isDefined);
    });
  });

  describe('defining and creating', function() {
    it('should be able to `define` a class', function() {
      const moog = require('../lib/moog.js')({});

      moog.define('myObject', {
        methods(self, options) {
          return {};
        }
      });
    });

    it('should be able to `define` and then `create` an instance', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('myObject', {
        options: {
          color: 'blue'
        },
        init(self, options) {
          self.color = options.color;
        }
      });

      const myObject = await moog.create('myObject', {});
      assert(myObject);
      assert(myObject.color === 'blue');
    });
  });

  describe('`create` syntax', function() {
    it('should `create` without options', async function() {
      const moog = require('../lib/moog.js')();

      moog.define('myClass', {});

      const myObj = await moog.create('myClass');
      assert(myObj);
      assert(myObj.__meta.name === 'myClass');
    });

  });

  describe('explicit subclassing behavior', function() {

    it('should be able to create a subclass with expected default option behavior (async)', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('baseClass', {
        options: {
          color: 'blue'
        }
      });

      moog.define('subClass', {
        options: {
          color: 'red'
        },
        extend: 'baseClass'
      });

      const myObject = await moog.create('subClass', {});
      assert(myObject);
      assert(myObject.options.color === 'red');
    });

    it('should report an error gracefully if subclass to be extended does not exist (async)', async function() {
      const moog = require('../lib/moog.js')({});

      // base class does not actually exist
      moog.define('subClass', {
        options: {
          color: 'red'
        },
        extend: 'baseClass'
      });

      try {
        await moog.create('subClass', {});
        assert(false);
      } catch (e) {
        assert(e);
        assert(e.toString().match(/baseClass/));
      }
    });

    it('should be able to `extend` a subclass into yet another subclass', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('baseClass', {
        options: {
          color: 'blue'
        }
      });

      moog.define('subClassOne', {
        options: {
          color: 'red'
        },
        extend: 'baseClass'
      });

      moog.define('subClassTwo', {
        options: {
          color: 'green'
        },
        extend: 'subClassOne'
      });

      const myObject = await moog.create('subClassTwo', {});
      assert(myObject);
      assert(myObject.options.color === 'green');
    });

    it('default base class should take effect if configured', async function() {
      const moog = require('../lib/moog.js')({ defaultBaseClass: 'baseClass' });

      moog.define('baseClass', {
        init(self, options) {
          assert(self.__meta);
          assert(self.__meta.chain);
          assert(self.__meta.chain[0]);
          assert(self.__meta.chain[0].name === 'baseClass');
          assert(self.__meta.chain[1].name === 'subClass');
          assert(self.__meta.name === 'subClass');
          self.color = options.color;
        }
      });

      moog.define('subClass', {
        options: {
          color: 'red'
        }
      });

      const myObject = await moog.create('subClass', {});
      assert(myObject);
      // This verifies that init() for base class actually ran
      assert(myObject.color === 'red');
    });

    it('default base class should not take effect if extend is explicitly set to false', async function() {
      const moog = require('../lib/moog.js')({ defaultBaseClass: 'baseClass' });

      moog.define('baseClass', {
        construct: function(self, options) {
          self.based = true;
        }
      });

      moog.define('subClass', {
        options: {
          color: 'red'
        },
        extend: false
      });

      const myObject = await moog.create('subClass', {});
      assert(myObject);
      assert(!myObject.based);
    });

    it('should define methods and allow overriding and extending them through implicit subclassing', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('myObject', {
        methods(self, options) {
          return {
            basic() {
              return true;
            },
            overridden() {
              return false;
            },
            extended(times) {
              return 2 * times;
            }
          }
        }
      });

      moog.define('myObject', {
        methods(self, options) {
          return {
            overridden() {
              return true;
            }
          }
        },
        extendMethods(self, options) {
          return {
            extended(_super, times) {
              return _super(times) * 2;
            }
          }; 
        }
      });

      const myObject = await moog.create('myObject', {});
      assert(myObject);
      assert(myObject.basic());
      assert(myObject.overridden());
      assert(myObject.extended(5) === 20);
    });

    // ==================================================
    // `redefine` AND `isDefined`
    // ==================================================

    it('should allow a module to be redefined', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('myObject', {
        methods(self, options) {
          return {
            oldMethod() {}
          }
        }
      });

      moog.redefine('myObject', {
        methods(self, options) {
          return {
            newMethod() {}
          }
        }
      });

      const myObject = await moog.create('myObject', {});
      assert(myObject);
      assert(!myObject.oldMethod);
      assert(myObject.newMethod);
    });

    it('should find a module definition using `isDefined`', function() {
      const moog = require('../lib/moog.js')({});

      moog.define('myObject', {});

      assert(moog.isDefined('myObject'));
    });

    it('should NOT find a non-existant module definition using `isDefined`', function() {
      const moog = require('../lib/moog.js')({});

      assert(!moog.isDefined('myObject'));
    });

  });

  describe('implicit subclassing behavior', function() {
    it('should allow a class defined twice to be implicitly subclassed', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('myObject', {
        init(self, options) {
          self.order = (self.order || []).concat('first');
        }
      });

      moog.define('myObject', {
        init(self, options) {
          self.order = (self.order || []).concat('second');
        }
      });

      const myObject = await moog.create('myObject', {});
      assert(myObject);
      assert(myObject.order[0] === 'first');
      assert(myObject.order[1] === 'second');
    });
  });

  describe('order of operations', function() {

    // ==================================================
    // ORDERING
    // ==================================================

    it('should call `init` methods baseClass-first', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('baseClass', {
        init(self, options) {
          self.order = (self.order || []).concat('first');
        }
      });

      moog.define('subClassOne', {
        extend: 'baseClass',
        init(self, options) {
          self.order = (self.order || []).concat('second');
        }
      });

      moog.define('subClassTwo', {
        extend: 'subClassOne',
        init(self, options) {
          self.order = (self.order || []).concat('third');
        }
      });

      const subClassTwo = await moog.create('subClassTwo', {});
      assert(subClassTwo.order[0] === 'first');
      assert(subClassTwo.order[1] === 'second');
      assert(subClassTwo.order[2] === 'third');
    });

    it('should call `beforeSuperClass` methods subClass-first', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('baseClass', {
        beforeSuperClass(self, options) {
          options.order = (options.order || []).concat('third');
        }
      });

      moog.define('subClassOne', {
        extend: 'baseClass',
        beforeSuperClass(self, options) {
          options.order = (options.order || []).concat('second');
        }
      });

      moog.define('subClassTwo', {
        extend: 'subClassOne',
        beforeSuperClass(self, options) {
          options.order = (options.order || []).concat('first');
        }
      });

      const subClassTwo = await moog.create('subClassTwo', {});
      assert(subClassTwo.options.order[0] === 'first');
      assert(subClassTwo.options.order[1] === 'second');
      assert(subClassTwo.options.order[2] === 'third');
    });

    // "sync and async playing nicely" and exception-catching
    // tests eliminated because the built-in language functionality
    // of async/await now handles those jobs and is independently tested. -Tom
  });

  describe('odds and ends', function() {

    it('should report an error on a cyclical reference (extend in a loop)', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('classOne', {
        extend: 'classTwo'
      });

      moog.define('classTwo', {
        extend: 'classOne'
      });

      let e;
      let classOne;
      try {
        classOne = await moog.create('classOne', {});
      } catch (_e) {
        e = _e;
      }
      assert(e);
      assert(!classOne);
    });

    it('should report an error asynchronously when creating a nonexistent type asynchronously', async function() {
      const moog = require('../lib/moog.js')({});
      try {
        await moog.create('nonesuch');
        assert(false);
      } catch (e) {
        assert(true);
      }
    });

    it('instanceOf should yield correct results', async function() {
      const moog = require('../lib/moog.js')({});

      moog.define('classOne', {});

      moog.define('classTwo', {
        extend: 'classOne'
      });

      moog.define('classThree', {});

      moog.define('classFour', {
        extend: 'classTwo'
      });

      const one = await moog.create('classOne');
      const two = await moog.create('classTwo');
      const three = await moog.create('classThree');
      const four = await moog.create('classFour');
      const rando = { strange: 'object' };

      assert(moog.instanceOf(one, 'classOne'));
      assert(moog.instanceOf(two, 'classOne'));
      assert(!moog.instanceOf(three, 'classOne'));
      assert(moog.instanceOf(four, 'classOne'));
      assert(!moog.instanceOf(rando, 'classOne'));
    });

    it('sanity check of await behavior', async function() {
      const moog = require('../lib/moog.js')({});
      moog.define('classOne', {
        async init(self, options) {
          await delay(100);
          self.size = 1;
        }
      });
      moog.define('classTwo', {
        extend: 'classOne',
        async init(self, options) {
          await delay(1);
          self.size = 2;
        }
      });
      assert((await moog.create('classTwo', {})).size === 2);
    });

    it('isMy behaves sensibly', function() {
      const moog = require('../lib/moog.js')({});
      assert(moog.isMy('my-foo'));
      assert(!moog.isMy('foo'));
      assert(moog.isMy('@namespace/my-foo'));
      assert(!moog.isMy('@namespace/foo'));
    });

    it('originalToMy behaves sensibly', function() {
      const moog = require('../lib/moog.js')({});
      assert(moog.originalToMy('foo') === 'my-foo');
      assert(moog.originalToMy('@namespace/foo') === '@namespace/my-foo');
      // originalToMy is not guaranteed to do anything specific with
      // names that already have my-
    });

    it('myToOriginal behaves sensibly', function() {
      const moog = require('../lib/moog.js')({});
      assert(moog.myToOriginal('my-foo') === 'foo');
      assert(moog.myToOriginal('foo') === 'foo');
      assert(moog.myToOriginal('@namespace/my-foo') === '@namespace/foo');
      assert(moog.myToOriginal('@namespace/foo') === '@namespace/foo');
    });
  });

  describe('sections should work', function() {
    it('routes should work, including extending routes', async function() {
      const moog = require('../lib/moog.js')({ sections: [ 'routes' ] });
      moog.define('baseclass', {
        routes(self, options) {
          return {
            post: {
              async insert(req) {
                return 'inserted';
              },
              async list(req) {
                return 'listed';
              }
            }
          };
        }
      }); 
      function canSee(req, res, next) {
        req.seen = true;
        return next();
      }
      moog.define('subclass', {
        extend: 'baseclass',
        routes(self, options) {
          return {
            post: {
              async remove(req) {
                return 'removed';
              },
              floss: [
                (req, res, next) => {
                  req.seen = true;
                  next();
                },
                (req) => 'flossed'
              ]
            }
          };
        },
        extendRoutes(self, options) {
          return {
            post: {
              async list(_super, req) {
                return (await _super(req)) + '-suffix';
              },
              async floss(_super, req) {
                return (await _super(req)) + '-daily';
              }
            }
          };
        }
      });
      const instance = await moog.create('subclass', {});
      assert(instance);
      assert((await instance.routes.post.insert({})) === 'inserted');
      assert((await instance.routes.post.list({})) === 'listed-suffix');
      assert((await instance.routes.post.remove({})) === 'removed');
      const req = {};
      const floss = await instance.routes.post.floss;
      // We are not here to reimplement middleware, just to verify
      // the chain is there and would work
      assert((typeof floss[0]) === 'function');
      floss[0](req, {}, function() {});
      assert(req.seen);
      assert((await floss[1](req)) === 'flossed-daily');
    });
  });

});

function delay(ms) {
  return new Promise(function(resolve, reject) {
    setTimeout(() => resolve(true), ms);
  });
}
