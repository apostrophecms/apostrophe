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
      const moduleOptions = window.apos.modules[doc.type];
      // Make sure that if there are any modified descendants we know about them
      const isPage = doc.slug.startsWith('/');
      try {
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
        const plainType = isPage ? this.$t('apostrophe:page') : (this.$t(moduleOptions.label) || this.$t('apostrophe:document'));

        const sentences = [];

        sentences.push(this.$t('apostrophe:confirmArchive', {
          type: plainType,
          title: doc.title
        }));

        if (descendants > 0) {
          sentences.push(this.$t('apostrophe:archivingPageHasChild', {
            count: descendants
          }));
        }

        if (draftDescendants > 0) {
          sentences.push(this.$t('apostrophe:archivingDraftChildCount', {
            count: draftDescendants
          }));
        }

        if (isPublished) {
          sentences.push(this.$t('apostrophe:archivingWillUnpublish', {
            type: this.$t(plainType)
          }));
        }

        if (draftDescendants > 0) {
          sentences.push(this.$t('apostrophe:archivingWillDeleteDraftChildren'));
        }

        if (isModified) {
          if (isPage) {
            sentences.push(this.$t('apostrophe:archivingPageWillLoseDraftChanges'));
          } else {
            sentences.push(this.$t('apostrophe:archivingWillLoseDraftChanges'));
          }
        }

        // Confirm archiving
        const confirm = await apos.confirm({
          heading: this.$t('apostrophe:archiveType', { type: plainType }),
          description: sentences.join(this.$t('apostrophe:sentenceJoiner')),
          affirmativeLabel: this.$t('apostrophe:archiveTypeAffirmativeLabel', { type: plainType }),
          note: isCurrentContext
            ? this.$t('apostrophe:archiveTypeNote', { type: plainType })
            : null,
          localize: false,
          form: descendants > 0
            ? {
              schema: [ {
                type: 'radio',
                name: 'choice',
                required: true,
                choices: [ {
                  label: this.$t('apostrophe:archiveOnlyThisPage'),
                  value: 'this'
                }, {
                  label: this.$t('apostrophe:archivePageAndSubpages'),
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
            archived: true
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
          doc = await apos.http.patch(`${action}/${doc._id}`, {
            body,
            busy: true,
            draft: true
          });

          apos.notify('apostrophe:contentArchived', {
            type: 'success',
            icon: 'archive-arrow-down-icon',
            dismiss: true
          });

          if (isCurrentContext) {
            // With the current context doc gone, we need to move to safe ground
            location.assign(`${window.apos.prefix}/`);
            return;
          }
          apos.bus.$emit('content-changed', {
            doc,
            action: 'archive'
          });
          return true;
        }
      } catch (e) {
        await apos.alert({
          heading: this.$t('apostrophe:error'),
          description: e.message || this.$t('apostrophe:errorWhileArchiving'),
          localize: false
        });
      }
      function findModified(doc) {
        if (doc.modified) {
          return true;
        }
        return (doc._children || []).find(doc => findModified(doc));
      }
      function countDescendants(doc) {
        if (!isPage) {
          return 0;
        }
        let total = 0;
        for (const child of doc._children) {
          total++;
          total += countDescendants(child);
        }
        return total;
      }
      function countDraftDescendants(doc) {
        if (!isPage) {
          return 0;
        }
        let total = 0;
        for (const child of doc._children) {
          total += (child.lastPublishedAt ? 0 : 1);
          total += countDraftDescendants(child);
        }
        return total;
      }
    },
    async restore(doc) {
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
            heading: 'apostrophe:restoreType',
            description,
            affirmativeLabel: 'apostrophe:restoreTypeAffirmativeLabel',
            form: {
              schema: [ {
                type: 'radio',
                name: 'choice',
                required: true,
                choices: [ {
                  // Form labels don't normally localize on the client side
                  // because schemas are almost always localized before
                  // pushing to the client side
                  label: 'apostrophe:restoreOnlyThisPage',
                  value: 'this'
                }, {
                  label: 'apostrophe:restoreThisPageAndSubpages',
                  value: 'all'
                } ]
              } ],
              value: {
                data: {}
              }
            },
            interpolate: {
              type: plainType
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
                archived: true
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
          _position: isPage ? 'firstChild' : null
        };

        AposAdvisoryLockMixin.methods.addLockToRequest(body);

        doc = await apos.http.patch(`${action}/${doc._id}`, {
          body,
          busy: true,
          draft: true
        });

        apos.notify('apostrophe:contentRestored', {
          type: 'success',
          icon: 'archive-arrow-up-icon',
          dismiss: true
        });

        apos.bus.$emit('content-changed', {
          doc,
          action: 'restore'
        });
        return doc;
      } catch (e) {
        if (AposAdvisoryLockMixin.methods.isLockedError(e)) {
          await this.showLockedError(e);
        } else {
          await apos.alert({
            heading: this.$t('apostrophe:error'),
            description: e.message || this.$t('apostrophe:errorWhileRestoringArchive'),
            localize: false
          });
        }
      }
    }
  }
};
