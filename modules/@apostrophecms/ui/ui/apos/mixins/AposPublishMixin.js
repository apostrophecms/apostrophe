// Provides reusable UI methods relating to the publication and management of drafts.

export default {
  computed: {
    manuallyPublished() {
      return this.moduleOptions.localized && !this.moduleOptions.autopublish;
    }
  },
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
        doc = await apos.http.post(`${action}/${doc._id}/publish`, {
          body: {},
          busy: true
        });
        apos.notify('apostrophe:changesPublished', {
          type: 'success',
          dismiss: true,
          icon: 'check-all-icon',
          buttons: [
            {
              type: 'event',
              label: 'apostrophe:undoPublish',
              name: previouslyPublished ? 'revert-published-to-previous' : 'unpublish',
              data: {
                action,
                _id: doc._id
              }
            }
          ]
        });
        apos.bus.$emit('content-changed', {
          doc,
          action: 'publish'
        });
        return doc;
      } catch (e) {
        if ((e.name === 'invalid') && e.body && e.body.data && e.body.data.unpublishedAncestors) {
          if (await apos.confirm({
            heading: 'apostrophe:unpublishedParent',
            description: 'apostrophe:unpublishedParentDescription',
            interpolate: {
              unpublishedParents: this.$t(e.body.data.unpublishedAncestors.map(page => page.title).join(this.$t('apostrophe:listJoiner')))
            }
          })) {
            try {
              for (const page of e.body.data.unpublishedAncestors) {
                await apos.http.post(`${action}/${page._id}/publish`, {
                  body: {},
                  busy: true
                });
              }
              // Retry now that ancestors are published
              return this.publish(doc);
            } catch (e) {
              await apos.alert({
                heading: this.$t('apostrophe:errorWhilePublishing'),
                description: e.message || this.$t('apostrophe:errorWhilePublishingParentPage'),
                localize: false
              });
            }
          }
        } else {
          await apos.alert({
            heading: this.$t('apostrophe:errorWhilePublishing'),
            description: e.message || this.$t('apostrophe:errorWhilePublishingDocument'),
            localize: false
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
        apos.notify('apostrophe:submittedForReview', {
          type: 'success',
          icon: 'list-status-icon',
          dismiss: true
        });
        apos.bus.$emit('content-changed', {
          doc: submitted,
          action: 'submit'
        });
        return submitted;
      } catch (e) {
        await apos.alert({
          heading: this.$t('apostrophe:errorWhileSubmitting'),
          description: e.message || this.$t('apostrophe:errorWhileSubmittingDescription'),
          localize: false
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
        apos.notify('apostrophe:dismissedSubmission', {
          type: 'success',
          dismiss: true,
          icon: 'close-circle-icon'
        });
        doc = {
          ...doc,
          submitted: null
        };
        apos.bus.$emit('content-changed', {
          doc,
          action: 'dismiss-submission'
        });
      } catch (e) {
        await apos.alert({
          heading: this.$t('apostrophe:errorWhileDismissing'),
          description: e.message || this.$t('apostrophe:errorWhileDismissingDescription'),
          localize: false
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
          heading: isPublished
            ? 'apostrophe:discardDraft'
            : 'apostrophe:deleteDraft',
          description: isPublished
            ? 'apostrophe:discardDraftDescription'
            : 'apostrophe:deleteDraftDescription',
          affirmativeLabel: isPublished
            ? 'apostrophe:discardDraftAffirmativeLabel'
            : 'apostrophe:deleteDraftAffirmativeLabel',
          interpolate: {
            title: doc.title
          }
        })) {
          const action = window.apos.modules[doc.type].action;
          if (isPublished) {
            const newDoc = await apos.http.post(`${action}/${doc._id}/revert-draft-to-published`, {
              body: {},
              busy: true
            });
            apos.notify('apostrophe:draftDiscarded', {
              type: 'success',
              dismiss: true,
              icon: 'text-box-remove-icon'
            });
            apos.bus.$emit('content-changed', {
              doc: newDoc,
              action: 'revert-draft-to-published'
            });
            return {
              doc: newDoc
            };
          } else {
            await apos.http.delete(`${action}/${doc._id}`, {
              body: {},
              busy: true
            });
            apos.notify('apostrophe:draftDeleted', {
              type: 'success',
              dismiss: true
            });
            apos.bus.$emit('content-changed', {
              doc,
              action: 'delete'
            });
            return {};
          }
        }
      } catch (e) {
        await apos.alert({
          heading: this.$t('apostrophe:error'),
          description: e.message || this.$t('apostrophe:errorWhileRestoringPrevious'),
          localize: false
        });
      }
    }
  }
};
