// Provides reusable UI methods relating to the archiving and restoring documents
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';

export default {
  methods: {
    // A UI method to archive a document. `action` must be the base action URL of the
    // module whose API should be invoked. If errors occur they are displayed to the user
    // appropriately, not returned or thrown to the caller.
    //
    // Returns `true` if the document was ultimately archived.

    async archive(doc, isPage) {
      try {
        const moduleOptions = window.apos.modules[doc.type];
        const action = moduleOptions.action;
        const isPublished = !!doc.lastPublishedAt;
        const isCurrentContext = doc.aposDocId === window.apos.adminBar.context.aposDocId;
        const hasChildren = isPage && doc._children.length;
        const confirm = await apos.confirm({
          heading: `Archive ${isPage ? 'Page' : (moduleOptions.label || 'Content')}`,
          description: isPublished
            ? `Are you sure you want to archive ${doc.title ? '"' + doc.title + '"' : 'this content'}? This will also un-publish the ${moduleOptions.label.toLowerCase() || 'content'}.`
            : `Are you sure you want to archive ${doc.title ? '"' + doc.title + '"' : 'this content'}?`,
          affirmativeLabel: `Yes, archive ${isPage ? 'page' : (moduleOptions.label.toLowerCase() || 'content')}`,
          note: isCurrentContext
            ? 'You are currently viewing the page you want to archive. When it is archived you will be returned to the home page.'
            : null,
          form: hasChildren
            ? {
              schema: [ {
                type: 'radio',
                name: 'choice',
                required: true,
                choices: [ {
                  label: 'Archive only this page',
                  value: 'this'
                }, {
                  label: 'Archive this page and subpages',
                  value: 'all'
                } ]
              } ],
              value: {
                data: {}
              }
            }
            : null
        });

        if (confirm) {
          const body = {
            archived: true,
            _publish: true
          };

          if (isPage) {
            const pageTree = await this.getPageTree();
            const archiveId = pageTree._children.filter(p => p.type === '@apostrophecms/archive-page')[0]._id;
            body._targetId = archiveId;
            body._position = 'lastChild';

            if (confirm.data.choice === 'this') {
              // Editor wants to archive one page but not it's children
              // Before archiving the page in question, move the children up a level,
              // preserving their current order
              await doc._children.forEach(async child => {
                await apos.http.patch(`${action}/${child._id}`, {
                  body: {
                    _targetId: doc._id,
                    _position: 'before'
                  },
                  busy: false,
                  draft: true
                });
              });
            }
          }

          await apos.http.patch(`${action}/${doc._id}`, {
            body,
            busy: true,
            draft: true
          });

          apos.notify('Content Archived', {
            type: 'success',
            icon: 'archive-arrow-down-icon'
          });

          if (isCurrentContext) {
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
    async restore (doc, isPage) {
      const moduleOptions = apos.modules[doc.type];
      const action = moduleOptions.action;
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
