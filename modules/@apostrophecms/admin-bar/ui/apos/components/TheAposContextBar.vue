<template>
  <div :class="classes">
    <template v-if="contextBarActive">
      <TheAposContextUndoRedo
        :v-if="editMode"
        :patches-since-loaded="patchesSinceLoaded"
        :undone="undone"
        @undo="undo"
        @redo="redo"
        :retrying="retrying"
        :editing="editing"
        :saving="saving"
        :saved="saved"
      />
      <TheAposContextTitle
        v-if="!hasCustomUi"
        :context="context"
        :draft-mode="draftMode"
        @switch-draft-mode="switchDraftMode"
      />
      <TheAposContextModeAndSettings
        :context="context"
        :published="published"
        :edit-mode="editMode"
        :has-custom-ui="hasCustomUi"
        :can-publish="canPublish"
        :ready-to-publish="readyToPublish"
        :custom-publish-label="customPublishLabel"
        @switch-edit-mode="switchEditMode"
        @publish="onPublish"
      />
    </template>
  </div>
</template>

<script>
import { klona } from 'klona';
import cuid from 'cuid';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';

export default {
  name: 'TheAposContextBar',
  mixins: [ AposPublishMixin, AposAdvisoryLockMixin ],
  emits: [ 'mounted' ],
  data() {
    const query = apos.http.parseQuery(location.search);
    // If the URL references a draft, go into draft mode but then clean up the URL
    const draftMode = query.aposMode || 'published';
    if (draftMode === 'draft') {
      const newQuery = { ...query };
      delete newQuery.aposMode;
      history.replaceState(null, '', apos.http.addQueryToUrl(location.href, newQuery));
    }
    return {
      patchesSinceLoaded: [],
      undone: [],
      patchesSinceSave: [],
      editMode: false,
      draftMode,
      queryDraftMode: query.aposMode,
      original: null,
      saving: false,
      editing: false,
      editingTimeout: null,
      retrying: false,
      saved: false,
      savingTimeout: null,
      published: null,
      context: window.apos.adminBar.context ? {
        ...window.apos.adminBar.context
      } : {},
      contextStack: [],
      // If a published context doc itself is not editable this will contain a hint
      // that the draft version is editable, when appropriate. It should only be
      // consulted when the context doc is published and not editable
      draftIsEditable: false
    };
  },
  computed: {
    contextBarActive() {
      return window.apos.adminBar.contextBar && this.canEdit;
    },
    canEdit() {
      return this.context._edit || ((this.context.aposLocale && this.context.aposLocale.endsWith(':published')) && this.draftIsEditable);
    },
    classes() {
      if (!this.contextBarActive) {
        return {};
      } else {
        return {
          'apos-admin-bar__row': true,
          'apos-admin-bar__row--utils': true
        };
      }
    },
    needToAutosave() {
      return !!this.patchesSinceSave.length;
    },
    canPublish() {
      return apos.modules[this.context.type].canPublish;
    },
    readyToPublish() {
      if (this.canPublish) {
        return this.context.modified && (!this.needToAutosave) && (!this.editing);
      } else if (this.context.submitted) {
        return this.context.updatedAt > this.context.submitted.at;
      } else if (this.context.lastPublishedAt) {
        return this.context.updatedAt > this.context.lastPublishedAt;
      } else {
        return true;
      }
    },
    moduleOptions() {
      return window.apos.adminBar;
    },
    action() {
      return apos.modules[this.context.type].action;
    },
    hasCustomUi() {
      return this.contextStack.length > 0;
    },
    customPublishLabel() {
      return (this.hasCustomUi && apos.modules[this.context.type].publishLabel) || null;
    }
  },
  watch: {
    editMode(newVal) {
      window.apos.adminBar.editMode = newVal;
    }
  },
  async mounted() {
    apos.bus.$on('revert-published-to-previous', this.onRevertPublishedToPrevious);
    apos.bus.$on('unpublish', this.onUnpublish);
    apos.bus.$on('set-context', this.onSetContext);
    apos.bus.$on('push-context', this.onPushContext);
    apos.bus.$on('pop-context', this.onPopContext);
    apos.bus.$on('context-editing', this.onContextEditing);
    apos.bus.$on('context-edited', this.onContextEdited);
    apos.bus.$on('content-changed', this.onContentChanged);

    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('storage', this.onStorage);

    // sessionStorage because it is deliberately browser-tab specific
    let tabId = sessionStorage.getItem('aposTabId');
    if (!tabId) {
      tabId = cuid();
      sessionStorage.setItem('aposTabId', tabId);
    }
    window.apos.adminBar.tabId = tabId;
    window.apos.adminBar.editMode = false;
    const lastBaseContext = JSON.parse(sessionStorage.getItem('aposLastBaseContext') || '{}');
    // Explicit query parameter beats our state on the previous page
    lastBaseContext.draftMode = this.queryDraftMode || lastBaseContext.draftMode;
    if (lastBaseContext.aposDocId === this.context.aposDocId) {
      if (lastBaseContext.draftMode !== this.draftMode) {
        await this.setContext({ mode: lastBaseContext.draftMode });
      }
      if (this.editMode !== lastBaseContext.editMode) {
        await this.switchEditMode(true);
      }
    }
    await this.updateDraftIsEditable();
    this.rememberLastBaseContext();
    this.published = await this.getPublished();
    this.$nextTick(() => {
      this.$emit('mounted');
    });

    apos.util.onReadyAndRefresh(() => {
      if (window.apos.adminBar.scrollPosition) {
        setTimeout(() => {
          window.scroll({
            left: window.apos.adminBar.scrollPosition.x,
            top: window.apos.adminBar.scrollPosition.y
          });
          window.apos.adminBar.scrollPosition = null;
        }, 0);
      }
    });
  },
  methods: {
    // Implements the `set-context` Apostrophe event, which can change the mode
    // (`draft` or `published`), the locale (such as `en`), and the context
    // document (`doc`). Navigates to `doc._url` if it differs from the browser's
    // current URL in the new mode, whether it is the current context doc or not.
    //
    // Accepts `mode`, `locale` and `doc` properties in its options object. Whether
    // the mode and locale are changing or not, if the `_url` of `doc` in the
    // final mode and locale does not match the current URL, navigate to it.
    // `doc` becomes the new context doc if it is not already.
    //
    // You should not emit `set-context` with a doc that has no `_url`, nor
    // do you need to because the user's browsing context does not change
    // when creating such a doc.
    //
    // If `locale` or `mode` are not passed, those parameters remain unchanged.
    // If `doc` is not passed the current context doc is assumed.
    //
    // See also `onPushContext` and `onPopContext` for a way to set a temporary
    // context document, such as global or palette, while it is being edited
    // "on the page."
    //
    // TODO: locales are not fully implemented in the UI yet. They are considered
    // in this API to reduce bc breaks in forthcoming betas.
    async onSetContext({
      mode,
      locale,
      doc
    }) {
      await this.setContext({
        mode,
        locale,
        doc,
        navigate: true
      });
      apos.bus.$emit('context-changed', {
        mode,
        locale,
        doc
      });
    },
    async onPushContext({
      doc
    }) {
      if (!this.draftMode !== 'draft') {
        await this.switchDraftMode('draft');
      }
      if (!this.editMode) {
        await this.switchEditMode(true);
      }
      this.contextStack.push({
        doc: this.context,
        original: this.original,
        patchesSinceLoaded: this.patchesSinceLoaded,
        undone: this.undone
      });
      this.original = klona(doc);
      this.patchesSinceLoaded = [];
      this.undone = [];
      await this.setContext({
        doc,
        mode: 'draft',
        navigate: false
      });
      // So that on-page areas react like foreign areas while
      // palette or another nested context is up
      await this.refresh();
    },
    async onPopContext() {
      const layer = this.contextStack.pop();
      this.original = layer.original;
      this.patchesSinceLoaded = layer.patchesSinceLoaded;
      this.undone = layer.undone;
      await this.setContext({
        doc: layer.doc
      });
      // So that areas revert to being editable
      await this.refresh();
    },
    async onContextEditing() {
      // Accept a hint that someone is actively typing in a
      // rich text editor and a context-edited event is likely
      // coming; allows continuity of the "Saving..." indicator
      // so it doesn't flicker once a second as you type
      this.editing = true;
      if (this.editingTimeout) {
        clearTimeout(this.editingTimeout);
      }
      this.editingTimeout = setTimeout(() => {
        this.editing = false;
        // Wait slightly longer than the rich text editor does
        // before sending us a context-edited event
      }, 1100);
    },
    async onPublish(e) {
      if (!this.canPublish) {
        const submitted = await this.submitDraft(this.context);
        if (submitted) {
          this.context = {
            ...this.context,
            submitted
          };
        }
      } else {
        const published = await this.publish(this.context);
        if (published) {
          this.context = {
            ...this.context,
            lastPublishedAt: Date.now(),
            modified: false
          };
          this.published = published;
        }
      }
    },
    onBeforeUnload(e) {
      if (this.patchesSinceSave.length || this.saving || this.editing) {
        e.preventDefault();
        // No actual control over the message is possible in modern browsers,
        // but Chrome requires we set a string here
        e.returnValue = '';
      }
    },
    async save() {
      // More patches could get pushed during the async call to
      // send the previous batch, so keep going until we clear
      // the queue
      while (this.patchesSinceSave.length) {
        const patchesSinceSave = this.patchesSinceSave;
        this.retrying = false;
        this.saving = true;
        this.patchesSinceSave = [];
        try {
          this.saved = false;
          const body = {
            _patches: patchesSinceSave
          };
          this.addLockToRequest(body);
          const doc = await apos.http.patch(`${this.action}/${this.context._id}`, {
            body
          });
          this.context = doc;
          this.retrying = false;
        } catch (e) {
          if (this.isLockedError(e)) {
            await this.showLockedError(e);
            return this.lockNotAvailable();
          }
          this.patchesSinceSave = [ ...patchesSinceSave, ...this.patchesSinceSave ];
          // Wait 5 seconds between attempts if errors occur
          await new Promise((resolve, reject) => {
            setTimeout(() => resolve(), 5000);
          });
          this.retrying = true;
        }
      }
      this.saving = false;
      this.saved = true;
    },
    // Switch the mode to 'published' or 'draft'.
    //
    // May refresh or navigate to another URL if needed, depending on whether
    // _url differs between draft and published. May do nothing if the mode
    // matches the existing one.
    async switchDraftMode(mode) {
      await this.setContext({
        mode
      });
    },
    // Implementation detail of onSetContext and onPushContext.
    // Carries out a refresh if not leaving the page.
    async setContext({
      mode,
      locale,
      doc,
      navigate = false
    }) {
      mode = mode || this.draftMode;
      locale = locale || apos.i18n.locale;
      doc = doc || this.context;
      if ((mode === this.draftMode) && (locale === apos.i18n.locale)) {
        if ((this.context._id === doc._id) && (!this.urlDiffers(doc._url))) {
          return;
        } else if (navigate && this.urlDiffers(doc._url)) {
          await this.unlock();
          return window.location.assign(doc._url);
        } else {
          await this.unlock();
        }
      }
      try {
        // Returns the doc as represented in the new locale and mode
        const action = window.apos.modules[doc.type].action;
        const modeDoc = await apos.http.get(`${action}/${doc._id}`, {
          busy: true,
          qs: {
            aposMode: mode,
            aposLocale: locale
          }
        });
        if (navigate && (!modeDoc._url)) {
          await apos.alert({
            heading: 'apostrophe:pageDoesNotExistYet',
            description: 'apostrophe:pageDoesNotExistYetDescription',
            interpolate: {
              mode,
              locale
            }
          });
          return;
        }
        window.sessionStorage.setItem('aposStateChange', Date.now());
        window.sessionStorage.setItem('aposStateChangeSeen', '{}');
        if (mode === 'published') {
          this.editMode = false;
        }
        // Patch the module options. This is necessary because we're simulating
        // something that normally would involve a new page load, but without
        // the UX negatives of that. TODO: VueX as a long term fix
        window.apos.adminBar.context = modeDoc;
        window.apos.adminBar.contextId = modeDoc._id;
        this.context = modeDoc;
        this.published = await this.getPublished();
        await this.updateDraftIsEditable();
        this.draftMode = mode;
        if (navigate) {
          if (!await this.refreshOrReload(modeDoc._url)) {
            if (this.editMode) {
              if (!await this.lock(`${this.action}/${this.context._id}`)) {
                this.lockNotAvailable();
              }
            }
          }
        } else {
          if (this.editMode) {
            if (!await this.lock(`${this.action}/${this.context._id}`)) {
              this.lockNotAvailable();
            }
          }
          if (!this.contextStack.length) {
            // Refresh the context document on the page, if it is not a pushed
            // special case with its own rendering, like the palette
            await this.refresh();
          }
        }
      } catch (e) {
        if (e.status === 404) {
          // TODO don't get this far, check this in advance and disable it in the UI
          await apos.alert({
            heading: 'apostrophe:doesNotExistYet',
            description: 'apostrophe:doesNotExistYetDescription'
          });
        } else {
          await apos.alert({
            heading: 'apostrophe:error',
            description: 'apostrophe:unableToSwitchModes'
          });
        }
      }
      this.rememberLastBaseContext();
    },
    onContextEdited(patch) {
      patch = klona(patch);
      this.patchesSinceLoaded.push(patch);
      this.patchesSinceSave.push(patch);
      this.undone = [];
      if (!this.saving) {
        this.save();
      }
    },
    async onContentChanged(e) {
      if (e.doc && (e.doc._id === this.context._id)) {
        if (e.action === 'delete') {
          if (!this.contextStack.length) {
            // With the current page gone, we need to move to safe ground
            location.assign(`${window.apos.prefix}/`);
          }
        } else {
          this.context = await apos.http.get(`${this.action}/${this.context._id}`, {
            busy: true
          });
        }
      }
      await this.refresh({
        scrollcheck: e.action === 'history'
      });
    },
    async switchEditMode(editing) {
      this.editMode = editing;
      if (editing) {
        if (!await this.lock(`${this.action}/${this.context._id}`)) {
          this.lockNotAvailable();
          return;
        }
      }
      if (this.draftMode !== 'draft') {
        // Entering edit mode implies entering draft mode and
        // a refresh.
        await this.switchDraftMode('draft');
      } else {
        await this.refresh();
      }
    },
    async refresh(options = {}) {
      let url = window.location.href;
      const qs = {
        ...apos.http.parseQuery(window.location.search),
        aposRefresh: '1',
        aposMode: this.draftMode,
        ...(this.editMode ? {
          aposEdit: '1'
        } : {})
      };
      url = apos.http.addQueryToUrl(url, qs);
      const content = await apos.http.get(url, {
        qs,
        headers: {
          'Cache-Control': 'no-cache'
        },
        draft: true,
        busy: true
      });
      const refreshable = document.querySelector('[data-apos-refreshable]');

      if (options.scrollcheck) {
        window.apos.adminBar.scrollPosition = {
          x: window.scrollX,
          y: window.scrollY
        };
      }

      if (refreshable) {
        refreshable.innerHTML = content;
        if (this.editMode && (!this.original)) {
          // the first time we enter edit mode on the page, we need to
          // establish a baseline for undo/redo. Use our
          // "@ notation" PATCH feature. Sort the areas by DOM depth
          // to ensure parents patch before children
          this.original = {};
          const els = Array.from(document.querySelectorAll('[data-apos-area-newly-editable]')).filter(el => el.getAttribute('data-doc-id') === this.context._id);
          els.sort((a, b) => {
            const da = depth(a);
            const db = depth(b);
            if (da < db) {
              return -1;
            } else if (db > da) {
              return 1;
            } else {
              return 0;
            }
          });
          for (const el of els) {
            const data = JSON.parse(el.getAttribute('data'));
            this.original[`@${data._id}`] = data;
          }
        }
      }
      apos.bus.$emit('refreshed');
      this.rememberLastBaseContext();
    },
    async onDismissSubmission() {
      if (await this.dismissSubmission(this.context)) {
        this.context = {
          ...this.context,
          submitted: null
        };
      }
    },
    async onRevertPublishedToPrevious(data) {
      try {
        const response = await apos.http.post(`${data.action}/${data._id}/revert-published-to-previous`, {
          body: {},
          busy: true
        });
        apos.notify('apostrophe:restoredPrevious', {
          type: 'success',
          dismiss: true
        });
        // This handler covers the modals too, so make sure it's
        // for the context document before altering any admin bar state
        // because of it
        if (data._id.replace(/:.*$/, '') === (this.context._id.replace(/:.*$/, ''))) {
          this.context = {
            ...this.context,
            modified: true,
            // If lastPublishedAt isn't present use a reasonable fallback, as
            // there can be published documents that never went through the
            // published API (parked pages not published since, etc)
            lastPublishedAt: response && (response.lastPublishedAt || response.updatedAt)
          };
          // No refresh is needed here because we're still in draft mode
          // looking at the draft mode, and the thing that changed is the
          // published mode
        }
      } catch (e) {
        await apos.alert({
          heading: this.$t('apostrophe:error'),
          description: e.message || this.$t('apostrophe:errorWhileRestoring'),
          localize: false
        });
      }
    },
    async onUnpublish(data) {
      try {
        await apos.http.post(`${data.action}/${data._id}/unpublish`, {
          body: {},
          busy: true
        });
        apos.notify('apostrophe:noLongerPublished', {
          type: 'success',
          dismiss: true
        });
        // This handler covers the modals too, so make sure it's
        // for the context document before altering any admin bar state
        // because of it
        if (data._id.replace(/:.*$/, '') === (this.context._id.replace(/:.*$/, ''))) {
          this.context = {
            ...this.context,
            modified: true,
            lastPublishedAt: null
          };
          // No refresh is needed here because we're still in draft mode
          // looking at the draft mode, and the thing that changed is the
          // published mode
        }
      } catch (e) {
        await apos.alert({
          heading: this.$t('apostrophe:error'),
          description: e.message || this.$t('apostrophe:errorWhileUnpublishing'),
          localize: false
        });
      }
    },
    async undo() {
      this.undone.push(this.patchesSinceLoaded.pop());
      await this.refreshAfterHistoryChange('apostrophe:undoFailed');
    },
    async redo() {
      this.patchesSinceLoaded.push(this.undone.pop());
      await this.refreshAfterHistoryChange('apostrophe:redoFailed');
    },
    async refreshAfterHistoryChange(errorMessageKey) {
      this.saving = true;
      try {
        const updated = await apos.http.patch(`${this.action}/${this.context._id}`, {
          body: {
            _patches: [
              this.original,
              ...this.patchesSinceLoaded
            ]
          },
          busy: true
        });
        if (!this.contextStack.length) {
          await this.refresh({
            scrollcheck: true
          });
        } else {
          apos.bus.$emit('content-changed', {
            doc: updated,
            action: 'history'
          });
        }
      } catch (e) {
        console.error(e);
        apos.notify(errorMessageKey, { type: 'error' });
      } finally {
        this.saving = false;
      }
    },
    // returns true if the browser is about to navigate away
    async refreshOrReload(url) {
      if (this.urlDiffers(url)) {
        // Slug changed, must navigate
        window.location.assign(url);
        return true;
      } else {
        // No URL change means we can refresh just the content area
        await this.refresh();
        return false;
      }
    },
    urlDiffers(url) {
      // URL might or might not include hostname part
      url = url.replace(/^https?:\/\/.*?\//, '/');
      if (url === (window.location.pathname + (window.location.search || ''))) {
        return false;
      } else {
        return true;
      }
    },
    lockNotAvailable() {
      if (this.contextStack.length) {
        // If we try to edit palette and someone else has it locked,
        // we should just revert to the page context. Ask the palette
        // (or similar tool) to close itself, including popping the context
        apos.bus.$emit('context-close', this.context);
      } else {
        // If the context is the page, we should stay, but in preview mode
        this.switchEditMode(false);
      }
    },
    async updateDraftIsEditable() {
      if (this.context.aposLocale && this.context.aposLocale.endsWith('published') && !this.context._edit) {
        // A contributor might be able to edit the draft
        const draftContext = await apos.http.get(`${this.action}/${this.context._id}`, {
          busy: true,
          qs: {
            aposMode: 'draft',
            aposLocale: this.context.aposLocale.split(':')[0]
          }
        });
        this.draftIsEditable = draftContext && draftContext._edit;
      }
    },
    async getPublished() {
      const moduleOptions = window.apos.modules[this.context.type];
      const manuallyPublished = moduleOptions.localized && !moduleOptions.autopublish;
      if (manuallyPublished && this.context.lastPublishedAt) {
        const action = window.apos.modules[this.context.type].action;
        const doc = await apos.http.get(`${action}/${this.context._id}`, {
          busy: true,
          qs: {
            aposMode: 'published'
          }
        });
        return doc;
      }
      return null;
    },
    rememberLastBaseContext() {
      sessionStorage.setItem('aposLastBaseContext', JSON.stringify({
        aposDocId: this.context.aposDocId,
        draftMode: this.draftMode,
        editMode: this.editMode
      }));
    }
  }
};

function depth(el) {
  let depth = 0;
  while (el) {
    el = el.parentNode;
    depth++;
  }
  return depth;
}
</script>
<style lang="scss" scoped>
.apos-admin-bar__row--utils {
  display: flex;
  align-items: center;
}
</style>
