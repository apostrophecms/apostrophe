// Continue in a new chat: a new chat that carries over what a chat knew up
// to one of its finished requests, as a summary stored on the new chat
// only. The source chat's replay and checkpoints never change, and each
// chat reverts only its own requests. The new chat reads the carried
// summary in its instructions until its own first summary folds it in.
//
// The carry starts from the newest summary of the source chat that ends at
// or before the request, and folds the requests after it, up to the
// request, into it with a model call on a job of its own. A summary that
// ends at the request is reused as it is. Until the carry is done the new
// chat takes no message: its `carry` is `{ status: 'running' }`, then
// `{ status: 'failed' }`, or `null` once done. A carry whose process died
// is failed by `reconcileCarry`, as a run is.

module.exports = (self) => {
  return {
    /**
     * Starts a new chat continuing a chat from one of its requests, under
     * the id the browser named it by. Refused as Revert is while the chat
     * has a request open or a revert running: a new chat started then
     * wouldn't know the work in progress. An id already stored answers
     * with that chat, its carry started again when it failed.
     *
     * @param {object} req
     * @param {string} sourceId The chat continued.
     * @param {object} input
     * @param {string} input.requestId The finished request it continues
     *   from.
     * @param {string} input.chatId The new chat's id.
     * @returns {Promise<object>} The new chat record.
     */
    async continueInNewChat(req, sourceId, { requestId, chatId } = {}) {
      const _id = self.apos.launder.id(chatId);
      if (!_id) {
        throw self.apos.error('invalid', 'the chat id is not valid');
      }
      const source = await self.reconcileChat(req, await self.getChat(req, sourceId));
      const request = await self.getChatRequest(req, source._id, requestId);
      const stored = await self.chats.findOne({
        _id,
        ownerId: self.getOwnerId(req)
      });
      if (stored && ((stored.continuedFrom?.chatId !== source._id) ||
        (stored.continuedFrom.requestId !== request._id))) {
        throw self.apos.error('notfound');
      }
      if (stored) {
        const now = await self.reconcileChat(req, stored);
        if (now.carry?.status !== 'failed') {
          return now;
        }
      }
      if (source.openRequest || source.openRevert) {
        throw self.getRefusal(source, {});
      }
      if (request.revertId || [ 'running', 'stopping', 'waiting' ].includes(request.status)) {
        throw self.apos.error('invalid', 'only a finished request that is not reverted can be continued from');
      }
      let chat;
      if (stored) {
        const { matchedCount } = await self.chats.updateOne({
          _id,
          ownerId: stored.ownerId,
          'carry.status': 'failed'
        }, {
          $set: {
            carry: {
              status: 'running',
              updatedAt: new Date()
            }
          }
        });
        if (!matchedCount) {
          return self.getChat(req, _id);
        }
        chat = await self.getChat(req, _id);
        await self.publish(req, _id, 'carry', { status: 'running' });
      } else {
        chat = await self.createChat(req, {
          _id,
          continuedFrom: {
            chatId: source._id,
            requestId: request._id,
            title: source.title
          }
        });
      }
      await startCarry(req, source, request, chat);
      return self.getChat(req, _id);
    },

    /**
     * Dismisses the suggestion to continue in a new chat (`renderChat`) in
     * every browser tab: it shows again only after more summaries.
     *
     * @param {object} req
     * @param {string} chatId
     * @param {string} suggestionId The suggestion's `_id`.
     */
    async dismissSuggestion(req, chatId, suggestionId) {
      const chat = await self.getChat(req, chatId);
      const _id = self.apos.launder.id(suggestionId);
      if (!_id) {
        throw self.apos.error('invalid', 'the suggestion id is not valid');
      }
      await self.chats.updateOne({
        _id: chat._id,
        ownerId: chat.ownerId
      }, {
        $set: { dismissedSuggestion: _id }
      });
      await self.publish(req, chat._id, 'suggestion', { dismissed: _id });
    },

    /**
     * Fails a chat's carry left behind by a process that died: its job
     * abandoned, gone or ended without storing its end, or never started.
     * See `reconcileChat`.
     *
     * @param {object} req
     * @param {object} chat
     */
    async reconcileCarry(req, chat) {
      const jobs = self.apos.modules['@apostrophecms/job'];
      const { carry } = chat;
      const job = carry.jobId && await jobs.db.findOne({ _id: carry.jobId });
      const dead = job
        ? (jobs.isAbandoned(job) || job.ended)
        : (Date.now() - new Date(carry.updatedAt).getTime()) > jobs.options.abandonAfter;
      if (dead) {
        await endCarry(req, chat, { error: true });
      }
    }
  };

  // The summary the carry starts from: the source chat's newest that ends
  // at or before the request, else the one the source chat carried over
  function getBase(source, request) {
    const checkpoint = (source.checkpoints || []).findLast(each => each.summary &&
      (each.summary.covers <= request.sequence));
    return checkpoint
      ? {
        summary: checkpoint.summary,
        covers: checkpoint.summary.covers
      }
      : {
        summary: source.carried?.summary || null,
        covers: -1
      };
  }

  // Ends at once when there is nothing to fold; otherwise the model call
  // runs on a job, which alone stores the carry's end once it starts
  async function startCarry(req, source, request, chat) {
    const base = getBase(source, request);
    const latest = self.getCheckpoint(source);
    // As the source chat reads them now, its cleared reads left cleared
    const requests = self.applyCheckpoint(latest && {
      calls: latest.calls,
      media: latest.media
    }, await self.getReplayedRequests(source, {
      sequence: request.sequence + 1
    }, base.covers));
    if (!requests.length) {
      await endCarry(req, chat, { summary: base.summary });
      return;
    }
    let started;
    try {
      started = await self.apos.modules['@apostrophecms/job'].run(
        req,
        async (workReq, reporting, info) => {
          let written;
          try {
            await self.chats.updateOne({
              _id: chat._id,
              ownerId: chat.ownerId,
              'carry.status': 'running'
            }, {
              $set: {
                'carry.jobId': info.jobId,
                'carry.updatedAt': new Date()
              }
            });
            written = await self.writeSummary(workReq, source, {
              requests,
              previous: base.summary
            });
          } catch (error) {
            await endCarry(req, chat, { error: true });
            throw error;
          }
          await endCarry(req, chat, written
            ? { summary: written.summary }
            : { error: true });
        },
        {
          notifications: false,
          heartbeat: true,
          userId: chat.ownerId
        }
      );
    } catch (error) {
      await endCarry(req, chat, { error: true });
      throw error;
    }
    if (!started?.jobId) {
      await endCarry(req, chat, { error: true });
      throw self.apos.error('error', 'the job record could not be created');
    }
  }

  // Stores the carried summary, without the source chat's `covers`, or the
  // failure; only a carry still running ends
  async function endCarry(req, chat, { summary = null, error = false }) {
    const now = new Date();
    const { covers, ...sections } = summary || {};
    const { matchedCount } = await self.chats.updateOne({
      _id: chat._id,
      ownerId: chat.ownerId,
      'carry.status': 'running'
    }, {
      $set: error
        ? {
          carry: {
            status: 'failed',
            updatedAt: now
          }
        }
        : {
          carry: null,
          carried: summary
            ? {
              summary: sections,
              at: now
            }
            : null,
          updatedAt: now
        }
    });
    if (matchedCount) {
      await self.publish(req, chat._id, 'carry', {
        status: error ? 'failed' : 'done'
      });
    }
  }
};
