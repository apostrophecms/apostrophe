// Provides reusable UI methods relating to the archiving and restoring documents
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';

export default {
  methods: {
    // A UI method to archive a document. `action` must be the base action URL of the
    // module whose API should be invoked. If errors occur they are displayed to the user
    // appropriately, not returned or thrown to the caller.
    //
    // Returns `true` if the document was ultimately archived.

    async archive(doc) {
      try {
        console.log(doc.type);
        const moduleOptions = window.apos.modules[doc.type];
        const action = moduleOptions.action;
        const isPublished = !!doc.lastPublishedAt;
        const isPage = moduleOptions.type === '@apostrophecms/page';
        if (await apos.confirm({
          heading: 'Are You Sure?',
          description: isPublished
            ? `Are you sure you want to archive the ${doc.title ? '"' + doc.title + '"' : 'this content'}? This will also un-publish the ${moduleOptions.label.toLowerCase() || 'content'}.`
            : 'This will move the document to the archive.',
          affirmativeLabel: `Yes, archive ${moduleOptions.label.toLowerCase() || 'content'}`
        })) {
          const body = {
            archived: true,
            _publish: true
          };

          if (isPage) {
            const pageTree = await this.getPageTree();
            const archiveId = pageTree._children.filter(p => p.type === '@apostrophecms/archive-page')[0]._id;
            body._targetId = archiveId;
            body._position = 'lastChild';
          }

          await apos.http.patch(`${action}/${doc._id}`, {
            body,
            busy: true,
            draft: true
          });
          if (doc._id === window.apos.adminBar.contextId) {
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
    async restore (doc) {
      const moduleOptions = apos.modules[doc.type];
      const action = moduleOptions.action;
      const isPage = moduleOptions.type === '@apostrophecms/page';
      const body = {
        archived: false
      };
      AposAdvisoryLockMixin.methods.addLockToRequest(body);

      if (isPage) {
        const pageTree = await this.getPageTree();
        const homeId = pageTree._id;
        body._targetId = homeId;
        body._position = 'lastChild';
      }

      try {
        await apos.http.patch(`${action}/${doc._id}`, {
          body,
          busy: true,
          draft: true
        });
        apos.bus.$emit('content-changed');
        return true;
      } catch (e) {
        if (AposAdvisoryLockMixin.methods.isLockedError(e)) {
          await this.showLockedError(e);
        } else {
          await apos.alert({
            heading: 'An Error Occurred',
            description: e.message || 'An error occurred while restoring the document from the archive.'
          });
        }
      }
    },
    async getPageTree() {
      return apos.http.get(
        '/api/v1/@apostrophecms/page', {
          busy: true,
          qs: {
            all: '1',
            archived: 'any'
          },
          draft: true
        }
      );
    }
  }
};
