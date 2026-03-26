const dbConnect = require('..');

const BATCH_SIZE = 100;

// Accept either a URI string or an already-connected db object.
// When a db object is passed, the caller owns the connection lifecycle.
module.exports = async function dump(uriOrDb) {
  let db;
  let client;
  if (typeof uriOrDb === 'string') {
    client = await dbConnect(uriOrDb);
    db = client.db();
  } else {
    db = uriOrDb;
  }

  const lines = [];
  try {
    const collections = await db.listCollections().toArray();

    for (const collInfo of collections) {
      const name = collInfo.name;
      const col = db.collection(name);
      const indexes = await col.indexes();
      const customIndexes = indexes.filter(idx => idx.name !== '_id_');

      const header = { _collection: name };
      if (customIndexes.length > 0) {
        header._indexes = customIndexes;
      }
      lines.push(JSON.stringify(header));

      let lastId = null;
      while (true) {
        const query = lastId ? { _id: { $gt: lastId } } : {};
        const batch = await col.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).toArray();
        if (batch.length === 0) {
          break;
        }
        for (const doc of batch) {
          lines.push(JSON.stringify({
            _collection: name,
            _doc: serializeValue(doc)
          }));
        }
        lastId = batch[batch.length - 1]._id;
        if (batch.length < BATCH_SIZE) {
          break;
        }
      }
    }
  } finally {
    if (client) {
      await client.close();
    }
  }
  return lines.join('\n') + '\n';
};

function serializeValue(obj) {
  if (obj instanceof Date) {
    return { $date: obj.toISOString() };
  }
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'object' && obj.constructor && obj.constructor.name === 'ObjectId') {
    return obj.toHexString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeValue);
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [ k, v ] of Object.entries(obj)) {
      result[k] = serializeValue(v);
    }
    return result;
  }
  return obj;
}
