<template>
  <div :class="classes">
    <template v-if="contextBarActive">
      <div class="apos-admin-bar__control-group">
        <TheAposContextUndoRedo
          :v-if="editMode"
          :can-undo="canUndo"
          :can-redo="canRedo"
          @undo="undo"
          @redo="redo"
        />
        <TheAposContextBreakpointPreviewMode
          v-if="isBreakpointPreviewModeEnabled"
          :screens="breakpointPreviewModeScreens"
          :resizable="breakpointPreviewModeResizable"
          @switch-breakpoint-preview-mode="addContextLabel"
          @reset-breakpoint-preview-mode="removeContextLabel"
        />
        <TheAposSavingIndicator
          :key="'status'"
          :retrying="retrying"
          :editing="editing"
          :saving="saving"
          :saved="saved"
        />
      </div>

      <TheAposContextTitle
        v-if="!hasCustomUi"
        class="apos-admin-bar__control-group"
        :context="context"
        :draft-mode="draftMode"
        @switch-draft-mode="switchDraftMode"
      />
      <TheAposCollabPresence v-if="collabActive" />
      <TheAposContextModeAndSettings
        class="apos-admin-bar__control-group"
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
import { mapState } from 'pinia';
import { markRaw } from 'vue';
import { klona } from 'klona';
import { createId } from 'apostrophe/lib/beneath.js';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { isWithoutHistory, isWithoutSaving } from 'Modules/@apostrophecms/admin-bar/lib/history.js';
import { replay, html } from 'Modules/@apostrophecms/rich-text-widget/lib/context-history.js';
import * as editorRegistry from 'Modules/@apostrophecms/rich-text-widget/lib/editor-registry.js';
import { useNotificationStore } from 'Modules/@apostrophecms/ui/stores/notification';
import { useCollabStore } from 'Modules/@apostrophecms/collab/stores/collab.js';
import CollabSession from 'Modules/@apostrophecms/collab/lib/session.js';

// Undo history deeper than this is forgotten, oldest first
const maxHistory = 500;

// The key of a patch that does nothing but set one value, as opposed to one
// that operates on a list, such as `$push`
function singleValueKey(patch) {
  const keys = Object.keys(patch);
  return ((keys.length === 1) && !keys[0].startsWith('$')) ? keys[0] : null;
}

// The keys of an entry for the undo history, as opposed to a bare patch,
// which is what `context-edited` was given before undo could be done
// without replaying every edit since the page was loaded.
//
// `patch` and `inverse` may also be arrays of patches, applied in order.
// `inverses` then optionally says what takes back each patch of `patch`,
// for the collaboration session
const entryKeys = [ 'patch', 'inverse', 'inverses', 'target' ];

function toList(patch) {
  return Array.isArray(patch) ? patch : [ patch ];
}

