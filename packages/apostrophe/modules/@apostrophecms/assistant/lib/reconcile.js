// A run dies with its process, and a process can also die between the
// writes of a move (send, answer, skip), so a chat can be left open with no
// run that will ever free it; a revert too (see `reconcileRevert`). The
// records and the request's job are the witnesses: a chat is reconciled
// when it is read, and before a send or a stop is refused because of it.
//
// Every move takes milliseconds, so a state is only taken as left behind
// once it is older than the job module's `abandonAfter`, the time after
// which a run with no heartbeat is taken as dead.

const INTERRUPTED = Object.freeze({
  name: 'interrupted',
  message: 'the request was interrupted before it finished'
});

module.exports = (self) => {
  return {
    /**
     * Frees a chat left open by a process that died, and ends its request:
     * a request that is missing or already ended frees the chat; a run whose
     * job is abandoned or gone, or that never got one, ends the request as
     * failed; a job that ended while its end was never stored ends the
     * request from the job's record; a skip or an answer cut short ends the
     * request as failed.
     *
     * @param {object} req
     * @param {object} chat
     * @returns {Promise<object>} The chat as it is now.
     */
    async reconcileChat(req, chat) {
      if (chat.openRevert && !chat.deleting) {
        await self.reconcileRevert(req, chat);
        return self.getChat(req, chat._id);
      }
      const open = chat.openRequest;
      if (!open || chat.deleting) {
        return chat;
      }
      const jobs = self.apos.modules['@apostrophecms/job'];
      const grace = jobs.options.abandonAfter;
      const left = date => (Date.now() - new Date(date).getTime()) > grace;
      const request = await self.requests.findOne({
        _id: open._id,
        ownerId: chat.ownerId
      });
      if (!request) {
        if (left(chat.updatedAt)) {
          await self.closeRequest(req, chat, { _id: open._id });
          await self.publish(req, chat._id, 'chat');
        }
      } else if (![ 'running', 'stopping', 'waiting' ].includes(request.status)) {
        if (left(request.updatedAt)) {
          await self.closeRequest(req, chat, request);
          await self.publishRequest(req, request);
        }
      } else if ((open.status === 'skipping') || (request.status === 'waiting')) {
        // Waiting is a state of the chat's slot as much as of the request:
        // they disagree only when a skip or an answer was cut short
        if ((open.status !== 'waiting') && left(chat.updatedAt) && left(request.updatedAt)) {
          await fail();
        }
      } else if (!request.jobId) {
        if (left(request.updatedAt)) {
          await fail();
        }
      } else {
        const job = await jobs.db.findOne({ _id: request.jobId });
        if (!job) {
          if (left(request.updatedAt)) {
            await fail();
          }
        } else if (jobs.isAbandoned(job)) {
          await fail();
        } else if (job.ended) {
          // The run ended and its own end failed to store
          await self.endRun(req, chat, request, job.results?.messages
            ? {
              result: job.results,
              prior: request.prior
            }
            : { error: job.error || INTERRUPTED });
        }
      }
      return self.getChat(req, chat._id);

      async function fail() {
        await self.endRun(req, chat, request, { error: INTERRUPTED });
        // A waiting request is not ended by `endRun`
        if (request.status === 'waiting') {
          const now = new Date();
          await self.requests.updateOne({
            _id: request._id,
            ownerId: request.ownerId,
            status: 'waiting'
          }, {
            $set: {
              status: 'failed',
              error: INTERRUPTED,
              asks: null,
              updatedAt: now,
              endedAt: now
            }
          });
          await self.closeRequest(req, chat, request);
          await self.publishRequest(req, request);
        }
      }
    }
  };
};
