// Provides reusable UI methods relating to the archiving and restoring documents
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';

export default {
  methods: {
    // A UI method to archive a document. `action` must be the base action URL of the
    // module whose API should be invoked. If errors occur they are displayed to the user
    // appropriately, not returned or thrown to the caller.
    //
    // A notification of success is displayed, with a button to revert the published
    // mode of the document to its previous value.
    //
    // Returns `true` if the document was ultimately archived.
    async archive(action, _id, isPublished) {
      try {
        if (await apos.confirm({
          heading: 'Are You Sure?',
          description: isPublished
            ? 'This will move the document to the archive and un-publish it.'
            : 'This will move the document to the archive.'
        })) {
          await apos.http.patch(`${action}/${_id}`, {
            body: {
              archived: true,
              _publish: true
            },
            busy: true,
            draft: true
          });
          if (_id === window.apos.adminBar.contextId) {
            // With the current context doc gone, we need to move to safe ground
            location.assign(`${window.apos.prefix}/`);
            return;
          }
          apos.bus.$emit('content-changed');
          return true;
        }
      } catch (e) {
        await apos.alert({
          heading: 'An Error Occurred',
          description: e.message || 'An error occurred while moving the document to the archive.'
        });
      }
    },
    async unarchive (action, _id) {
      const body = {
        archived: false
      };
      AposAdvisoryLockMixin.methods.addLockToRequest(body);
      try {
        await apos.http.patch(`${action}/${_id}`, {
          body,
          busy: true,
          draft: true
        });
        apos.bus.$emit('content-changed');
      } catch (e) {
        if (AposAdvisoryLockMixin.methods.isLockedError(e)) {
          await this.showLockedError(e);
        } else {
          await apos.alert({
            heading: 'An Error Occurred',
            description: e.message || 'An error occurred while moving the document to the archive.'
          });
        }
      }
    }
  }
};
