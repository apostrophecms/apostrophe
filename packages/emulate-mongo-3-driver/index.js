const mongodb = require('mongodb-legacy');
const collection = require('./collection.js');
const findCursor = require('./find-cursor.js');
const db = require('./db.js');
const logger = require('./logger.js');
const mongoClient = require('./mongo-client.js');

const emulateClasses = new Map([
  [ 'FindCursor', findCursor ],
  [ 'Collection', collection ],
  [ 'Db', db ],
  [ 'Logger', logger ],
  [ 'MongoClient', mongoClient ]
]);

const entries = Object.entries(mongodb).concat([ [ 'Logger', null ] ]);
for (const [ mongodbExportName, mongodbExportValue ] of entries) {
  const emulateClass = emulateClasses.get(mongodbExportName);
  if (emulateClass != null) {
    const patchedClass = emulateClass(mongodbExportValue);
    Object.defineProperty(
      module.exports,
      mongodbExportName,
      {
        enumerable: true,
        get: function () {
          return patchedClass;
        }
      }
    );
  } else {
    Object.defineProperty(
      module.exports,
      mongodbExportName,
      {
        enumerable: true,
        get: function () {
          return mongodbExportValue;
        }
      }
    );
  }
}
