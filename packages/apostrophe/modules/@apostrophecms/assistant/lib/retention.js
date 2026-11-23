// Retention: chats are kept until their owner deletes them, or, with
// `chatExpireAfter`, until that many seconds after their last request.
// `expireChats` is the sweep: it deletes each expired chat, and finishes
// any delete that was interrupted, by the owner's own delete path; retries
// the files a delete could not remove; and removes files uploaded for a
// request that was never sent. It runs as a task, and in-process on an
// interval under a named lock, so one process sweeps at a time: a process
// that finds the lock held skips that round.
//
// A task exports or deletes one user's chats. Nothing browses them.

const fs = require('node:fs/promises');
const path = require('node:path');

const LOCK = '@apostrophecms/assistant:expireChats';
const SWEEP_EVERY = 60 * 60 * 1000;
// A file uploaded for a request is kept this long unsent: the composer may
// still send it
const UNSENT_FOR = 24 * 60 * 60 * 1000;

module.exports = (self) => {
  return {
    // Sweeps on an interval, until the app is destroyed
    startSweeps() {
      self.sweepInterval = setInterval(async () => {
        try {
          await self.expireChats();
        } catch (e) {
          self.logError('expire-chats', e.message, { stack: e.stack });
        }
      }, SWEEP_EVERY);
    },

    stopSweeps() {
      clearInterval(self.sweepInterval);
      self.sweepInterval = null;
    },

    /**
     * One sweep, under the sweep's lock: skipped when another process holds
     * it. Deletes every chat whose last request is older than
     * `chatExpireAfter` (none when it is `0`) or whose delete was
     * interrupted, then retries orphan files and removes files never sent.
     * A chat busy with a request or a revert is left for the next sweep.
     *
     * @returns {Promise<object|null>} `{ chats, files }`, what was deleted;
     *   `null` when another process was sweeping.
     */
    async expireChats() {
      try {
        await self.apos.lock.lock(LOCK, { wait: false });
      } catch (e) {
        if (e.name === 'locked') {
          return null;
        }
        throw e;
      }
      try {
        const expireAfter = self.options.chatExpireAfter;
        const before = new Date(Date.now() - expireAfter * 1000);
        const chats = await self.chats.find({
          $or: [
            { deleting: true },
            ...(expireAfter
              ? [
                { lastRequestAt: { $lt: before } },
                // A chat from before the field was written
                {
                  lastRequestAt: { $exists: false },
                  updatedAt: { $lt: before }
                }
              ]
              : [])
          ]
        }).toArray();
        let deleted = 0;
        for (const chat of chats) {
          if (await deleteQuietly(chat)) {
            deleted++;
          }
        }
        // A file still writing after a day was left by a crash
        const unsent = await self.attachments.find({
          kind: 'attachment',
          requestId: null,
          status: { $ne: 'orphan' },
          createdAt: { $lt: new Date(Date.now() - UNSENT_FOR) }
        }).toArray();
        let files = 0;
        for (const record of unsent) {
          if (await self.removeAttachmentRecord(record)) {
            files++;
          }
        }
        files += await self.removeOrphans({});
        return {
          chats: deleted,
          files
        };
      } finally {
        await self.apos.lock.unlock(LOCK);
      }

      async function deleteQuietly(chat) {
        try {
          await self.deleteChatRecords(self.getOwnerReq(chat.ownerId), chat);
          return true;
        } catch (e) {
          if (![ 'invalid', 'notfound' ].includes(e.name)) {
            self.logError('expire-chats', e.message, {
              chatId: chat._id,
              stack: e.stack
            });
          }
          return false;
        }
      }
    },

    /**
     * Removes orphan files, those a chat's delete could not remove, and
     * their records once nothing of them is left.
     *
     * @param {object} criteria Narrows them, by `ownerId`.
     * @returns {Promise<number>} How many were removed.
     */
    async removeOrphans(criteria) {
      let removed = 0;
      for (const record of await self.attachments.find({
        ...criteria,
        status: 'orphan'
      }).toArray()) {
        if (await self.removeAttachmentRecord(record)) {
          removed++;
        }
      }
      return removed;
    },

    /**
     * Deletes every chat of one user by the owner's own delete path, and
     * retries their orphan files. A chat busy with a request or a revert is
     * left, and counted.
     *
     * @param {string} ownerId
     * @returns {Promise<{ chats: number, busy: number }>}
     */
    async deleteUserChats(ownerId) {
      const req = self.getOwnerReq(ownerId);
      let chats = 0;
      let busy = 0;
      for (const chat of await self.chats.find({ ownerId }).toArray()) {
        try {
          await self.deleteChatRecords(req, chat);
          chats++;
        } catch (e) {
          if (e.name !== 'invalid') {
            throw e;
          }
          busy++;
        }
      }
      await self.removeOrphans({ ownerId });
      return {
        chats,
        busy
      };
    },

    /**
     * Exports one user's chats into `dir`, which must be empty or new:
     * `chats.json` holds each chat with its requests, reverts, change log
     * entries and attachment records (without their storage), and `files/`
     * each chat file as it was given, named by its record's id, the record's
     * `file` naming it (`null` when the file is gone).
     *
     * @param {string} ownerId
     * @param {string} dir
     * @returns {Promise<{ chats: number, files: number }>}
     */
    async exportUserChats(ownerId, dir) {
      await fs.mkdir(dir, { recursive: true });
      if ((await fs.readdir(dir)).length) {
        throw self.apos.error('invalid', `The directory ${dir} is not empty.`);
      }
      await fs.mkdir(path.join(dir, 'files'));
      const chats = [];
      let files = 0;
      const owned = await self.chats.find({ ownerId }).sort({ createdAt: 1 }).toArray();
      for (const chat of owned) {
        const byChat = {
          chatId: chat._id,
          ownerId
        };
        const attachments = [];
        for (const { storage, ...record } of await self.attachments
          .find(byChat)
          .sort({ createdAt: 1 })
          .toArray()) {
          const file = `files/${record._id}.${record.extension}`;
          let copied = false;
          try {
            await fs.writeFile(path.join(dir, file), await self.readChatFile(storage));
            copied = true;
            files++;
          } catch (e) {
            if (e.name !== 'notfound') {
              throw e;
            }
          }
          attachments.push({
            ...record,
            file: copied ? file : null
          });
        }
        chats.push({
          ...chat,
          requests: await self.requests.find(byChat).sort({ sequence: 1 }).toArray(),
          reverts: await self.reverts.find(byChat).sort({ createdAt: 1 }).toArray(),
          changes: await self.apos.aposHarness.changes
            .find({
              chat: chat._id,
              userId: ownerId
            })
            .toArray(),
          attachments
        });
      }
      await fs.writeFile(path.join(dir, 'chats.json'), JSON.stringify({
        exportedAt: new Date(),
        ownerId,
        chats
      }, null, 2));
      return {
        chats: chats.length,
        files
      };
    },

    // A request of a chat's owner, for work no request of theirs started:
    // what is deleted and published is theirs
    getOwnerReq(ownerId) {
      return self.apos.task.getReq({ user: { _id: ownerId } });
    }
  };
};