export default {
  name: 'TheAposContextBar',
  mixins: [ AposPublishMixin, AposAdvisoryLockMixin ],
  emits: [ 'visibility-changed' ],
  data() {
    const query = apos.http.parseQuery(location.search);
    // If the URL references a draft, go into draft mode but then clean up the
    // URL
    const draftMode = query.aposMode || 'published';
    if (draftMode === 'draft') {
      const newQuery = { ...query };
      delete newQuery.aposMode;
      history.replaceState(null, '', apos.http.addQueryToUrl(location.href, newQuery));
    }
    return {
      // The undo history: one entry per action, see `onContextEdited` and
      // `onContextHistoryRecord`
      patchesSinceLoaded: [],
      undone: [],
      // Forward patches of entries forgotten from the bottom of the history,
      // still needed to replay it from `original` (see
      // `refreshAfterHistoryChange`)
      committedPatches: [],
      // The entry the next edit may still be merged into, if it is part of
      // the same burst of typing
      mergeableEntryId: null,
      nextEntryId: 1,
      historyBusy: false,
      savePromise: null,
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
      context: window.apos.adminBar.context
        ? {
          ...window.apos.adminBar.context
        }
        : {},
      contextStack: [],
      // If a published context doc itself is not editable this will contain a
      // hint that the draft version is editable, when appropriate. It should
      // only be consulted when the context doc is published and not editable
      draftIsEditable: false,
      // The id of the document the collaboration session is for, when
      // several people may edit it at once, see `updateCollabSession`
      collabDocId: null,
      // Whether the session has anything of ours not yet saved
      collabPending: false,
      collabRefreshing: false,
      collabRefreshAgain: false
    };
  },
  computed: {
    ...mapState(useModalStore, [ 'hasChooserModal' ]),
    ...mapState(useWidgetStore, [ 'focusedWidget' ]),
    // True if several people may edit the context document at once
    collaborative() {
      return !!apos.modules[this.context.type]?.collaborative &&
        (!this.context.aposMode || (this.context.aposMode === 'draft'));
    },
    collabActive() {
      return !!this.collabDocId;
    },
    contextBarActive() {
      return window.apos.adminBar.contextBar &&
        (this.canEdit || this.moduleOptions.canLocalize);
    },
    canEdit() {
      return this.context._edit || ((this.context.aposLocale && this.context.aposLocale.endsWith(':published')) &&
        this.draftIsEditable);
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
      return !!this.patchesSinceSave.length || this.collabPending;
    },
    canPublish() {
      return this.context._publish || apos.modules[this.context.type].canPublish;
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
    },
    canUndo() {
      return this.patchesSinceLoaded.length > 0;
    },
    canRedo() {
      return this.undone.length > 0;
    },
    autopublish() {
      return this.context.autopublish ?? this.moduleOptions.autopublish;
    },
    isBreakpointPreviewModeEnabled() {
      return this.moduleOptions.breakpointPreviewMode.enable || false;
    },
    breakpointPreviewModeScreens() {
      return this.moduleOptions.breakpointPreviewMode.screens || {};
    },
    breakpointPreviewModeResizable() {
      return this.moduleOptions.breakpointPreviewMode.resizable || false;
    }
  },
  watch: {
    editMode(newVal) {
      window.apos.adminBar.editMode = newVal;
    },
    contextBarActive() {
      this.$nextTick(() => {
        this.$emit('visibility-changed');
      });
    },
    // Let everyone else editing see which widget we are working on
    focusedWidget(widgetId) {
      this.collabSession()?.setAwareness(widgetId ? { widgetId } : {});
    }
  },
  async mounted() {
    apos.bus.$on('revert-published-to-previous', this.onRevertPublishedToPrevious);
    apos.bus.$on('set-context', this.onSetContext);
    apos.bus.$on('push-context', this.onPushContext);
    apos.bus.$on('pop-context', this.onPopContext);
    apos.bus.$on('context-editing', this.onContextEditing);
    apos.bus.$on('context-edited', this.onContextEdited);
    apos.bus.$on('context-history-record', this.onContextHistoryRecord);
    apos.bus.$on('content-changed', this.onContentChanged);

    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('storage', this.onStorage);

    // sessionStorage because it is deliberately browser-tab specific
    let tabId = sessionStorage.getItem('aposTabId');
    if (!tabId) {
      tabId = createId();
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
    // document (`doc`). Navigates to `doc._url` if it differs from the
    // browser's current URL in the new mode, whether it is the current context
    // doc or not.
    //
    // Accepts `mode`, `locale` and `doc` properties in its options object.
    // Whether the mode and locale are changing or not, if the `_url` of `doc`
    // in the final mode and locale does not match the current URL, navigate to
    // it. `doc` becomes the new context doc if it is not already.
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
    // TODO: locales are not fully implemented in the UI yet. They are
    // considered in this API to reduce bc breaks in forthcoming betas.
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
      await this.stopCollabSession({ save: true });
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
        undone: this.undone,
        committedPatches: this.committedPatches
      });
      this.original = klona(doc);
      this.patchesSinceLoaded = [];
      this.undone = [];
      this.committedPatches = [];
      this.mergeableEntryId = null;
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
      this.committedPatches = layer.committedPatches;
      this.mergeableEntryId = null;
      await this.setContext({
        doc: layer.doc
      });
      // So that areas revert to being editable
      await this.refresh();
    },
    // Accept a hint that a user is actively typing and/or manipulating controls
    // and it would best not to enable a save button or a "...Saved" indication
    // yet to avoid a frenetic display and/or a situation where not everything
    // is ready to be saved yet.
    //
    // If the event is emitted with a boolean value of `true`, the emitter takes
    // responsibility for later emitting `false` to indicate active
    // typing/manipulating is no longer in progress. If the event is emitted
    // with no value then there is a 1100-millisecond, debounced timeout.

    async onContextEditing(state) {
      if ((typeof state) === 'boolean') {
        this.editing = state;
      } else {
        if (!this.editing) {
          this.editing = true;
        }
        if (this.editingTimeout) {
          clearTimeout(this.editingTimeout);
        }
        this.editingTimeout = setTimeout(() => {
          this.editing = false;
          // Wait slightly longer than the rich text editor does
          // before sending us a context-edited event
        }, 1100);
      }
    },
    async onPublish() {
      // Everything we typed must be saved first. The server asks everyone
      // else to save theirs
      await this.collabSession()?.flush();
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
      if (
        this.patchesSinceSave.length ||
        this.saving ||
        this.editing ||
        this.collabPending
      ) {
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
          if ((e.status >= 400) && (e.status < 500)) {
            // The server refused this change and will refuse it again, so
            // retrying would spin forever with nothing to show for it. Say
            // so, and let whatever else is waiting through
            // eslint-disable-next-line no-console
            console.error(e);
            apos.notify('apostrophe:changeNotSaved', {
              type: 'error',
              icon: 'alert-circle-icon'
            });
            continue;
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
      if (!doc) {
        return;
      }

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
            await this.updateCollabSession();
          }
        } else {
          if (this.editMode) {
            if (!await this.lock(`${this.action}/${this.context._id}`)) {
              this.lockNotAvailable();
            }
          }
          await this.updateCollabSession();
          if (!this.contextStack.length) {
            // Refresh the context document on the page, if it is not a pushed
            // special case with its own rendering, like the palette
            await this.refresh();
          }
        }
      } catch (e) {
        if (e.status === 404) {
          // TODO don't get this far, check this in advance and disable it in
          // the UI
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
    // An edit to the context document. Accepts `{ patch, inverse, target }`:
    // the patch to save, the patch that takes it back, and a description of
    // what was edited, so that undoing it can show the user where. See
    // `showTarget` for the properties of `target`.
    //
    // A bare patch is accepted too, as it was before. Such an edit can
    // still be undone, but only the old way: by replaying every edit since
    // the page was loaded and rendering the page again.
    onContextEdited(payload) {
      if (isWithoutSaving()) {
        // Text the collaboration session saves as it is typed
        return;
      }
      const isEntry = !!payload?.patch &&
        (typeof payload.patch === 'object') &&
        Object.keys(payload).every(key => entryKeys.includes(key));
      const patch = klona(isEntry ? payload.patch : payload);
      const inverse = (isEntry && payload.inverse) ? klona(payload.inverse) : null;
      const target = (isEntry && payload.target) ? { ...payload.target } : null;
      const inverses = (isEntry && payload.inverses) ? klona(payload.inverses) : null;
      if (isWithoutHistory()) {
        // A change to save that is not an action of the user's to undo:
        // typing its editor already recorded step by step
        // (`onContextHistoryRecord`), or content an editor provisioned for
        // itself. Nothing to add to the history, and nothing about to be
        // redone was overwritten
        this.queuePatch(patch, {
          inverse,
          inverses,
          target
        });
        return;
      }
      const entry = {
        id: this.nextEntryId++,
        patch,
        inverse,
        target
      };
      const top = this.patchesSinceLoaded.at(-1);
      if (
        this.editing &&
        entry.inverse &&
        (entry.target?.kind === 'field') &&
        top &&
        (top.id === this.mergeableEntryId) &&
        (top.target?.docId === entry.target.docId) &&
        (top.target?.patchKey === entry.target.patchKey)
      ) {
        // The user is still typing in the same field, and saving what they
        // have so far. Undo takes back the whole burst, so keep the inverse
        // from before it started
        top.patch = entry.patch;
      } else {
        this.pushEntry(entry);
        this.mergeableEntryId = (entry.target?.kind === 'field') ? entry.id : null;
      }
      this.undone = [];
      this.queuePatch(patch, {
        inverse: entry.inverse,
        inverses,
        target: entry.target
      });
    },
    // What a rich text editor on the page did, as ProseMirror steps. The
    // editor saves the result by itself, see `isWithoutHistory`. Records that
    // continue the same typing are merged into one entry, as tiptap's own
    // history would group them
    //
    // When several people edit the document at once, the editor keeps the
    // steps itself, in a history that knows how to rebase them over everyone
    // else's typing, and the record just says which editor to ask: see
    // `collab` in `applyHistoryChange`
    onContextHistoryRecord(record) {
      const top = this.patchesSinceLoaded.at(-1);
      if (record.collab) {
        if (
          !record.newGroup &&
          top?.richText?.collab &&
          (top.id === this.mergeableEntryId) &&
          (top.richText.instanceKey === record.instanceKey)
        ) {
          return;
        }
        const entry = {
          id: this.nextEntryId++,
          richText: markRaw({
            collab: true,
            instanceKey: record.instanceKey,
            target: record.target
          }),
          target: {
            kind: 'richText',
            patchKey: record.target,
            widgetId: record.target?.match(/^@([^.]+)\./)?.[1]
          }
        };
        this.pushEntry(entry);
        this.mergeableEntryId = entry.id;
        this.undone = [];
        return;
      }
      if (
        !record.newGroup &&
        top?.richText &&
        (top.id === this.mergeableEntryId) &&
        (top.richText.instanceKey === record.instanceKey)
      ) {
        const richText = top.richText;
        richText.steps.push(...record.steps);
        richText.inverses.push(...record.inverses);
        richText.docAfter = record.docAfter;
        richText.selectionAfter = record.selectionAfter;
      } else {
        const entry = {
          id: this.nextEntryId++,
          // Documents and steps are immutable, and would only be slowed
          // down by reactivity
          richText: markRaw({
            ...record,
            steps: [ ...record.steps ],
            inverses: [ ...record.inverses ]
          }),
          target: {
            kind: 'richText',
            patchKey: record.target,
            widgetId: record.target?.match(/^@([^.]+)\./)?.[1]
          }
        };
        this.pushEntry(entry);
        this.mergeableEntryId = entry.id;
      }
      this.undone = [];
    },
    pushEntry(entry) {
      this.patchesSinceLoaded.push(entry);
      if (this.patchesSinceLoaded.length > maxHistory) {
        const forgotten = this.patchesSinceLoaded.shift();
        const patch = !forgotten.richText?.collab && this.forwardPatch(forgotten);
        if (patch) {
          this.commitPatch(patch);
        }
      }
    },
    // Remember what an edge too old to be undone did, so that the document
    // can still be rebuilt from `original` if an edit that has no inverse
    // has to be undone the old way
    commitPatch(patch) {
      const key = singleValueKey(patch);
      if (key) {
        // Setting a value outright makes every earlier setting of the same
        // value beside the point. Without this the list would grow by one
        // for every burst of typing in a long session
        this.committedPatches = this.committedPatches
          .filter(existing => singleValueKey(existing) !== key);
      }
      this.committedPatches.push(patch);
    },
    // The patch that makes the edit in `entry`
    forwardPatch(entry) {
      if (entry.richText) {
        return entry.richText.target
          ? { [entry.richText.target]: html(entry.richText, 'redo') }
          : null;
      }
      return entry.patch;
    },
    // Save `patch`, or each patch of an array of them. `inverse`,
    // `inverses` and `target` are needed only when several people edit the
    // document at once, see `CollabSession`
    queuePatch(patch, {
      inverse = null, inverses = null, target = null
    } = {}) {
      const session = this.collabSession();
      if (session) {
        const patches = toList(patch);
        patches.forEach((patch, i) => {
          session.queuePatch(patch, {
            // A lone patch's inverse is the inverse. For several, only
            // `inverses` can say which goes with which
            inverses: inverses?.[i] ||
              ((patches.length === 1) && inverse ? toList(inverse) : null),
            target
          });
        });
        return;
      }
      this.patchesSinceSave.push(...toList(patch));
      if (!this.saving) {
        this.savePromise = this.save();
      }
    },
    // Resolves once everything queued so far has been saved
    async flushSaves() {
      const session = this.collabSession();
      if (session) {
        await session.flush();
        return;
      }
      if (this.patchesSinceSave.length && !this.saving) {
        this.savePromise = this.save();
      }
      await this.savePromise;
    },
    async onContentChanged(e) {
      if (this.hasChooserModal) {
        return;
      }

      if (
        (e.doc && (e.doc._id === this.context._id)) ||
        (e.docIds && e.docIds.includes(this.context._id))
      ) {
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

      // Check that refresh hasn't been disabled for this page type
      const contextOptions = this.context
        ? apos.modules[this.context.type]
        : { contentChangedRefresh: true };
      if (!e.localeSwitched && contextOptions.contentChangedRefresh) {
        await this.refresh({
          scrollcheck: e.action === 'history'
        });
      }
    },
    async switchEditMode(editing) {
      this.editMode = editing;
      if (editing) {
        if (!await this.lock(`${this.action}/${this.context._id}`)) {
          this.lockNotAvailable();
          return;
        }
      }
      await this.updateCollabSession();
      if (this.draftMode !== 'draft') {
        // Entering edit mode implies entering draft mode and
        // a refresh.
        await this.switchDraftMode('draft');
      } else {
        await this.refresh();
      }
    },
    async refresh(options = {}) {
      // Rendering the page again replaces every editor on it, so whatever
      // was typed and not yet sent must go first
      await this.collabSession()?.flush();
      // In breakpoint preview mode, uses the fake body.
      const refreshable = document.querySelector('[data-apos-refreshable-body]') ||
        document.querySelector('[data-apos-refreshable]');
      if (options.scrollcheck) {
        window.apos.adminBar.scrollPosition = {
          x: window.scrollX,
          y: window.scrollY
        };
      }

      if (!refreshable) {
        apos.bus.$emit('refreshed');
        this.rememberLastBaseContext();
        return;
      }
      const { action } = window.apos.modules[this.context.type];
      let doc;
      try {
        doc = await apos.http.get(`${action}/${this.context.aposDocId}`, {
          qs: {
            aposMode: this.draftMode,
            aposLocale: apos.i18n.locale,
            project: { _url: 1 }
          }
        });
      } catch (err) {
        return;
      }

      if (this.urlDiffers(doc._url)) {
        // Slug changed, change browser URL to reflect the actual url of the doc
        doc._url = doc._url + (window.location.search || '');
        history.replaceState(null, '', doc._url);
      } else {
        // No genuine slug change, e.g. the current path is just the
        // context doc's canonical URL with extra path segments appended
        // (piecesFilters paths generated by `static: true`). Fetch
        // content from the actual current browser URL rather than the
        // bare doc._url, otherwise any filter path segments and query
        // string driving the current view would be lost and we'd render
        // the unfiltered index instead.
        doc._url = window.location.pathname + window.location.search;
      }

      const qs = {
        ...apos.http.parseQuery(window.location.search),
        aposRefresh: '1',
        aposMode: this.draftMode,
        ...(this.editMode
          ? {
            aposEdit: '1'
          }
          : {})
      };

      if (doc._url) {
        refreshable.innerHTML = await apos.http.get(doc._url, {
          qs,
          headers: {
            'Cache-Control': 'no-cache'
          },
          draft: true,
          busy: true,
          prefix: false
        });
      }

      if (this.editMode && (!this.original)) {
        // the first time we enter edit mode on the page, we need to
        // establish a baseline for undo/redo. Use our
        // "@ notation" PATCH feature. Sort the areas by DOM depth
        // to ensure parents patch before children
        this.original = {};
        const els = Array.from(document.querySelectorAll('[data-apos-area-newly-editable]'))
          .filter(el => el.getAttribute('data-doc-id') === this.context._id);
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
        await apos.notify('apostrophe:restoredPrevious', {
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
    async undo() {
      if (!this.canUndo || this.historyBusy) {
        return;
      }
      const entry = this.patchesSinceLoaded.at(-1);
      if (this.collabActive && !this.isReversible(entry)) {
        // Replaying every edit since the page was loaded would take back
        // everyone else's work too, so this one cannot be undone
        this.patchesSinceLoaded.pop();
        return this.undo();
      }
      if (!this.isReversible(entry)) {
        this.undone.push(this.patchesSinceLoaded.pop());
        return this.refreshAfterHistoryChange('apostrophe:undoFailed');
      }
      if (await this.applyHistoryChange(entry, 'undo', 'apostrophe:undoFailed')) {
        this.undone.push(this.patchesSinceLoaded.pop());
      }
    },
    async redo() {
      if (!this.canRedo || this.historyBusy) {
        return;
      }
      const entry = this.undone.at(-1);
      if (this.collabActive && !this.isReversible(entry)) {
        this.undone.pop();
        return this.redo();
      }
      if (!this.isReversible(entry)) {
        this.patchesSinceLoaded.push(this.undone.pop());
        return this.refreshAfterHistoryChange('apostrophe:redoFailed');
      }
      if (await this.applyHistoryChange(entry, 'redo', 'apostrophe:redoFailed')) {
        this.patchesSinceLoaded.push(this.undone.pop());
      }
    },
    isReversible(entry) {
      return !!(entry.richText || entry.inverse);
    },
    // Undo or redo `entry` in place: change what is on the page, and save
    // the change just like any other edit. Nothing else on the page is
    // rendered again. Resolves to true if the change was made
    async applyHistoryChange(entry, direction, errorMessageKey) {
      this.historyBusy = true;
      // Whatever is typed next starts an entry of its own
      this.mergeableEntryId = null;
      try {
        let patch;
        if (entry.richText?.collab) {
          // The editor's own history takes back our typing and nobody
          // else's. If the editor is gone, so is the typing
          const richText = entry.richText;
          const editor = editorRegistry.find(richText.instanceKey, richText.target);
          if (!editor?.collabHistory) {
            return true;
          }
          editor.collabHistory(direction);
          return true;
        }
        if (entry.richText) {
          const richText = entry.richText;
          const editor = editorRegistry.find(richText.instanceKey, richText.target);
          if (editor) {
            // The editor shows the change and saves it, as it does typing.
            // ProseMirror scrolls to the change itself
            replay(editor.editor, richText, direction);
            editor.flush();
            editor.editor.view.focus();
            return true;
          }
          // The editor is gone, so patch its value like any other
          if (!richText.target) {
            throw new Error('A rich text editor recorded history without a historyTarget, and is no longer on the page');
          }
          patch = {
            [richText.target]: html(richText, direction)
          };
        } else {
          patch = klona((direction === 'undo') ? entry.inverse : entry.patch);
        }
        const removed = [];
        let shown = true;
        // Only needed when others may be editing too, see `CollabSession`
        const inverses = [];
        for (const each of toList(patch)) {
          const result = this.applyToPageWithInverses(each, removed);
          shown = result.claimed && shown;
          inverses.push(result.inverses);
        }
        // Putting this edit back means putting back what was just taken off
        // the page, which is not always what the edit itself added: a widget
        // can have gained content since, as a layout does when it fills
        // itself with columns
        const opposite = (direction === 'undo') ? entry.patch : entry.inverse;
        if (!Array.isArray(opposite)) {
          this.refreshRestore(opposite, removed);
        }
        this.queuePatch(patch, {
          inverses,
          target: entry.target
        });
        if (shown) {
          await this.$nextTick();
          this.showTarget(entry.target);
        } else if (this.collabActive) {
          // Rendering the whole document again would throw away what others
          // are in the middle of, and the change is saved all the same
        } else {
          // Nothing on the page claimed it, so render the whole document
          // again, as undo always used to
          await this.flushSaves();
          await this.showWholeDocument();
        }
        return true;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        apos.notify(errorMessageKey, { type: 'error' });
        return false;
      } finally {
        this.historyBusy = false;
      }
    },
    // Ask whatever on the page holds the content `patch` touches, such as an
    // area editor or a field edited in place, to show the change. Returns
    // true if something did
    applyToPage(patch, removed = []) {
      let claimed = false;
      apos.bus.$emit('context-history-apply', {
        patch,
        removed,
        claim() {
          claimed = true;
        }
      });
      return claimed;
    },
    // As `applyToPage`, for the collaboration session, which also needs to
    // know how to take the patch back again: resolves to `{ claimed,
    // inverses }`, see `invert` in `apply-patch.js`
    applyToPageWithInverses(patch, removed = []) {
      let claimed = false;
      const inverses = [];
      apos.bus.$emit('context-history-apply', {
        patch,
        removed,
        inverses,
        claim() {
          claimed = true;
        }
      });
      return {
        claimed,
        inverses
      };
    },
    // Bring the patch that puts these widgets back up to date with what they
    // held when they were taken away
    refreshRestore(patch, removed) {
      if (!removed.length || !patch?.$push) {
        return;
      }
      const push = Object.values(patch.$push)[0];
      if (!push?.$each?.length) {
        return;
      }
      push.$each = push.$each.map(widget => {
        const captured = removed.find(item => item._id === widget._id);
        return captured ? klona(captured) : widget;
      });
    },
    // Scroll to what an undo or redo just changed, if it is not on screen,
    // and point it out. `target` may have `patchKey`, the field edited in
    // place; `widgetId`, the widget edited; and `anchorId`, a neighboring
    // widget to fall back on when the widget itself is no longer there
    showTarget(target) {
      if (!target) {
        return;
      }
      const selectors = [];
      if (target.patchKey) {
        selectors.push(`[data-apos-wysiwyg-field-editable][data-patch-key="${CSS.escape(target.patchKey)}"]`);
      }
      for (const id of [ target.widgetId, target.anchorId ]) {
        if (id) {
          selectors.push(`[data-apos-widget-id="${CSS.escape(id)}"]`);
        }
      }
      const widgetStore = useWidgetStore();
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          if (!widgetStore.isElementInView(el)) {
            widgetStore.scrollToElement(el);
          }
          widgetStore.flashElement(el);
          return;
        }
      }
    },
    async showWholeDocument() {
      if (!this.contextStack.length) {
        await this.refresh({
          scrollcheck: true
        });
      } else {
        apos.bus.$emit('content-changed', {
          doc: this.context,
          action: 'history'
        });
      }
    },
    // The way undo worked before edits came with their inverses, still
    // needed for an edit without one: replay every edit since the page was
    // loaded, then render the page again
    async refreshAfterHistoryChange(errorMessageKey) {
      this.historyBusy = true;
      this.mergeableEntryId = null;
      try {
        // An autosave arriving after the replay would undo the undo
        await this.flushSaves();
        this.saving = true;
        this.context = await apos.http.patch(`${this.action}/${this.context._id}`, {
          body: {
            _patches: [
              this.original,
              ...this.committedPatches,
              ...this.patchesSinceLoaded
                .map(entry => this.forwardPatch(entry))
                .filter(Boolean)
            ]
          },
          busy: true
        });
        this.saving = false;
        await this.showWholeDocument();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        apos.notify(errorMessageKey, { type: 'error' });
      } finally {
        this.saving = false;
        this.historyBusy = false;
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
      if (!url) {
        return false;
      }

      const normalizedUrl = url.replace(/^https?:\/\/[^/]+\//, '/');
      const currentPageUrl = window.location.pathname + window.location.search;

      if (normalizedUrl === currentPageUrl) {
        return false;
      }

      // The context doc's canonical URL may be a path prefix of the
      // current page's path (e.g. context doc is `/blog` and we're
      // viewing a piecesFilters path like `/blog/categories/events`,
      // generated when the piece-index module is configured with
      // `static: true`). That's not a slug change, just additional path
      // segments appended by the page itself, so don't treat it as a
      // difference requiring reconciliation. We don't require matching
      // the entire path, just the segment boundary, and we exclude the
      // root path ("/") from this check since virtually every path is
      // "under" it.
      const normalizedPath = normalizedUrl.split('?')[0];
      const currentPath = window.location.pathname;
      if (normalizedPath !== '/' && currentPath.startsWith(`${normalizedPath}/`)) {
        return false;
      }

      return true;
    },
    lockNotAvailable() {
      this.stopCollabSession();
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
    // The collaboration session, if several people may be editing the
    // context document right now
    collabSession() {
      const session = useCollabStore().session;
      return (session && (session.docId === this.context._id)) ? session : null;
    },
    // Start or stop the collaboration session to suit the context document
    // and whether we are editing it
    async updateCollabSession() {
      const wanted = this.editMode && this.collaborative && this.canEdit
        ? this.context._id
        : null;
      if (this.collabDocId === wanted) {
        return;
      }
      await this.stopCollabSession({ save: true });
      if (!wanted) {
        return;
      }
      const store = useCollabStore();
      const notificationStore = useNotificationStore();
      const session = new CollabSession({
        docId: wanted,
        tabId: window.apos.adminBar.tabId,
        action: apos.modules['@apostrophecms/collab'].action,
        http: apos.http,
        bus: apos.bus,
        channels: {
          subscribe: channel => notificationStore.subscribeChannel(channel),
          unsubscribe: channel => notificationStore.unsubscribeChannel(channel)
        },
        applyToPage: patch => this.applyToPageWithInverses(patch),
        callbacks: {
          onContext: doc => {
            if (doc._id === this.context._id) {
              this.context = doc;
            }
          },
          onStatus: ({ busy, pending }) => {
            this.collabPending = pending;
            this.saving = busy;
            if (!busy) {
              this.saved = true;
            }
          },
          onRefused: (e) => {
            // eslint-disable-next-line no-console
            console.error(e);
            apos.notify('apostrophe:changeNotSaved', {
              type: 'error',
              icon: 'alert-circle-icon'
            });
          },
          onFatal: () => this.lockNotAvailable(),
          onRefresh: () => this.collabRefresh(),
          onRemotePatches: data => this.onRemotePatches(data),
          // The text shows the change itself, see `AposRichTextEditor`, but
          // it is still what that person did last
          onRemoteText: data => store.recordAction(data, {
            patchKey: data.batch.key,
            widgetId: data.batch.key.match(/^@([^.]+)\./)?.[1],
            quiet: true
          }),
          onPresence: data => store.onPresence(data),
          onPublished: async data => {
            this.context = {
              ...this.context,
              modified: false,
              lastPublishedAt: data.lastPublishedAt
            };
            this.published = await this.getPublished();
          },
          onAwareness: data => store.onAwareness(data)
        }
      });
      store.setSession(session);
      this.collabDocId = wanted;
      await session.start();
      try {
        const { presence } = await apos.http.get(`${session.action}/presence`, {
          qs: { docId: wanted }
        });
        if (this.collabSession() === session) {
          store.setPresence(presence || []);
        }
      } catch (e) {
        // Who else is here shows up as they do something
      }
    },
    // With `save`, send whatever is still waiting to go first. Not when we
    // just lost the right to edit, since the server would refuse it anyway
    async stopCollabSession({ save = false } = {}) {
      const store = useCollabStore();
      const session = store.session;
      if (session) {
        store.setSession(null);
        this.collabDocId = null;
        if (save) {
          try {
            await session.flush();
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
          }
        }
        session.stop();
      }
      this.collabDocId = null;
      this.collabPending = false;
    },
    // Someone else's patches were just applied to the page
    onRemotePatches(data) {
      this.context = {
        ...this.context,
        modified: true
      };
      const store = useCollabStore();
      for (const target of (data.targets || []).filter(Boolean)) {
        store.recordAction(data, target);
      }
      if (!data.targets?.length) {
        store.recordAction(data, {});
      }
    },
    // The document changed in a way that cannot be shown piece by piece:
    // save what we have and render it again
    async collabRefresh() {
      if (this.collabRefreshing) {
        this.collabRefreshAgain = true;
        return;
      }
      this.collabRefreshing = true;
      try {
        do {
          this.collabRefreshAgain = false;
          await this.collabSession()?.flush();
          try {
            this.context = await apos.http.get(`${this.action}/${this.context._id}`, {
              qs: {
                aposMode: 'draft'
              }
            });
          } catch (e) {
            // Keep what we have
          }
          await this.refresh({ scrollcheck: true });
        } while (this.collabRefreshAgain);
      } finally {
        this.collabRefreshing = false;
      }
    },
    async updateDraftIsEditable() {
      if (this.context.aposLocale && this.context.aposLocale.endsWith('published') && !this.context._edit) {
        // A contributor might be able to edit the draft
        try {
          const draftContext = await apos.http.get(`${this.action}/${this.context._id}`, {
            busy: true,
            qs: {
              aposMode: 'draft',
              aposLocale: this.context.aposLocale.split(':')[0]
            }
          });
          this.draftIsEditable = draftContext && draftContext._edit;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
        }
      }
    },
    async getPublished() {
      const moduleOptions = window.apos.modules?.[this.context.type];
      const manuallyPublished = moduleOptions?.localized && !this.autopublish;
      if (manuallyPublished && this.context.lastPublishedAt) {
        const action = window.apos.modules[this.context.type].action;
        try {
          const doc = await apos.http.get(`${action}/${this.context._id}`, {
            busy: true,
            qs: {
              aposMode: 'published'
            }
          });
          return doc;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }
      return null;
    },
    rememberLastBaseContext() {
      sessionStorage.setItem('aposLastBaseContext', JSON.stringify({
        aposDocId: this.context.aposDocId,
        draftMode: this.draftMode,
        editMode: this.editMode
      }));
    },
    addContextLabel({
      label
    }) {
      document.querySelector('[data-apos-context-label]')
        ?.replaceChildren(document.createTextNode(this.$t(label)));
    },
    removeContextLabel() {
      document.querySelector('[data-apos-context-label]')?.replaceChildren();
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
.apos-admin-bar__row--utils,
.apos-admin-bar__control-group {
  display: flex;
  align-items: center;
}

.apos-admin-bar__control-group {
  flex: 1;
  height: 100%;

  .apos-admin-bar__control-set {
    align-items: center;
    width: auto;
  }
}
</style>
