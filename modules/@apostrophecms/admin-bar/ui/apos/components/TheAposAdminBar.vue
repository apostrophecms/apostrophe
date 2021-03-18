<template>
  <div class="apos-admin-bar-wrapper" ref="adminBarOuter">
    <div class="apos-admin-bar-spacer" ref="spacer" />
    <nav class="apos-admin-bar" ref="adminBar">
      <div class="apos-admin-bar__row">
        <AposLogoPadless class="apos-admin-bar__logo" />
        <ul class="apos-admin-bar__items">
          <li class="apos-admin-bar__item" v-if="pageTree">
            <AposButton
              type="subtle" label="Page Tree"
              icon="file-tree-icon" class="apos-admin-bar__btn"
              :modifiers="['no-motion']"
              @click="emitEvent('@apostrophecms/page:manager')"
            />
          </li>
          <li
            v-for="item in menuItems" :key="item.name"
            class="apos-admin-bar__item"
          >
            <AposButton
              v-if="item.options" type="subtle"
              @click="emitEvent(item.action)"
              :label="item.label"
              :modifiers="['no-motion']"
              class="apos-admin-bar__btn"
            />
            <AposContextMenu
              v-else-if="item.items" class="apos-admin-bar__sub"
              :menu="item.items" :button="{
                label: item.label,
                modifiers: ['no-motion'],
                class: 'apos-admin-bar__btn',
                type: 'subtle'
              }"
              @item-clicked="emitEvent"
            />
          </li>
          <li class="apos-admin-bar__item" v-if="createMenu.length > 0">
            <AposContextMenu
              class="apos-admin-bar__create"
              :menu="createMenu"
              :button="{
                label: 'New item',
                iconOnly: true,
                icon: 'plus-icon',
                type: 'primary',
                modifiers: ['round', 'no-motion']
              }"
              @item-clicked="emitEvent"
            />
          </li>
        </ul>
        <TheAposAdminBarUser class="apos-admin-bar__user" />
      </div>
      <!-- Context-dependent row -->
      <div v-if="contextBar" class="apos-admin-bar__row apos-admin-bar__row--utils">
        <transition-group
          tag="div"
          class="apos-admin-bar__control-set apos-admin-bar__control-set--context-controls"
          name="flip"
        >
          <!-- need a tooltip even on a disabled button -->
          <div
            v-if="editMode" :key="'undo'"
            v-tooltip="undoTooltips.undo"
          >
            <AposButton
              :disabled="patchesSinceLoaded.length === 0"
              type="subtle" :modifiers="['small', 'no-motion']"
              label="Undo" class="apos-admin-bar__context-button"
              icon="undo-icon" :icon-only="true"
              @click="undo"
            />
          </div>
          <div
            v-if="editMode" :key="'redo'"
            v-tooltip="undoTooltips.redo"
          >
            <AposButton
              :disabled="undone.length === 0"
              type="subtle" :modifiers="['small', 'no-motion']"
              label="Redo" class="apos-admin-bar__context-button"
              icon="redo-icon" :icon-only="true"
              @click="redo"
            />
          </div>
          <div
            v-if="editMode" :key="'status'"
            class="apos-admin-bar__status"
          >
            <span class="apos-admin-bar__status__inner">
              <component
                :is="savingIndicator.el"
                v-bind="savingIndicator.options"
                class="apos-admin-bar__status__icon"
              />
              <div class="apos-admin-bar__status__label" ref="statusLabel">
                {{ savingLabel }}
              </div>
            </span>
          </div>
        </transition-group>
        <transition-group
          tag="div"
          class="apos-admin-bar__control-set apos-admin-bar__control-set--title"
          name="flip"
        >
          <span
            v-show="true"
            class="apos-admin-bar__title"
            :key="'title'"
          >
            <AposIndicator
              icon="information-outline-icon"
              fill-color="var(--a-primary)"
              :tooltip="docTooltip"
              class="apos-admin-bar__title__indicator"
            />
            <span class="apos-admin-bar__title__document-title">
              {{ context.title }}
            </span>
            <span class="apos-admin-bar__title__separator">
              —
            </span>
            <AposContextMenu
              class="apos-admin-bar__title__document"
              :button="draftButton"
              :menu="draftMenu"
              :disabled="contextStack.length > 0"
              @item-clicked="switchDraftMode"
              menu-offset="13, 10"
              menu-placement="bottom-end"
            />
          </span>
        </transition-group>
        <transition-group
          tag="div"
          class="apos-admin-bar__control-set apos-admin-bar__control-set--mode-and-settings"
          name="flip"
        >
          <!--
            TODO: Each div at this level serves as a discrete context menu state
            Modules should be able to provide their own menus here to complete tasks specific to them.
            It might also be worth breaking up the core menus into their own vue components to
            further illustrate this concept.
          -->
          <div
            v-if="!editMode" :key="'switchToEditMode'"
            class="apos-admin-bar__control-set__group"
          >
            <AposButton
              class="apos-admin-bar__context-button"
              label="Edit" type="subtle"
              :modifiers="['small', 'no-motion']"
              :tooltip="{
                content: 'Toggle Edit Mode',
                placement: 'bottom'
              }"
              @click="switchEditMode(true)"
              :disabled="contextStack.length > 0"
            />
          </div>
          <div
            v-if="editMode"
            :key="'switchToPreviewMode'"
            class="apos-admin-bar__control-set__group"
          >
            <AposButton
              v-for="item in trayItems"
              :key="item.name"
              type="subtle" :modifiers="['small', 'no-motion']"
              :tooltip="trayItemTooltip(item)" class="apos-admin-bar__context-button"
              :icon="item.options.icon" :icon-only="true"
              :label="item.label"
              :state="trayItemState[item.name] ? [ 'active' ] : []"
              @click="emitEvent(item.action)"
            />
            <AposButton
              v-if="context._id"
              class="apos-admin-bar__context-button"
              label="Page Settings" :tooltip="{
                content: 'Page Settings',
                placement: 'bottom'
              }"
              type="subtle" :modifiers="['small', 'no-motion']"
              icon="cog-icon" :icon-only="true"
              @click="emitEvent({
                itemName: contextEditorName,
                props: {
                  docId: context._id
                }
              })"
              :disabled="contextStack.length > 0"
            />
            <!-- TODO later the :disabled will go away for most cases because options
              like duplicate and share do not require that the draft be modified, but
              right now we just have Discard Draft which requires a modified draft.

              Use disabled, not v-if, to avoid jumpy repositioning of the icons when
              toggling between context documents. -->

            <AposDocMoreMenu
              :doc-id="context._id"
              :disabled="!context.modified"
              :is-modified="context.modified"
              :can-discard-draft="context.modified"
              :is-modified-from-published="context.modified"
              :is-published="!!context.lastPublishedAt"
              :options="{ saveDraft: false }"
              @discardDraft="onDiscardDraft"
            />
            <AposButton
              class="apos-admin-bar__context-button"
              label="Preview" :tooltip="{
                content: 'Toggle Preview Mode',
                placement: 'bottom'
              }"
              type="subtle" :modifiers="['small', 'no-motion']"
              @click="switchEditMode(false)"
              :disabled="contextStack.length > 0"
            />
            <AposButton
              v-if="editMode"
              type="primary" :label="publishLabel"
              :disabled="!readyToPublish"
              class="apos-admin-bar__btn apos-admin-bar__context-button"
              @click="onPublish"
              :modifiers="['no-motion']"
            />
          </div>
        </transition-group>
      </div>
    </nav>
  </div>
