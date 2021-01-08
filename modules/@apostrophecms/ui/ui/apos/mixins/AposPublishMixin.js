// Provides reusable UI methods relating to the publication and management of drafts.

export default {
  methods: {
    // A UI method to publish a document. `action` must be the base action URL of the
    // module whose API should be invoked. If errors occur they are displayed to the user
    // appropriately, not returned or thrown to the caller. If a page cannot be published
    // because its ancestors are unpublished, the user is invited to publish its
    // ancestors first, and the publish operation is then retried.
    //
    // A notification of success is displayed, with a button to revert the published
    // mode of the document to its previous value.
    //
    // Returns `true` if the document was ultimately published.
    async publish(action, _id) {
      try {
        await apos.http.post(`${action}/${_id}/publish`, {
          body: {},
          busy: true
        });
        const event = {
          name: 'revert-published-to-previous',
          data: {
            action,
            _id
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
            description: `To publish this page, you must also publish the following pages: ${e.body.data.unpublishedAncestors.map(page => page.title).join(', ')}\nDo you want to do that now?`
          })) {
            try {
              for (const page of e.body.data.unpublishedAncestors) {
                await apos.http.post(`${action}/${page._id}/publish`, {
                  body: {},
                  busy: true
                });
              }
              // Retry now that ancestors are published
              return this.publish(action, _id);
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
      return false;
    },

    // A UI method to revert a draft document to the last published version or, if the document
    // has never been published, delete the draft entirely. The user is advised of the difference.
    //
    // Returns an object if a change was made, or false if an error was reported to the user.
    //
    // If the draft document still exists the returned object will have a `doc` property containing
    // its newly reverted contents.
    async discardDraft(action, _id, isPublished) {
      try {
        if (await apos.confirm({
          heading: 'Are You Sure?',
          description: isPublished
            ? 'This will discard all changes since the document was last published.'
            : 'Since this draft has never been published, this will completely delete the document.'
        })) {
          if (isPublished) {
            const doc = await apos.http.post(`${action}/${_id}/revert-draft-to-published`, {
              body: {},
              busy: true
            });
            apos.notify('Discarded draft.', {
              type: 'success',
              dismiss: true
            });
            apos.bus.$emit('content-changed', doc);
            return {
              doc
            };
          } else {
            await apos.http.delete(`${action}/${_id}`, {
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
