// TTL index emulation shared by the sqlite and postgres adapters.
//
// MongoDB implements `expireAfterSeconds` indexes with a background thread
// that wakes up every 60 seconds and removes documents whose indexed date,
// plus `expireAfterSeconds`, is in the past. It makes no promise that
// expired documents vanish instantly. We do exactly the same thing with
// setInterval, using only the adapter's own high level interface.
//
// The reaper discovers TTL indexes by walking the client's databases,
// their collections and each collection's `_indexes` metadata, so dropping
// an index, a collection or a database automatically stops expiration for
// it. If several processes run the reaper against the same database, they
// just delete the same documents; that is harmless.

const TTL_INTERVAL = 60 * 1000;

class TtlReaper {
  constructor(client, { interval = TTL_INTERVAL } = {}) {
    this._client = client;
    this.interval = interval;
    this._timer = null;
    this._running = null;
    this._stopped = false;
  }

  // Called by createIndex whenever a TTL index is created
  start() {
    if (this._timer || this._stopped) {
      return;
    }
    this._timer = setInterval(() => {
      this.run();
    }, this.interval);
  }

  // Remove all expired documents now. Resolves when done. Never rejects.
  // If a pass is already in progress, returns that pass's promise.
  run() {
    if (this._stopped) {
      return Promise.resolve();
    }
    if (!this._running) {
      this._running = this._reap().finally(() => {
        this._running = null;
      });
    }
    return this._running;
  }

  async _reap() {
    for (const db of [ ...this._client._databases.values() ]) {
      for (const collection of [ ...db._collections.values() ]) {
        for (const { keys, options } of [ ...collection._indexes.values() ]) {
          if (this._stopped) {
            return;
          }
          if (options.expireAfterSeconds == null) {
            continue;
          }
          const field = Object.keys(keys)[0];
          const cutoff = new Date(Date.now() - options.expireAfterSeconds * 1000);
          try {
            await collection.deleteMany({ [field]: { $lte: cutoff } });
          } catch (e) {
            if (!this._stopped) {
              // eslint-disable-next-line no-console
              console.error(`Error expiring documents in ${collection.collectionName}:`, e);
            }
          }
        }
      }
    }
  }

  // Stop the timer and wait for any pass in progress to finish, so the
  // caller can safely close the underlying connection afterwards
  async stop() {
    this._stopped = true;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._running) {
      await this._running;
    }
  }
}

// Validate TTL index options and return the effective index options.
// Throws if the index cannot be a TTL index, as MongoDB does.
function ttlIndexOptions(keys, options) {
  if (options.expireAfterSeconds == null) {
    return options;
  }
  const seconds = options.expireAfterSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    throw new Error('expireAfterSeconds must be a non-negative number');
  }
  const entries = Object.entries(keys);
  if ((entries.length !== 1) || (entries[0][0] === '_id') || (entries[0][1] === 'text')) {
    throw new Error('TTL indexes must be single-field, non-_id, non-text indexes');
  }
  // The reaper queries the field with a date range, so the index must be
  // a date index for that query to be efficient
  return {
    ...options,
    type: 'date'
  };
}

module.exports = {
  TtlReaper,
  ttlIndexOptions,
  TTL_INTERVAL
};
