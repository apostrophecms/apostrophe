// Provides reusable UI methods relating to the publication and management of drafts.

export default {
  methods: {
    // A UI method to publish a document. If errors occur they are displayed to the user
    // appropriately, not returned or thrown to the caller. If a page cannot be published
    // because its ancestors are unpublished, the user is invited to publish its
    // ancestors first, and the publish operation is then retried.
    //
    // A notification of success is displayed, with a button to revert the published
    // mode of the document to its previous value.
    //
    // Returns `true` if the document was ultimately published.
    async publish(doc) {
      const previouslyPublished = !!doc.lastPublishedAt;
      const action = window.apos.modules[doc.type].action;
      try {
        await apos.http.post(`${action}/${doc._id}/publish`, {
          body: {},
          busy: true
        });
        const event = {
          name: previouslyPublished ? 'revert-published-to-previous' : 'unpublish',
          data: {
            action,
            _id: doc._id
          }
        };
        apos.notify(`Your changes have been published. <button data-apos-bus-event='${JSON.stringify(event)}'>Undo Publish</button>`, {
          type: 'success',
          dismiss: true
        });
        return true;
      } catch (e) {
        if ((e.name === 'invalid') && e.body && e.body.data && e.body.data.unpublishedAncestors) {
          if (await apos.confirm({
            heading: 'One or more parent pages have not been published',
            description: `To publish this page, you must also publish the following pages: ${e.body.data.unpublishedAncestors.map(page => page.title).join(', ')}.\nDo you want to do that now?`
          })) {
            try {
              for (const page of e.body.data.unpublishedAncestors) {
                await apos.http.post(`${action}/${page._id}/publish`, {
                  body: {},
                  busy: true
                });
              }
              // Retry now that ancestors are published
              return this.publish(action, doc._id, previouslyPublished);
            } catch (e) {
              await apos.alert({
                heading: 'An Error Occurred While Publishing',
                description: e.message || 'An error occurred while publishing a parent page.'
              });
            }
          }
        } else {
          await apos.alert({
            heading: 'An Error Occurred While Publishing',
            description: e.message || 'An error occurred while publishing the document.'
          });
        }
        return false;
      }
    },
    // A UI method to submit a draft document for review and possible publication
    // ("propose changes").
    async submitDraft(doc) {
      const action = window.apos.modules[doc.type].action;
      try {
        const submitted = await apos.http.post(`${action}/${doc._id}/submit`, {
          busy: true,
          body: {},
          draft: true
        });
        apos.notify('Submitted for review.', {
          type: 'success',
          dismiss: true
        });
        return submitted;
      } catch (e) {
        await apos.alert({
          heading: 'An Error Occurred While Submitting',
          description: e.message || 'An error occurred while submitting the document.'
        });
        return false;
      }
    },
    // A UI method to dismiss a previous submission. Returns true on success.
    // Notifies the user appropriately.
    async dismissSubmission(doc) {
      const action = window.apos.modules[doc.type].action;
      try {
        await apos.http.post(`${action}/${doc._id}/dismiss-submission`, {
          body: {},
          busy: true
        });
        apos.notify('Dismissed submission.', {
          type: 'success',
          dismiss: true
        });
        return true;
      } catch (e) {
        await apos.alert({
          heading: 'An Error Occurred While Dismissing',
          description: e.message || 'An error occurred while dismissing the submission.'
        });
        return false;
      }
    },
    // A UI method to revert a draft document to the last published version or, if the document
    // has never been published, delete the draft entirely. The user is advised of the difference.
    //
    // Returns an object if a change was made, or false if an error was reported to the user.
    //
    // If the draft document still exists the returned object will have a `doc` property containing
    // its newly reverted contents.
    async discardDraft(doc) {
      const isPublished = !!doc.lastPublishedAt;
      try {
        if (await apos.confirm({
          heading: `Discard ${this.moduleOptions.label || 'content'}`,
          description: isPublished
            ? 'This will discard all changes since the document was last published.'
            : `Since "${doc.title}" has never been published, this will completely delete the document.`,
          affirmativeLabel: isPublished
            ? 'Yes, discard changes'
            : 'Yes, delete document'
        })) {
          const action = window.apos.modules[doc.type].action;
          if (isPublished) {
            const newDoc = await apos.http.post(`${action}/${doc._id}/revert-draft-to-published`, {
              body: {},
              busy: true
            });
            apos.notify('Discarded draft.', {
              type: 'success',
              dismiss: true
            });
            apos.bus.$emit('content-changed', newDoc);
            return {
              newDoc
            };
          } else {
            await apos.http.delete(`${action}/${doc._id}`, {
              body: {},
              busy: true
            });
            apos.notify('Deleted document.', {
              type: 'success',
              dismiss: true
            });
            apos.bus.$emit('content-changed');
            return {};
          }
        }
      } catch (e) {
        await apos.alert({
          heading: 'An Error Occurred',
          description: e.message || 'An error occurred while restoring the previously published version.'
        });
      }
    }
  }
};
