const readline = require('readline');
const dbConnect = require('..');

const BATCH_SIZE = 100;

// Restore a database from NDJSON. `source` is streamed one line at a
// time to avoid holding the entire dump in memory. Accepted `source`
// shapes:
//
//   - an AsyncIterable<string> of NDJSON records (as produced by dump()),
//   - an Iterable<string>,
//   - a Node Readable stream (e.g. process.stdin, fs.createReadStream()) —
//     lines are extracted with the built-in readline module,
//   - a single string containing the entire dump — retained for
//     convenience in small cases; for large dumps prefer a stream.
//
// Accept either a URI string or an already-connected db object. When a
// db object is passed, the caller owns the connection lifecycle.
module.exports = async function restore(uriOrDb, source) {
  let db;
  let client;
  if (typeof uriOrDb === 'string') {
    client = await dbConnect(uriOrDb);
    db = client.db();
  } else {
    db = uriOrDb;
  }

  try {
    let col = null;
    let batch = [];

    for await (const rawLine of linesOf(source)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      const entry = JSON.parse(line);

      if (entry._doc) {
        batch.push(deserializeValue(entry._doc));
        if (batch.length >= BATCH_SIZE) {
          await col.insertMany(batch);
          batch = [];
        }
      } else if (entry._collection) {
        if (batch.length > 0) {
          await col.insertMany(batch);
          batch = [];
        }

        col = db.collection(entry._collection);

        // Clear existing data. Use deleteMany instead of drop to
        // preserve the table structure — important when the database
        // is being used by a running application (e.g. Cypress tests)
        try {
          await col.deleteMany({});
        } catch (e) {
          // Collection may not exist yet, ignore
        }

        if (entry._indexes && entry._indexes.length > 0) {
          for (const idx of entry._indexes) {
            const options = {};
            if (idx.name) {
              options.name = idx.name;
            }
            if (idx.unique) {
              options.unique = true;
            }
            if (idx.sparse) {
              options.sparse = true;
            }
            if (idx.type) {
              options.type = idx.type;
            }
            // Text index support: preserve weights and language options
            if (idx.weights) {
              options.weights = idx.weights;
            }
            if (idx.default_language) {
              options.default_language = idx.default_language;
            }
            if (idx.language_override) {
              options.language_override = idx.language_override;
            }
            if (idx.textIndexVersion) {
              options.textIndexVersion = idx.textIndexVersion;
            }
            // TTL index support
            if (idx.expireAfterSeconds != null) {
              options.expireAfterSeconds = idx.expireAfterSeconds;
            }
            try {
              await col.createIndex(idx.key, options);
            } catch (e) {
              // Index creation may fail across backends (e.g. MongoDB-style
              // names containing dots are invalid in PostgreSQL). This is
              // non-fatal because the application typically recreates its
              // indexes on boot.
            }
          }
        }
      }
    }

    if (batch.length > 0 && col) {
      await col.insertMany(batch);
    }

    // For SQLite: force a WAL checkpoint to ensure all changes are
    // visible to other connections immediately
    if (db._sqlite) {
      const result = db._sqlite.pragma('wal_checkpoint(PASSIVE)');
      if (result && result[0]) {
        // Log checkpoint result for debugging
        const { log, checkpointed } = result[0];
        if (log !== checkpointed) {
          // Some pages weren't checkpointed, try harder
          db._sqlite.pragma('wal_checkpoint(TRUNCATE)');
        }
      }
    }
  } finally {
    if (client) {
      await client.close();
    }
  }
};

// Normalize `source` into an async iterable of NDJSON lines.
function linesOf(source) {
  if (source == null) {
    throw new Error('restore: source is required');
  }
  if (typeof source === 'string') {
    return source.split('\n');
  }
  if (typeof source[Symbol.asyncIterator] === 'function' ||
      typeof source[Symbol.iterator] === 'function') {
    // Already an (async) iterable of lines.
    return source;
  }
  // Treat anything else as a Node Readable stream; readline splits on
  // newlines and tolerates both \n and \r\n line endings.
  if (typeof source.on === 'function' || typeof source.pipe === 'function') {
    return readline.createInterface({
      input: source,
      crlfDelay: Infinity
    });
  }
  throw new Error('restore: source must be a string, iterable of lines, or a Readable stream');
}

function deserializeValue(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj.$date) {
    return new Date(obj.$date);
  }
  if (Array.isArray(obj)) {
    return obj.map(deserializeValue);
  }
  const result = {};
  for (const [ k, v ] of Object.entries(obj)) {
    result[k] = deserializeValue(v);
  }
  return result;
}
