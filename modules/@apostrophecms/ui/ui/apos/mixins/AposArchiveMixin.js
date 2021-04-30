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
        const moduleOptions = window.apos.modules[doc.type];
        // Make sure that if there are any modified descendants we know about them
        const isPage = doc.slug.startsWith('/');
        if (isPage) {
          doc = await apos.http.get(`${moduleOptions.action}/${doc._id}`, {
            draft: true,
            qs: {
              children: {
                depth: 10
              }
            }
          });
        }
        const isModified = findModified(doc);
        const descendants = countDescendants(doc);
        const draftDescendants = countDraftDescendants(doc);
        const action = window.apos.modules[doc.type].action;
        const isPublished = !!doc.lastPublishedAt;
        const isCurrentContext = doc.aposDocId === window.apos.adminBar.context.aposDocId;
        const plainType = isPage ? 'page' : (moduleOptions.label || 'content');
        let description = `You are going to archive the ${plainType} "${doc.title}"`;

        if (descendants > 0) {
          description += `, which has ${descendants} child ${plainType}${descendants > 1 ? 's' : ''}`;
        }

        if (draftDescendants > 0) {
          description += `, ${draftDescendants} of which have never been published`;
        }

        if (isPublished) {
          description += `. This will also un-publish the ${plainType}`;
        }

        if (draftDescendants > 0) {
          description += '. Child pages that have never been published will be permanently deleted';
        }

        if (isModified) {
          description += '. Also, unpublished draft changes to this document and/or its children will be permanently deleted';
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
          form: descendants > 0
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
            _publish: !isPage
          };

          if (isPage) {
            body._targetId = '_archive';
            body._position = 'lastChild';

            if (confirm.data && confirm.data.choice === 'this') {
              // Editor wants to archive one page but not it's children
              // Before archiving the page in question, move the children up a level,
              // preserving their current order
              for (const child of doc._children) {
                await apos.http.patch(`${action}/${child._id}`, {
                  body: {
                    _targetId: doc._id,
                    _position: 'before'
                  },
                  busy: false,
                  draft: true
                });
              }
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
      function findModified(doc) {
        if (doc.modified) {
          return true;
        }
        return (doc._children || []).find(doc => findModified(doc));
      }
      function countDescendants(doc) {
        let total = 0;
        for (const child of doc._children) {
          total++;
          total += countDescendants(child);
        }
        return total;
      }
      function countDraftDescendants(doc) {
        let total = 0;
        for (const child of doc._children) {
          total += ((child.lastPublishedAt && 1) || 0);
          total += countDraftDescendants(child);
        }
        return total;
      }
    },

    async restore (doc) {
      const moduleOptions = apos.modules[doc.type];
      const isPage = doc.slug.startsWith('/');
      const action = window.apos.modules[doc.type].action;
      const plainType = isPage ? 'page' : (moduleOptions.label || 'content');
      let confirm = null;

      try {
        // If the doc has children, ask if they should be restored as well
        if (isPage && doc._children && doc._children.length) {
          const childLength = doc._children.length;
          const description = `You are going to restore the ${plainType} “${doc.title}”, which has ${childLength} child ${plainType}${doc._children.length > 1 ? 's' : ''}.`;
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
          for (const child of doc._children) {
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
          }
        }

        // Move doc in question
        const body = {
          archived: false,
          _targetId: isPage ? '_home' : null,
          _position: isPage ? 'firstChild' : null,
          _publish: !isPage
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
