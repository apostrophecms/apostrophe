// Revert in a chat: a request and every later one taken back across every
// document they changed (the harness's `revertRequests`), as a job the
// panel follows. The chat's `openRevert` slot is claimed as a request's
// `openRequest` is: while a revert runs the chat takes no send, no other
// revert and no delete, and a revert waits for an open request to end.
//
// Each revert has a record in `aposChatReverts`: the requests it reverts,
// its status (`running`, `done`, `failed`), how far it got (`progress`)
// and what became of every document. Once it is done its requests carry
// its id (`revertId`) and leave the thread; a failed one leaves them, and
// what it put back stays.

const _ = require('lodash');

// Raised when a record's shape changes; a migration upgrades older records
const SCHEMA_VERSION = 1;
const DOOR = 'assistant';

module.exports = (self) => {
  return {
    /**
     * What reverting a request and every later one would do, writing
     * nothing. Refused while the chat has an open request or a revert runs.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.requestId The earliest request to revert.
     * @param {string} input.tabId The browser tab asking.
     * @returns {Promise<{ requestIds: string[], documents: object[] }>}
     *   `documents` as `revertRequests` describes them.
     */
    async checkRevert(req, chatId, { requestId, tabId } = {}) {
      const clean = self.launderTabId(tabId);
      const chat = await self.reconcileChat(req, await self.getChat(req, chatId));
      if (chat.openRequest || chat.openRevert || chat.deleting) {
        throw self.getRefusal(chat, {});
      }
      const requestIds = await getRequestIds(req, chat, requestId);
      const documents = await self.apos.harness.revertRequests(
        getDoorReq(req, chat, clean, self.apos.util.generateId()),
        requestIds,
        { dryRun: true }
      );
      return {
        requestIds,
        documents
      };
    },

    /**
     * Reverts a request and every later one of its chat not reverted yet,
     * as a job. Refused while the chat has an open request or a revert
     * runs (`requestOpen`, `revertRunning`).
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.requestId The earliest request to revert.
     * @param {string} input.tabId The browser tab reverting, whose open
     *   page hears of each save.
     * @param {string} [input.cause] `planCancel` when the editor cancelled
     *   the request's plan.
     * @returns {Promise<object>} The revert record.
     */
    async revert(req, chatId, {
      requestId, tabId, cause
    } = {}) {
      const clean = self.launderTabId(tabId);
      const revertId = self.apos.util.generateId();
      const chat = await claim(req, self.apos.launder.id(chatId), {
        _id: revertId,
        tabId: clean
      });
      try {
        const requestIds = await getRequestIds(req, chat, requestId);
        const now = new Date();
        const record = {
          _id: revertId,
          schemaVersion: SCHEMA_VERSION,
          chatId: chat._id,
          ownerId: chat.ownerId,
          tabId: clean,
          requestIds,
          ...((cause === 'planCancel') && { cause }),
          status: 'running',
          progress: null,
          documents: [],
          createdAt: now,
          updatedAt: now
        };
        await self.reverts.insertOne(record);
        await startRevert(req, chat, record, { docIds: null });
      } catch (e) {
        await endRevert(req, chat, { _id: revertId }, { error: e });
        throw e;
      }
      return self.getRevert(req, revertId);
    },

    /**
     * Runs a revert again: a failed one whole, a done one for the documents
     * it held back because someone had them locked. Refused as `revert`
     * is, and `invalid` when there is nothing to retry, or when a request
     * was sent after a failed revert: reverting again takes it too.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.revertId
     * @param {string} input.tabId
     * @returns {Promise<object>} The revert record.
     */
    async retryRevert(req, chatId, { revertId, tabId } = {}) {
      const clean = self.launderTabId(tabId);
      const found = await self.getRevert(req, self.apos.launder.id(revertId));
      const locked = found.documents
        .filter(document => document.outcome === 'locked')
        .map(document => document.docId);
      if ((found.chatId !== self.apos.launder.id(chatId)) ||
        ((found.status !== 'failed') && !((found.status === 'done') && locked.length))) {
        throw self.apos.error('invalid', 'the revert has nothing to retry');
      }
      const chat = await claim(req, found.chatId, {
        _id: found._id,
        tabId: clean
      });
      try {
        const first = await self.getRequest(req, found.requestIds[0]);
        if ((found.status === 'failed') && !first.revertId &&
          !_.isEqual(await getRequestIds(req, chat, first._id), found.requestIds)) {
          throw self.apos.error('invalid', 'a request was sent after the revert failed');
        }
        const { matchedCount } = await self.reverts.updateOne({
          _id: found._id,
          ownerId: found.ownerId,
          status: found.status
        }, {
          $set: {
            status: 'running',
            tabId: clean,
            progress: null,
            dismissed: false,
            updatedAt: new Date()
          },
          $unset: {
            error: 1,
            jobId: 1
          }
        });
        if (!matchedCount) {
          throw self.apos.error('invalid', 'the revert has nothing to retry');
        }
        await startRevert(req, chat, {
          ...found,
          tabId: clean
        }, { docIds: (found.status === 'done') ? locked : null });
      } catch (e) {
        await endRevert(req, chat, found, { error: e });
        throw e;
      }
      return self.getRevert(req, found._id);
    },

    async getRevert(req, _id) {
      const revert = await self.reverts.findOne({
        _id,
        ownerId: self.getOwnerId(req)
      });
      if (!revert) {
        throw self.apos.error('notfound');
      }
      return revert;
    },

    // A chat's reverts in the order they were made
    async getChatReverts(req, chatId) {
      const chat = await self.getChat(req, chatId);
      return self.reverts
        .find({
          chatId: chat._id,
          ownerId: chat.ownerId
        })
        .sort({ createdAt: 1 })
        .toArray();
    },

    /**
     * Sets aside what a revert reports it did not revert: the panel stops
     * showing it, on reload too.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {object} input
     * @param {string} input.revertId
     */
    async dismissRevert(req, chatId, { revertId } = {}) {
      const found = await self.getRevert(req, self.apos.launder.id(revertId));
      if (found.chatId !== self.apos.launder.id(chatId)) {
        throw self.apos.error('notfound');
      }
      await self.reverts.updateOne({
        _id: found._id,
        ownerId: found.ownerId
      }, {
        $set: {
          dismissed: true,
          updatedAt: new Date()
        }
      });
      await self.publish(req, found.chatId, 'revert', { revertId: found._id });
    },

    /**
     * Frees a chat whose revert was left behind by a process that died: a
     * revert that is missing or already ended frees the chat; one whose job
     * is abandoned, gone or ended without storing its end, or that never
     * got one, ends failed. See `reconcileChat`.
     *
     * @param {object} req
     * @param {object} chat
     */
    async reconcileRevert(req, chat) {
      const open = chat.openRevert;
      const jobs = self.apos.modules['@apostrophecms/job'];
      const grace = jobs.options.abandonAfter;
      const left = date => (Date.now() - new Date(date).getTime()) > grace;
      const record = await self.reverts.findOne({
        _id: open._id,
        ownerId: chat.ownerId
      });
      if (record?.status !== 'running') {
        if (left(chat.updatedAt)) {
          await freeChat(req, chat, open._id);
        }
        return;
      }
      const job = record.jobId && await jobs.db.findOne({ _id: record.jobId });
      const dead = job
        ? (jobs.isAbandoned(job) || job.ended)
        : left(record.updatedAt);
      if (dead) {
        await endRevert(req, chat, record, {
          error: {
            name: 'interrupted',
            message: 'the revert was interrupted before it finished'
          }
        });
      }
    }
  };

  // Claims the chat's revert slot. A refusal is checked against a request
  // or revert left behind by a process that died, once
  async function claim(req, chatId, slot, reconciled = false) {
    const { matchedCount } = await self.chats.updateOne({
      _id: chatId,
      ownerId: self.getOwnerId(req),
      openRequest: null,
      openRevert: null,
      deleting: { $ne: true }
    }, {
      $set: {
        openRevert: slot,
        updatedAt: new Date()
      }
    });
    const chat = await self.getChat(req, chatId);
    if (matchedCount) {
      return chat;
    }
    if (!reconciled) {
      const now = await self.reconcileChat(req, chat);
      if (!now.openRequest && !now.openRevert) {
        return claim(req, chatId, slot, true);
      }
    }
    throw self.getRefusal(chat, {});
  }

  // The ids of a request and every later one of the chat not reverted yet,
  // in order. `notfound` for a request of another chat, `invalid` for one
  // reverted already
  async function getRequestIds(req, chat, requestId) {
    const request = await self.getRequest(req, self.apos.launder.id(requestId));
    if (request.chatId !== chat._id) {
      throw self.apos.error('notfound');
    }
    if (request.revertId) {
      throw self.apos.error('invalid', 'the request is reverted already');
    }
    const requests = await self.requests
      .find({
        chatId: chat._id,
        ownerId: chat.ownerId,
        sequence: { $gte: request.sequence },
        revertId: { $exists: false }
      })
      .project({ _id: 1 })
      .sort({ sequence: 1 })
      .toArray();
    return requests.map(({ _id }) => _id);
  }

  // The `req` a revert writes with: the user's, through the assistant's
  // door, as the user's own change
  function getDoorReq(req, chat, tabId, revertId) {
    return self.apos.harness.withDoor(req, {
      door: DOOR,
      lockId: chat._id,
      family: tabId,
      chat: chat._id,
      requestId: revertId,
      revert: true
    });
  }

  // Runs the revert of `record` on a new job, the documents `docIds` only
  // when given. Once the job starts, the job alone stores the revert's
  // job id and its end; a throw from here means it never started
  async function startRevert(req, chat, record, { docIds }) {
    const started = await self.apos.modules['@apostrophecms/job'].run(
      req,
      async (workReq, reporting, info) => {
        const doorReq = getDoorReq(workReq, chat, record.tabId, record._id);
        let documents;
        try {
          await self.reverts.updateOne({
            _id: record._id,
            ownerId: record.ownerId
          }, {
            $set: { jobId: info.jobId }
          });
          documents = await self.apos.harness.revertRequests(doorReq, record.requestIds, {
            docIds,
            onProgress: async ({ done, total }) => {
              if (done === 1) {
                await reporting.setTotal(total);
              }
              await reporting.success();
              await self.reverts.updateOne({
                _id: record._id,
                ownerId: record.ownerId
              }, {
                $set: {
                  progress: {
                    done,
                    total
                  }
                }
              });
              await self.publish(req, chat._id, 'revertProgress', {
                revertId: record._id,
                done,
                total
              });
            }
          });
        } catch (error) {
          await endRevert(req, chat, record, { error });
          throw error;
        } finally {
          await self.apos.harness.endRequest(doorReq);
        }
        await endRevert(req, chat, record, {
          documents,
          retried: Boolean(docIds)
        });
      },
      {
        notifications: false,
        heartbeat: true,
        userId: chat.ownerId
      }
    );
    if (!started?.jobId) {
      throw self.apos.error('error', 'the job record could not be created');
    }
  }

  // Stores the end of a revert: what became of each document, a retry's
  // merged into the earlier run's, and the requests marked reverted; or
  // the error, the requests left as they are. Then frees the chat
  async function endRevert(req, chat, record, {
    documents, retried, error
  }) {
    const now = new Date();
    const stored = await self.reverts.findOne({
      _id: record._id,
      ownerId: chat.ownerId
    });
    if (stored?.status === 'running') {
      const set = {
        status: error ? 'failed' : 'done',
        updatedAt: now,
        endedAt: now
      };
      if (error) {
        set.error = {
          name: error.name,
          message: error.message
        };
        self.logError(req, 'revert-failed', error.message, {
          chatId: chat._id,
          revertId: record._id,
          stack: error.stack
        });
      } else {
        const fresh = new Map();
        for (const document of documents) {
          fresh.set(document.docId, {
            ...document,
            view: await getView(document)
          });
        }
        set.documents = retried
          ? stored.documents.map(document => fresh.get(document.docId) || document)
          : [ ...fresh.values() ];
      }
      await self.reverts.updateOne({
        _id: stored._id,
        ownerId: stored.ownerId,
        status: 'running'
      }, { $set: set });
      if (!error) {
        await self.requests.updateMany({
          _id: { $in: stored.requestIds },
          ownerId: stored.ownerId,
          revertId: { $exists: false }
        }, {
          $set: {
            revertId: stored._id,
            revertedAt: now
          }
        });
      }
    }
    await freeChat(req, chat, record._id);

    // Where the editor looks at a document the revert did not put back:
    // `seeChanges` for one changed since, when its page shows them;
    // `versions`, its Document Versions, for one locked, archived or not
    // restorable, where See Changes can't be entered; `null` for one gone
    // or without versions
    async function getView({
      docId, type, locale, outcome, reason
    }) {
      if (![ 'kept', 'unrestorable', 'locked' ].includes(outcome)) {
        return null;
      }
      const manager = self.apos.doc.getManager(type);
      const { docVersions } = self.apos;
      if (!manager || !docVersions?.hasVersions(manager.options)) {
        return null;
      }
      const doc = await manager
        .find(req.clone({
          mode: 'draft',
          ...(locale && { locale })
        }), { _id: docId })
        .project({
          _url: 1,
          archived: 1
        })
        .archived(null)
        .toObject();
      if (!doc) {
        return null;
      }
      const changed = (outcome === 'kept') && (reason !== 'archived') && !doc.archived;
      return (changed && doc._url && docVersions.hasDraftVersions(manager.options))
        ? 'seeChanges'
        : 'versions';
    }
  }

  async function freeChat(req, chat, revertId) {
    await self.chats.updateOne({
      _id: chat._id,
      'openRevert._id': revertId
    }, {
      $set: {
        openRevert: null,
        updatedAt: new Date()
      }
    });
    await self.publish(req, chat._id, 'revert', { revertId });
  }
};
