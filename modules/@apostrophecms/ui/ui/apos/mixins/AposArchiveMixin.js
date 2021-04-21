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
        const plainType = isPage ? 'page' : (moduleOptions.label || 'content');
        let description = `You are going to archive the ${plainType} "${doc.title}"`;

        if (hasChildren) {
          description += `, which has ${doc._children.length} child ${plainType}${doc._children.length > 1 ? 's' : null}`;
        }

        if (isPublished) {
          description += `. This will also un-publish the ${plainType}`;
        }

        description += '.';

        // Confirm archiving
        const confirm = await apos.confirm({
          heading: `Archive ${plainType}`,
          description,
          affirmativeLabel: `Yes, archive ${plainType}`,
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
                  label: `Archive only this ${plainType}`,
                  value: 'this'
                }, {
                  label: `Archive this ${plainType} and all child ${plainType}s`,
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
            body._targetId = '_archive';
            body._position = 'lastChild';

            if (confirm.data && confirm.data.choice === 'this') {
              // Editor wants to archive one page but not it's children
              // Before archiving the page in question, move the children up a level,
              // preserving their current order
              doc._children.forEach(async child => {
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

          // Move doc in question
          await apos.http.patch(`${action}/${doc._id}`, {
            body,
            busy: true,
            draft: true
          });

          apos.notify('Content Archived', {
            type: 'success',
            icon: 'archive-arrow-down-icon',
            dismiss: true
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
      const plainType = isPage ? 'page' : (moduleOptions.label || 'content');
      let children = null;
      let confirm = null;

      try {
        // If the doc has children, ask if they should be restored as well
        if (doc._children) {
          children = [ ...doc._children ];
          const childLength = doc._children.length;
          const description = `You are going to restore the ${plainType} “${doc.title}”, which has ${childLength} child ${plainType}${doc._children.length > 1 ? 's' : null}.`;
          confirm = await apos.confirm({
            heading: `Restore ${plainType}`,
            description,
            affirmativeLabel: `Yes, restore ${plainType}`,
            form: {
              schema: [ {
                type: 'radio',
                name: 'choice',
                required: true,
                choices: [ {
                  label: 'Restore only this page',
                  value: 'this'
                }, {
                  label: 'Restore this page and subpages',
                  value: 'all'
                } ]
              } ],
              value: {
                data: {}
              }
            }
          });
        }

        // If restoring a page and the editor wants to leave the children in the archive
        if (confirm && confirm.data.choice === 'this') {
          children.forEach(async child => {
            await apos.http.patch(`${action}/${child._id}`, {
              body: {
                _targetId: '_archive',
                _position: 'lastChild',
                archived: true,
                _publish: false
              },
              busy: false,
              draft: true
            });
          });
        }

        // Move doc in question
        const body = {
          archived: false,
          _targetId: isPage ? '_home' : null,
          _position: isPage ? 'firstChild' : null
        };

        AposAdvisoryLockMixin.methods.addLockToRequest(body);

        await apos.http.patch(`${action}/${doc._id}`, {
          body,
          busy: true,
          draft: true
        });

        apos.notify('Content Restored', {
          type: 'success',
          icon: 'archive-arrow-up-icon',
          dismiss: true
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
    }
  }
};
