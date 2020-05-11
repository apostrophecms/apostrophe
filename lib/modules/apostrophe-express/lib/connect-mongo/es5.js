'use strict';
/* eslint-disable */

// This is a copy of connect-mongo 1.3.2, the ES5 build,
// originally by Casey Banner and Jerome Desboeufs. The
// only difference is that it requires emulate-mongo-2-driver
// rather than requiring mongodb directly. This resolves
// the security concerns with using the old mongo 2 driver.

let _createClass = (function () { function defineProperties(target, props) { for (let i = 0; i < props.length; i++) { let descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }());

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError('this hasn\'t been initialised - super() hasn\'t been called'); } return call && (typeof call === 'object' || typeof call === 'function') ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

let Promise = require('bluebird');
let MongoClient = require('emulate-mongo-2-driver');

function defaultSerializeFunction(session) {
    // Copy each property of the session to a new object
    let obj = {};
    let prop = void 0;

    for (prop in session) {
        if (prop === 'cookie') {
            // Convert the cookie instance to an object, if possible
            // This gets rid of the duplicate object under session.cookie.data property
            obj.cookie = session.cookie.toJSON ? session.cookie.toJSON() : session.cookie;
        } else {
            obj[prop] = session[prop];
        }
    }

    return obj;
}

function computeTransformFunctions(options, defaultStringify) {
    if (options.serialize || options.unserialize) {
        return {
            serialize: options.serialize || defaultSerializeFunction,
            unserialize: options.unserialize || function (x) {
                return x;
            }
        };
    }

    if (options.stringify === false || defaultStringify === false) {
        return {
            serialize: defaultSerializeFunction,
            unserialize: function (x) {
                return x;
            }
        };
    }

    if (options.stringify === true || defaultStringify === true) {
        return {
            serialize: JSON.stringify,
            unserialize: JSON.parse
        };
    }
}

module.exports = function connectMongo(connect) {
    let Store = connect.Store || connect.session.Store;
    let MemoryStore = connect.MemoryStore || connect.session.MemoryStore;

    let MongoStore = (function (_Store) {
        _inherits(MongoStore, _Store);

        function MongoStore(options) {
            _classCallCheck(this, MongoStore);

            options = options || {};

            /* Fallback */
            if (options.fallbackMemory && MemoryStore) {
                let _ret;

                return _ret = new MemoryStore(), _possibleConstructorReturn(_this, _ret);
            }

            /* Options */
            var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(MongoStore).call(this, options));

            _this.ttl = options.ttl || 1209600; // 14 days
            _this.collectionName = options.collection || 'sessions';
            _this.autoRemove = options.autoRemove || 'native';
            _this.autoRemoveInterval = options.autoRemoveInterval || 10;
            _this.transformFunctions = computeTransformFunctions(options, true);

            _this.options = options;

            _this.changeState('init');

            let newConnectionCallback = function (err, db) {
                if (err) {
                    _this.connectionFailed(err);
                } else {
                    _this.handleNewConnectionAsync(db);
                }
            };

            if (options.url) {
                // New native connection using url + mongoOptions
                MongoClient.connect(options.url, options.mongoOptions || {}, newConnectionCallback);
            } else if (options.mongooseConnection) {
                // Re-use existing or upcoming mongoose connection
                if (options.mongooseConnection.readyState === 1) {
                    _this.handleNewConnectionAsync(options.mongooseConnection.db);
                } else {
                    options.mongooseConnection.once('open', function () {
                        return _this.handleNewConnectionAsync(options.mongooseConnection.db);
                    });
                }
            } else if (options.db && options.db.listCollections) {
                // Re-use existing or upcoming native connection
                if (options.db.openCalled || options.db.openCalled === undefined) {
                    // openCalled is undefined in mongodb@2.x
                    _this.handleNewConnectionAsync(options.db);
                } else {
                    options.db.open(newConnectionCallback);
                }
            } else if (options.dbPromise) {
                options.dbPromise.then(function (db) {
                    return _this.handleNewConnectionAsync(db);
                }).catch(function (err) {
                    return _this.connectionFailed(err);
                });
            } else {
                throw new Error('Connection strategy not found');
            }

            _this.changeState('connecting');

            return _this;
        }

        _createClass(MongoStore, [{
            key: 'connectionFailed',
            value: function connectionFailed(err) {
                this.changeState('disconnected');
                throw err;
            }
        }, {
            key: 'handleNewConnectionAsync',
            value: function handleNewConnectionAsync(db) {
                let _this2 = this;

                this.db = db;
                return this.setCollection(db.collection(this.collectionName)).setAutoRemoveAsync().then(function () {
                    return _this2.changeState('connected');
                });
            }
        }, {
            key: 'setAutoRemoveAsync',
            value: function setAutoRemoveAsync() {
                let _this3 = this;

                let removeQuery = { expires: { $lt: new Date() } };
                switch (this.autoRemove) {
                case 'native':
                    return this.collection.ensureIndexAsync({ expires: 1 }, { expireAfterSeconds: 0 });
                case 'interval':
                    this.timer = setInterval(function () {
                        return _this3.collection.remove(removeQuery, { w: 0 });
                    }, this.autoRemoveInterval * 1000 * 60);
                    this.timer.unref();
                    return Promise.resolve();
                default:
                    return Promise.resolve();
                }
            }
        }, {
            key: 'changeState',
            value: function changeState(newState) {
                if (newState !== this.state) {
                    this.state = newState;
                    this.emit(newState);
                }
            }
        }, {
            key: 'setCollection',
            value: function setCollection(collection) {
                if (this.timer) {
                    clearInterval(this.timer);
                }
                this.collectionReadyPromise = undefined;
                this.collection = collection;

                // Promisify used collection methods
                ['count', 'findOne', 'remove', 'drop', 'ensureIndex'].forEach(function (method) {
                    collection[method + 'Async'] = Promise.promisify(collection[method], { context: collection });
                });
                collection.updateAsync = Promise.promisify(collection.update, { context: collection, multiArgs: true });

                return this;
            }
        }, {
            key: 'collectionReady',
            value: function collectionReady() {
                let _this4 = this;

                let promise = this.collectionReadyPromise;
                if (!promise) {
                    promise = new Promise(function (resolve, reject) {
                        switch (_this4.state) {
                        case 'connected':
                            resolve(_this4.collection);
                            break;
                        case 'connecting':
                            _this4.once('connected', function () {
                                return resolve(_this4.collection);
                            });
                            break;
                        case 'disconnected':
                            reject(new Error('Not connected'));
                            break;
                        }
                    });
                    this.collectionReadyPromise = promise;
                }
                return promise;
            }
        }, {
            key: 'computeStorageId',
            value: function computeStorageId(sessionId) {
                if (this.options.transformId && typeof this.options.transformId === 'function') {
                    return this.options.transformId(sessionId);
                } else {
                    return sessionId;
                }
            }

            /* Public API */

        }, {
            key: 'get',
            value: function get(sid, callback) {
                let _this5 = this;

                return this.collectionReady().then(function (collection) {
                    return collection.findOneAsync({
                        _id: _this5.computeStorageId(sid),
                        $or: [{ expires: { $exists: false } }, { expires: { $gt: new Date() } }]
                    });
                }).then(function (session) {
                    if (session) {
                        let s = _this5.transformFunctions.unserialize(session.session);
                        if (_this5.options.touchAfter > 0 && session.lastModified) {
                            s.lastModified = session.lastModified;
                        }
                        _this5.emit('touch', sid);
                        return s;
                    }
                }).asCallback(callback);
            }
        }, {
            key: 'set',
            value: function set(sid, session, callback) {
                let _this6 = this;

                // removing the lastModified prop from the session object before update
                if (this.options.touchAfter > 0 && session && session.lastModified) {
                    delete session.lastModified;
                }

                let s = void 0;

                try {
                    s = { _id: this.computeStorageId(sid), session: this.transformFunctions.serialize(session) };
                } catch (err) {
                    return callback(err);
                }

                if (session && session.cookie && session.cookie.expires) {
                    s.expires = new Date(session.cookie.expires);
                } else {
                    // If there's no expiration date specified, it is
                    // browser-session cookie or there is no cookie at all,
                    // as per the connect docs.
                    //
                    // So we set the expiration to two-weeks from now
                    // - as is common practice in the industry (e.g Django) -
                    // or the default specified in the options.
                    s.expires = new Date(Date.now() + this.ttl * 1000);
                }

                if (this.options.touchAfter > 0) {
                    s.lastModified = new Date();
                }

                return this.collectionReady().then(function (collection) {
                    return collection.updateAsync({ _id: _this6.computeStorageId(sid) }, s, { upsert: true });
                }).then(function (responseArray) {
                    let rawResponse = responseArray.length === 2 ? responseArray[1] : responseArray[0].result;
                    if (rawResponse.upserted) {
                        _this6.emit('create', sid);
                    } else {
                        _this6.emit('update', sid);
                    }
                    _this6.emit('set', sid);
                }).asCallback(callback);
            }
        }, {
            key: 'touch',
            value: function touch(sid, session, callback) {
                let _this7 = this;

                let updateFields = {};
                let touchAfter = this.options.touchAfter * 1000;
                let lastModified = session.lastModified ? session.lastModified.getTime() : 0;
                let currentDate = new Date();

                // if the given options has a touchAfter property, check if the
                // current timestamp - lastModified timestamp is bigger than
                // the specified, if it's not, don't touch the session
                if (touchAfter > 0 && lastModified > 0) {

                    let timeElapsed = currentDate.getTime() - session.lastModified;

                    if (timeElapsed < touchAfter) {
                        return callback();
                    } else {
                        updateFields.lastModified = currentDate;
                    }
                }

                if (session && session.cookie && session.cookie.expires) {
                    updateFields.expires = new Date(session.cookie.expires);
                } else {
                    updateFields.expires = new Date(Date.now() + this.ttl * 1000);
                }

                return this.collectionReady().then(function (collection) {
                    return collection.updateAsync({ _id: _this7.computeStorageId(sid) }, { $set: updateFields });
                }).then(function (result) {
                    if (result.nModified === 0) {
                        throw new Error('Unable to find the session to touch');
                    } else {
                        _this7.emit('touch', sid);
                    }
                }).asCallback(callback);
            }
        }, {
            key: 'destroy',
            value: function destroy(sid, callback) {
                let _this8 = this;

                return this.collectionReady().then(function (collection) {
                    return collection.removeAsync({ _id: _this8.computeStorageId(sid) });
                }).then(function () {
                    return _this8.emit('destroy', sid);
                }).asCallback(callback);
            }
        }, {
            key: 'length',
            value: function length(callback) {
                return this.collectionReady().then(function (collection) {
                    return collection.countAsync({});
                }).asCallback(callback);
            }
        }, {
            key: 'clear',
            value: function clear(callback) {
                return this.collectionReady().then(function (collection) {
                    return collection.dropAsync();
                }).asCallback(callback);
            }
        }, {
            key: 'close',
            value: function close() {
                if (this.db) {
                    this.db.close();
                }
            }
        }]);

        return MongoStore;
    }(Store));

    return MongoStore;
};