</template>

<script>
import { klona } from 'klona';
import dayjs from 'dayjs';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';

export default {
  name: 'TheAposAdminBar',
  mixins: [ AposPublishMixin, AposAdvisoryLockMixin ],
  props: {
    items: {
      type: Array,
      default: function () {
        return [];
      }
    }
  },
  data() {
    // Since cookie-bsed login sessions and sessionStorage are not precisely the same
    // thing, correct any forbidden combination at page load time
    if (window.apos.mode === 'published') {
      window.sessionStorage.setItem('aposEditMode', JSON.stringify(false));
    }
    return {
      menuItems: [],
      trayItems: [],
      trayItemState: {},
      createMenu: [],
      patchesSinceLoaded: [],
      undone: [],
      patchesSinceSave: [],
      editMode: window.sessionStorage.getItem('aposEditMode') === 'true',
      draftMode: window.apos.mode,
      original: null,
      saving: false,
      editing: false,
      editingTimeout: null,
      retrying: false,
      saved: false,
      savingTimeout: null,
      contextBar: window.apos.adminBar.contextBar,
      pageTree: window.apos.adminBar.pageTree,
      context: window.apos.adminBar.context ? {
        ...window.apos.adminBar.context
      } : {},
      contextStack: [],
      savingStatus: {
        transitioning: false,
        messages: {
          1: {
            label: 'Document Saved',
            icon: 'database-check-icon',
            class: 'is-success'
          },
          2: {
            label: 'Saving document...',
            component: 'AposSpinner'
          },
          3: {
            label: 'Retrying Save document...',
            component: 'AposSpinner',
            class: 'is-warning'
          }
        }
      }
    };
  },
  computed: {
    updatedBy() {
      let editorLabel = 'ApostropheCMS ■●▲';
      if (this.context.updatedBy) {
        const editor = this.context.updatedBy;
        editorLabel = '';
        editorLabel += editor.firstName ? `${editor.firstName} ` : '';
        editorLabel += editor.lastName ? `${editor.lastName} ` : '';
        editorLabel += editor.username ? `(${editor.username})` : '';
      }
      return editorLabel;
    },
    docTooltip() {
      return `Last saved on ${dayjs(this.context.updatedAt).format('ddd MMMM D [at] H:mma')} <br /> by ${this.updatedBy}`;
    },
    undoTooltips() {
      const tooltips = {
        undo: 'Undo Change',
        redo: 'Redo Change'
      };

      if (this.patchesSinceLoaded.length === 0) {
        tooltips.undo = 'No changes to undo';
      }

      if (this.undone.length === 0) {
        tooltips.redo = 'No changes to redo';
      }

      return tooltips;
    },
    savingIndicator() {
      let el = '';
      const options = {};
      if (this.savingStep) {
        const currentStep = this.savingStatus.messages[this.savingStep];
        // form indicator component + options
        if (currentStep.component) {
          el = currentStep.component;
        } else {
          el = 'AposIndicator';
        }
        if (currentStep.icon) {
          options.icon = currentStep.icon;
          options.iconSize = 15;
        }
        if (currentStep.class) {
          options.class = currentStep.class;
        }

        if (el === 'AposIndicator') { // icon, include status tooltip where possible
          options.tooltip = this.savingStatus.messages[this.savingStep].label;
        }
      };
      return {
        el,
        options
      };
    },
    savingStep() {
      let s = null;
      if (this.retrying) {
        s = 3;
      } else if (this.saving || this.editing) {
        s = 2;
      } else if (this.saved) {
        s = 1;
      }
      return s;
    },
    savingLabel() {
      if (this.savingStep) {
        return this.savingStatus.messages[this.savingStep].label;
      } else {
        return '';
      }
    },
    currentPageId() {
      if (apos.page && apos.page.page && apos.page.page._id) {
        return apos.page.page._id;
      }
      return false;
    },
    needToAutosave() {
      return !!this.patchesSinceSave.length;
    },
    readyToPublish() {
      return this.context.modified && (!this.needToAutosave) && (!this.editing);
    },
    moduleOptions() {
      return window.apos.adminBar;
    },
    contextEditorName() {
      return this.moduleOptions.contextEditorName;
    },
    draftButton() {
      return {
        label: (this.draftMode === 'draft') ? 'Draft' : 'Published',
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'quiet'
      };
    },
    draftMenu() {
      return [
        {
          label: (this.draftMode === 'draft') ? '✓ Draft' : 'Draft',
          name: 'draft',
          action: 'draft',
          modifiers: (this.draftMode === 'draft') ? [ 'disabled' ] : null
        },
        {
          label: (this.draftMode === 'published') ? '✓ Published' : 'Published',
          name: 'published',
          action: 'published',
          modifiers: (this.draftMode === 'published') ? [ 'disabled' ] : null
        }
      ];
    },
    publishLabel() {
      if (this.context.lastPublishedAt) {
        return 'Publish Changes';
      } else {
        return 'Publish';
      }
    },
    action() {
      if (this.contextStack.length) {
        return apos.modules[this.context.type].action;
      } else {
        return this.moduleOptions.contextAction;
      }
    }
  },
  watch: {
    savingStep(newVal) {
      if (this.$refs.statusLabel) {
        const self = this;
        apos.util.removeClass(self.$refs.statusLabel, 'is-hidden');
        if (this.savingTimeout) {
          clearTimeout(this.savingTimeout);
        }
        this.savingTimeout = setTimeout(() => {
          // Mind race conditions
          if (self.$refs.statusLabel) {
            apos.util.addClass(self.$refs.statusLabel, 'is-hidden');
          }
        }, 5000);
      }
    }
  },
  async mounted() {
    window.apos.adminBar.height = this.$refs.adminBar.offsetHeight;
    window.apos.util.addClass(this.$refs.adminBarOuter, `apos-theme--primary-${window.apos.ui.theme.primary}`);
    // Listen for bus events coming from notification UI
    apos.bus.$on('revert-published-to-previous', this.onRevertPublishedToPrevious);
    apos.bus.$on('unpublish', this.onUnpublish);
    apos.bus.$on('set-context', this.onSetContext);
    apos.bus.$on('push-context', this.onPushContext);
    apos.bus.$on('pop-context', this.onPopContext);
    apos.bus.$on('admin-menu-click', this.onAdminMenuClick);

    this.$refs.spacer.style.height = `${this.$refs.adminBar.offsetHeight}px`;
    const itemsSet = klona(this.items);

    this.menuItems = itemsSet.filter(item => !(item.options && item.options.contextUtility))
      .map(item => {
        if (item.items) {
          item.items.forEach(subitem => {
            // The context menu needs an `action` property to emit.
            subitem.action = subitem.action || subitem.name;
          });
        }
        return item;
      });
    this.trayItems = itemsSet.filter(item => item.options && item.options.contextUtility);

    Object.values(apos.modules).forEach(module => {
      if (module.quickCreate) {
        this.createMenu.push({
          label: module.label || module.name,
          name: module.name,
          action: `${module.name}:editor`
        });
      }
    });

    apos.bus.$on('context-editing', async () => {
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
    });

    apos.bus.$on('context-edited', patch => {
      this.patchesSinceLoaded.push(patch);
      this.patchesSinceSave.push(patch);
      this.undone = [];
      if (!this.saving) {
        this.save();
      }
    });

    window.addEventListener('beforeunload', this.beforeUnload);
    window.addEventListener('storage', (e) => {
      if (e.storageArea === sessionStorage && e.key === 'aposEditMode') {
        this.editMode = e.newValue;
      }
    });

    apos.bus.$on('content-changed', async () => {
      this.refresh();
    });

    if (this.editMode) {
      // Watch out for legacy situations where edit mode is active
      // but we are not in draft
      if (!await this.lock(`${this.action}/${this.context._id}`)) {
        this.lockNotAvailable();
        return;
      }
      if (this.draftMode !== 'draft') {
        // Also refreshes
        this.switchDraftMode('draft');
      } else {
        // The page always initially loads with fully rendered content,
        // so refetch the content with the area placeholders and data instead
        this.refresh();
      }
    }
  },
  methods: {
    async onPublish(e) {
      const published = await this.publish(this.action, this.context._id, !!this.context.lastPublishedAt);
      if (published) {
        this.context = {
          ...this.context,
          lastPublishedAt: Date.now(),
          modified: false
        };
      }
    },
    beforeUnload(e) {
      if (this.patchesSinceSave.length || this.saving || this.editing) {
        e.preventDefault();
        // No actual control over the message is possible in modern browsers,
        // but Chrome requires we set a string here
        e.returnValue = '';
      }
    },
    emitEvent(name) {
      apos.bus.$emit('admin-menu-click', name);
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
          this.context = {
            ...this.context,
            modified: doc.modified
          };
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
    // matches the existing one
    switchDraftMode(mode) {
      apos.bus.$emit('set-context', {
        mode
      });
    },
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
    // Implementation detail of onSetContext and onPushContext.
    async setContext({
      mode,
      locale,
      doc,
      navigate = false
    }) {
      mode = mode || this.draftMode;
      locale = locale || apos.locale;
      doc = doc || this.context;
      if ((mode === this.draftMode) && (locale === apos.locale)) {
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
        const modeDoc = await apos.http.post(`${apos.login.action}/set-context`, {
          body: {
            mode,
            locale: apos.locale,
            _id: doc._id
          }
        });
        window.sessionStorage.setItem('aposStateChange', Date.now());
        window.sessionStorage.setItem('aposStateChangeSeen', '{}');
        if (mode === 'published') {
          window.sessionStorage.setItem('aposEditMode', JSON.stringify(false));
          this.editMode = false;
        }
        this.draftMode = mode;
        // Patch the module options. This is necessary because we're simulating
        // something that normally would involve a new page load, but without
        // the UX negatives of that. TODO: VueX as a long term fix
        window.apos.adminBar.context = modeDoc;
        window.apos.adminBar.contextId = modeDoc._id;
        this.context = modeDoc;
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
        }
      } catch (e) {
        if (e.status === 404) {
          // TODO don't get this far, check this in advance and disable it in the UI
          await apos.alert({
            heading: 'Does Not Exist Yet',
            description: `That document is not yet available as ${mode} in the ${locale} locale.`
          });
        } else {
          // Should not happen
          await apos.alert({
            heading: 'An Error Occurred',
            description: 'Unable to switch modes.'
          });
        }
      }
    },
    async switchEditMode(editing) {
      window.sessionStorage.setItem('aposEditMode', JSON.stringify(editing));
      this.editMode = editing;
      if (editing) {
        if (!await this.lock(`${this.action}/${this.context._id}`)) {
          this.lockNotAvailable();
          return;
        }
      }
      if (this.draftMode !== 'draft') {
        // Entering edit mode implies entering draft mode.
        // Also takes care of refresh
        this.switchDraftMode('draft');
      } else {
        await this.refresh();
      }
    },
    async refresh() {
      let url = window.location.href;
      const qs = {
        ...apos.http.parseQuery(window.location.search),
        'apos-refresh': '1',
        ...(this.editMode ? {
          'apos-edit': '1'
        } : {})
      };
      url = url.replace(/\?.*$/, '');
      url = apos.http.addQueryToUrl(url, qs);
      const content = await apos.http.get(url, {
        qs,
        headers: {
          'Cache-Control': 'no-cache'
        },
        busy: true
      });
      const refreshable = document.querySelector('[data-apos-refreshable]');
      if (refreshable) {
        refreshable.innerHTML = content;
        if (!this.original) {
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
    },
    async onDiscardDraft(e) {
      const result = await this.discardDraft(this.action, this.context._id, !!this.context.lastPublishedAt);
      if (!result) {
        return;
      }
      this.context = {
        ...this.context,
        modified: false
      };
      if (this.contextStack.length) {
        // Pushed contexts might edit any property of the doc
        this.original = klona(result.doc);
      } else {
        // On-page we only edit areas
        this.original = Object.fromEntries(
          Object.entries(
            result.doc
          ).filter(
            ([ key, value ]) => value && value.metaType === 'area'
          ).map(
            ([ key, value ]) => [ key, klona(value) ]
          )
        );
      }
      this.patchesSinceLoaded = [];
      this.undone = [];
      if (!this.contextStack.length) {
        if (result.doc) {
          this.refreshOrReload(result.doc._url);
        } else {
          // With the current page gone, we need to move to safe ground
          location.assign('/');
        }
      } else {
        apos.bus.$emit('context-history-changed', result && result.doc);
      }
    },
    async onRevertPublishedToPrevious(data) {
      try {
        const response = await apos.http.post(`${data.action}/${data._id}/revert-published-to-previous`, {
          body: {},
          busy: true
        });
        apos.notify('Restored previously published version.', {
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
          heading: 'An Error Occurred',
          description: e.message || 'An error occurred while restoring the previously published version.'
        });
      }
    },
    async onUnpublish(data) {
      try {
        await apos.http.post(`${data.action}/${data._id}/unpublish`, {
          body: {},
          busy: true
        });
        apos.notify('No longer published.', {
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
          heading: 'An Error Occurred',
          description: e.message || 'An error occurred while unpublishing the document.'
        });
      }
    },
    async undo() {
      this.undone.push(this.patchesSinceLoaded.pop());
      await this.refreshAfterHistoryChange('The operation could not be undone.');
    },
    async redo() {
      this.patchesSinceLoaded.push(this.undone.pop());
      await this.refreshAfterHistoryChange('The operation could not be redone.');
    },
    async refreshAfterHistoryChange(errorMessage) {
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
          await this.refresh();
        } else {
          apos.bus.$emit('context-history-changed', updated);
        }
      } catch (e) {
        console.error(e);
        apos.notify(errorMessage, { type: 'error' });
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
    trayItemTooltip(item) {
      if (item.options.toggle) {
        if (this.trayItemState[item.name] && item.options.tooltip && item.options.tooltip.deactivate) {
          return {
            content: item.options.tooltip.deactivate,
            placement: 'bottom'
          };
        } else if (item.options.tooltip && item.options.tooltip.activate) {
          return {
            content: item.options.tooltip.activate,
            placement: 'bottom'
          };
        } else {
          return false;
        }
      } else {
        return item.options.tooltip;
      }
    },
    // Maintain a knowledge of which tray item toggles are active
    onAdminMenuClick(e) {
      const name = e.itemName || e;
      const trayItem = this.trayItems.find(item => item.name === name);
      if (trayItem) {
        this.trayItemState = {
          ...this.trayItemState,
          [name]: !this.trayItemState[name]
        };
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

.apos-admin-bar-wrapper {
  z-index: $z-index-admin-bar;
  position: relative;
}

.apos-admin-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  background: var(--a-background-primary);
}

.apos-admin-bar__row {
  display: flex;
  align-items: center;
  height: 35px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--a-base-9);
}

.apos-admin-bar__control-set--title {
  justify-content: center;
  align-items: center;
}

.apos-admin-bar__title {
  display: inline-flex;
  align-items: center;

  &__document-title,
  &__separator {
    display: inline-flex;
    color: var(--a-text-primary);
  }

  &__document-title {
    margin-top: 1px;
  }

  &__separator {
    align-items: center;
    padding: 0 7px;
    margin-top: 1px;
  }

  &__document {
    margin-top: 3.5px;
  }

  & /deep/ .apos-indicator {
    margin-top: 1px;
  }
}

.apos-admin-bar__title__indicator {
  margin-right: 5px;
  color: var(--a-text-primary);
}

.apos-admin-bar__items {
  display: flex;
  margin: 0;
  padding: 0;
}

.apos-admin-bar__logo {
  display: inline-block;
  height: 26px;
}

.apos-admin-bar__item {
  display: inline-flex;
  align-items: center;
}

.apos-admin-bar__sub /deep/ .apos-context-menu__btn {
  border-radius: 0;
}

.apos-admin-bar__logo {
  margin-right: 10px;
}

.apos-admin-bar__sub /deep/ .apos-context-menu__popup {
  top: calc(100% + 5px);
}

.apos-admin-bar__row--utils {
  display: flex;
  align-items: center;
}

.apos-admin-bar__control-set {
  @include type-base;
  display: flex;
  width: 100%;
  height: 100%;
}

.apos-admin-bar__control-set--mode-and-settings {
  justify-content: flex-end;
  & /deep/ .apos-button {
    margin-left: 4px;
  }
}

.apos-admin-bar__control-set__group {
  display: flex;
  align-items: center;
}

.apos-admin-bar__dropdown-items {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--a-base-10);
}

.apos-admin-bar__create {
  margin-left: 10px;

  /deep/ .apos-context-menu__btn {
    width: 21px;
    height: 21px;
  }

  /deep/ .apos-context-menu__btn .apos-button {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /deep/ .apos-context-menu__popup {
    top: calc(100% + 13px);
  }
}

.apos-admin-bar__user {
  margin-left: auto;
}

/deep/ .apos-context-menu__pane {
  min-width: 150px;
}

.apos-admin-bar__status {
  @include type-help;
  position: relative;
  margin-left: 7.5px;
  opacity: 1;
  color: var(--a-base-2);
  transition: opacity 150ms;
  &.is-hidden {
    opacity: 0;
  }
  .is-success {
    color: var(--a-success);
  }

  .is-warning {
    color: var(--a-warning);
  }
}

.apos-admin-bar__status__inner {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  white-space: nowrap;
}

.apos-admin-bar__status__icon {
  margin-right: 7.5px;
  width: 18px;
  height: 18px;
}

.apos-admin-bar__status__label {
  opacity: 1;
  transition: opacity 200ms ease;
  &.is-hidden {
    opacity: 0;
  }
}

.flip-enter { // to the ground
  transform: translateY(-20%);
  opacity: 0;
}
.flip-leave { // in the frame
  transform: translateY(0);
  opacity: 1;
}
.flip-enter-to { // from the ground
  transform: translateY(0);
  opacity: 1;
}
.flip-leave-to { // to the sky
  transform: translateY(20%);
  opacity: 0;
}

.flip-enter-active, .flip-leave-active {
  transition: all 150ms;
  &.apos-admin-bar__control-set__group {
    position: absolute;
  }
}

</style>
