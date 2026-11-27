// Retention: the change log entries of MCP writes are kept for
// `changeLogExpireAfter` seconds after the write. An assistant entry goes
// when its chat is deleted, but an MCP entry has no chat, so without this
// it would never be removed.
//
// `expireChanges` is the sweep. It deletes the MCP entries older than the
// window and nothing else, through the harness's `deleteDoorChanges`, which
// keeps the query beside the `{ door, at }` index that serves it. It is a
// sweep rather than a TTL index because the SQL adapters' TTL emulation
// ignores `partialFilterExpression`, so a TTL index on `at` limited to MCP
// entries would delete the assistant's entries too. A changed window applies
// from the next sweep.
//
// It runs as a task, and in-process on an interval under a named lock, so
// one process sweeps at a time: a process that finds the lock held skips
// that round.

const LOCK = '@apostrophecms/mcp:expireChanges';
const SWEEP_EVERY = 60 * 60 * 1000;

module.exports = (self) => {
  return {
    // Sweeps on an interval, until the app is destroyed
    startSweeps() {
      self.sweepInterval = setInterval(async () => {
        try {
          await self.expireChanges();
        } catch (e) {
          self.logError('mcp-expire-changes', e.message, { stack: e.stack });
        }
      }, SWEEP_EVERY);
    },

    stopSweeps() {
      clearInterval(self.sweepInterval);
      self.sweepInterval = null;
    },

    /**
     * One sweep, under the sweep's lock: skipped when another process holds
     * it. Deletes the MCP change log entries older than
     * `changeLogExpireAfter` (none when it is `0`).
     *
     * @returns {Promise<number|null>} How many entries were deleted; `null`
     *   when another process was sweeping.
     */
    async expireChanges() {
      const expireAfter = self.options.changeLogExpireAfter;
      if (!expireAfter) {
        return 0;
      }
      try {
        await self.apos.lock.lock(LOCK, { wait: false });
      } catch (e) {
        if (e.name === 'locked') {
          return null;
        }
        throw e;
      }
      try {
        return await self.apos.aposHarness.deleteDoorChanges(
          'mcp',
          new Date(Date.now() - expireAfter * 1000)
        );
      } finally {
        await self.apos.lock.unlock(LOCK);
      }
    }
  };
};
