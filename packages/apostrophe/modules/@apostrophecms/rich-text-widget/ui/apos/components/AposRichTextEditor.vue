<template>
  <div
    class="apos-rich-text-editor"
    :class="{ 'apos-rich-text-editor--inline': inline }"
    @keyup="handleUIKeyup"
  >
    <!--
      The bubble menu sizes itself to the editor with container query units,
      so it needs a query container that is exactly as wide as the editor.
      That container cannot be the editor itself: inline size containment
      makes an element contribute nothing to its ancestors' intrinsic width,
      so any site that sizes an ancestor to its content — a card that is a
      flex item, say — would collapse to nothing. This overlay is out of
      flow, so it takes the editor's width without ever being asked for one
    -->
    <div
      ref="menus"
      class="apos-rich-text-editor__menus"
    >
      <bubble-menu
        v-if="editor && !readOnly"
        plugin-key="richTextMenu"
        class="bubble-menu"
        :tippy-options="bubbleMenuTippyOptions"
        :editor="editor"
      >
        <AposContextMenuDialog
          menu-placement="top"
          :class-list="contextMenuClasses"
          :has-tip="false"
        >
          <div
            ref="toolbar"
            class="apos-rich-text-toolbar__inner"
          >
            <component
              :is="(tools[item] && tools[item].component) || 'AposTiptapUndefined'"
              v-for="(item, index) in toolbar"
              :key="item + '-' + index"
              :name="item"
              :tool="tools[item]"
              :options="editorOptions"
              :editor="editor"
              @open-popover="openPopover"
              @close="closeToolbar"
              @focusout="onBtnBlur"
            />
          </div>
        </AposContextMenuDialog>
      </bubble-menu>
    </div>
    <floating-menu
      v-if="editor && !readOnly"
      :id="`insert-menu-${editorId}`"
      ref="insertMenu"
      plugin-key="insertMenu"
      :class="insertMenuClasses"
      :tippy-options="{
        duration: 100,
        zIndex: 999,
        placement: 'bottom-start',
        aria: { content: null, expanded: false }
      }"
      :should-show="showFloatingMenu"
      :editor="editor"
      role="listbox"
      tabindex="0"
      @keydown="closeInsertMenu"
    >
      <div class="apos-rich-text-insert-menu-heading">
        {{ $t('apostrophe:richTextInsertMenuHeading') }}
      </div>
      <ul
        class="apos-rich-text-insert-menu-wrapper"
        @keydown.prevent.arrow-up="focusInsertMenuItem(true)"
        @keydown.prevent.arrow-down="focusInsertMenuItem()"
      >
        <li
          v-for="(item, index) in insert"
          :key="`${item}-${index}`"
        >
          <AposTiptapInsertItem
            :name="item"
            :menu-item="insertMenu[item]"
            :editor="editor"
            :editor-options="getOptionsForInsertItem()"
            @done="doSuppressInsertMenu"
            @set-active-insert-menu="setActiveInsertMenu"
          />
        </li>
      </ul>
    </floating-menu>
    <div
      class="apos-rich-text-editor__editor"
      :class="editorModifiers"
    >
      <editor-content
        :editor="editor"
        :class="inline ? null : editorOptions.className"
      />
    </div>
    <div
      v-if="showPlaceholder !== null && (!placeholderText || !isFocused)"
      class="apos-rich-text-editor__editor_after"
      :class="editorModifiers"
    >
      {{ $t(emptyLabel) }}
    </div>
    <floating-menu
      v-if="editor && !readOnly"
      :should-show="showTableControls"
      :tippy-options="tableTippyOptions"
      :editor="editor"
      plugin-key="tableMenu"
      role="listbox"
      tabindex="0"
    >
      <AposTiptapTableControls
        :editor="editor"
      />
    </floating-menu>
  </div>
</template>

<script>
// The reusable rich text editor. Instantiated by the rich text widget editor
// when editing a rich text widget in context, and by the `richText` schema
// field type when a rich text field appears in any schema. Everything that
// is specific to widgets, such as contextual styles and the widget's own
// schema fields, belongs in `AposRichTextWidgetEditor` and not here.
import { mapState } from 'pinia';
import {
  Editor,
  EditorContent,
  BubbleMenu,
  FloatingMenu
} from '@tiptap/vue-3';

import AposTiptapTableControls from './AposTiptapTableControls.vue';
// Starter Kit extensions
import BlockQuote from '@tiptap/extension-blockquote';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Italic from '@tiptap/extension-italic';
import OrderedList from '@tiptap/extension-ordered-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
// End starter kit extensions
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Placeholder from '@tiptap/extension-placeholder';
import { klona } from 'klona';
import { createId } from 'apostrophe/lib/beneath.js';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import removeSlash from 'Modules/@apostrophecms/rich-text-widget/lib/remove-slash.js';
import { Extension, createDocument } from '@tiptap/core';
import { undo as undoCommand, redo as redoCommand } from '@tiptap/pm/history';
import { withoutHistory, withoutSaving } from 'Modules/@apostrophecms/admin-bar/lib/history.js';
import createContextHistory, { setContent, HISTORY_META } from 'Modules/@apostrophecms/rich-text-widget/lib/context-history.js';
import * as editorRegistry from 'Modules/@apostrophecms/rich-text-widget/lib/editor-registry.js';
import {
  useCollabStore, colorFor, markerHold, markerFade
} from 'Modules/@apostrophecms/collab/stores/collab.js';
import TextSync, { COLLAB_REMOTE } from 'Modules/@apostrophecms/collab/lib/text-sync.js';
import {
  collabDecorations, addChange, removeChange, setCursors, changedRanges
} from 'Modules/@apostrophecms/collab/lib/decorations.js';

export default {
  name: 'AposRichTextEditor',
  components: {
    EditorContent,
    BubbleMenu,
    FloatingMenu,
    AposTiptapTableControls
  },
  props: {
    // The rich text markup being edited
    modelValue: {
      type: String,
      default: ''
    },
    // Per-instance rich text options, such as `toolbar`, `styles` and
    // `insert`. Merged over the module-level `defaultOptions`
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    // Browser data of the module that governs this editor. Defaults to
    // the rich text widget module, which is also the source of the
    // configuration for `richText` schema fields
    moduleOptions: {
      type: Object,
      default() {
        return apos.modules['@apostrophecms/rich-text-widget'];
      }
    },
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    },
    autofocus: {
      type: Boolean,
      default: false
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    // Set when the editor is mounted in place of the markup the page would
    // otherwise render, as `{% field %}` does. The editor then takes up no
    // more room than that markup did, leaving the spacing of the text to
    // the site's own styles. That means dropping the widget's `className`
    // too: the page did not render the field's value inside it, so applying
    // it here would restyle the text the moment editing began
    inline: {
      type: Boolean,
      default: false
    },
    // Distinguishes this editor's insert menu from those of any other
    // editors on the page
    editorId: {
      type: String,
      default() {
        return createId();
      }
    },
    // i18n key of the label displayed when the editor is visually empty
    emptyLabel: {
      type: String,
      default: 'apostrophe:emptyRichTextWidget'
    },
    // Who keeps the undo history. `local` is tiptap's own, as in a modal.
    // `context` is the context bar's, shared with every other edit made on
    // the page, and is what an editor mounted on the page asks for. An editor
    // that turns out not to be editing the page's document, or that sits in
    // a modal after all, keeps a local history regardless
    history: {
      type: String,
      default: 'local'
    },
    // What this editor edits, as a patch key: `@id.content` for a rich text
    // widget, the patch key of a field edited in place. Required for a
    // `context` history, which may have to patch the value directly if the
    // editor is gone by the time the user undoes their typing
    historyTarget: {
      type: String,
      default: null
    }
  },
  emits: [ 'update:modelValue', 'focus', 'blur', 'interaction' ],
  data() {
    return {
      editor: null,
      pending: null,
      isFocused: null,
      isShowingInsert: false,
      showPlaceholder: null,
      activeInsertMenuComponent: false,
      suppressInsertMenu: false,
      hasSelection: false,
      openedPopover: false,
      // Whether the context bar keeps our history, see the `history` prop
      contextHistory: false,
      // The markup we last reported, so that a new `modelValue` we did not
      // send ourselves can be told apart from the echo of one we did
      lastEmitted: null
    };
  },
  computed: {
    ...mapState(useModalStore, [ 'getAdminDirectionClass' ]),
    bubbleMenuTippyOptions() {
      return {
        // Keeps the menu inside the query container that gives `100cqw` the
        // width of the editor. Resolved when tippy mounts, not now, since
        // the ref does not exist while this is first computed
        appendTo: () => this.$refs.menus,
        maxWidth: 'none',
        duration: 100,
        zIndex: 999,
        animation: 'fade',
        inertia: true,
        placement: 'bottom',
        hideOnClick: false,
        onHide: this.onBubbleHide,
        popperOptions: {
          modifiers: [
            {
              name: 'preventOverflow',
              options: {
                padding: 8,
                boundary: this.$el
              }
            }
          ]
        },
        aria: {
          content: null,
          expanded: false
        }
      };
    },
    // Note that context menu class-list expects a string
    contextMenuClasses() {
      const directionClass = this.getAdminDirectionClass();
      const classes = [ 'apos-rich-text-toolbar' ];
      if (directionClass) {
        classes.push(directionClass);
      }
      return classes.join(' ');
    },
    insertMenuClasses() {
      const directionClass = this.getAdminDirectionClass();
      return {
        'apos-rich-text-insert-menu': true,
        [directionClass]: !!directionClass
      };
    },
    tableOptions() {
      const options = this.moduleOptions.tableOptions || {};

      if (options.class) {
        options.HTMLAttributes = { class: options.class };
        delete options.class;
      }

      return options;
    },
    tableTippyOptions() {
      return {
        zIndex: 2001,
        placement: 'top',
        offset: [ 0, 35 ],
        moveTransition: 'transform 0s ease-out',
        appendTo: document.body,
        aria: {
          content: null,
          expanded: false
        }
      };
    },
    defaultOptions() {
      return this.moduleOptions.defaultOptions;
    },
    editorOptions() {
      return this.getOptionsForEditor();
    },
    initialContent() {
      return this.prepareContent(this.modelValue);
    },
    // The markup for an empty editor, see `prepareContent`
    emptyContent() {
      // If we don't supply a valid instance of the first style, then
      // the text align control will not work until the user manually
      // applies a style or refreshes the page
      const defaultStyle =
        this.editorOptions.nodes.length
          ? this.editorOptions.nodes.find(style => style.def)
          : this.editorOptions.marks.length
            ? this.editorOptions.marks.find(style => style.def)
            : null;

      const _class = defaultStyle.class ? ` class="${defaultStyle.class}"` : '';
      return `<${defaultStyle.tag}${_class}></${defaultStyle.tag}>`;
    },
    // Names of active toolbar items for this particular editor, as an array
    toolbar() {
      return this.editorOptions.toolbar;
    },
    // Information about all available toolbar items, as an object
    tools() {
      return this.moduleOptions.tools;
    },
    // Names of active insert menu items for this editor, as an array
    insert() {
      return this.editorOptions.insert || [];
    },
    // Information about all available insert menu items, as an object
    insertMenu() {
      return this.moduleOptions.insertMenu;
    },
    isVisuallyEmpty() {
      const div = document.createElement('div');
      let hasSomeContent = false;
      div.innerHTML = this.modelValue?.trim();
      if (this.editor) {
        const editorJSON = this.editor.getJSON();
        // We are interested in different than the default `p` wrappers
        // when the innerHTML is empty.
        hasSomeContent = !!editorJSON?.content
          .filter(c => ![ 'defaultNode' ].includes(c.type)).length;
      }
      return (!div.textContent && !hasSomeContent);
    },
    editorModifiers () {
      const classes = [];
      if (this.isVisuallyEmpty) {
        classes.push('apos-is-visually-empty');
      }
      // Per Stu's original logic we have to deal with an edge case when the
      // page is first loading by displaying the initial placeholder then too
      // (showPlaceholder state not yet computed)
      const hasPlaceholder = this.placeholderText && this.moduleOptions.placeholder;
      if (
        (hasPlaceholder || this.insert.length) &&
        this.isFocused &&
        this.showPlaceholder !== false
      ) {
        classes.push('apos-show-initial-placeholder');
      }
      return classes;
    },
    tiptapTextCommands() {
      return this.moduleOptions.tiptapTextCommands;
    },
    tiptapTypes() {
      return this.moduleOptions.tiptapTypes;
    },
    placeholderText() {
      return this.insert.length > 0
        ? this.moduleOptions.placeholderTextWithInsertMenu
        : (this.moduleOptions.placeholderText || '');
    }
  },
  watch: {
    // Normally the value we are given is only the echo of what we reported.
    // On the page it can also be one the context bar put back, e.g. on undo,
    // and the editor has to show it. Not done for a local history, whose
    // parent never changes the value behind our back
    modelValue(value) {
      // When several people edit the text at once, it only ever changes
      // through the collaboration session, which has already put it here
      if (!this.contextHistory || !this.editor || this.textSync) {
        return;
      }
      if ((value === this.lastEmitted) || (value === this.editor.getHTML())) {
        return;
      }
      setContent(this.editor, this.transformNamedAnchors(value || ''));
    },
    isFocused(newVal) {
      if (!newVal) {
        this.$emit('blur');
        if (this.pending) {
          this.emitUpdate();
        }
      } else {
        apos.bus.$emit('close-context-menus');
        this.$emit('focus');
      }
      if (!newVal) {
        // Save what we typed without waiting
        this.textSync?.checkpoint();
      }
    },
    isShowingInsert(newVal) {
      if (newVal) {
        this.focusInsertMenuItem(false, 0);
      }
    }
  },
  mounted() {
    this.contextHistory = (this.history === 'context') &&
      !!this.docId &&
      (this.docId === window.apos.adminBar?.contextId) &&
      !this.$el.closest('[data-apos-modal]');
    // Several people may be editing this text at once
    const session = useCollabStore().session;
    this.collabSession = (
      this.contextHistory &&
      this.historyTarget &&
      session &&
      (session.docId === this.docId)
    )
      ? session
      : null;
    // Steps typed before collaboration could start, see `collabHost`
    this.preCollabSteps = [];
    this.historyKey = createId();
    this.instantiateEditor();
    if (this.contextHistory) {
      editorRegistry.register(this.historyKey, {
        target: this.historyTarget,
        editor: this.editor,
        el: this.$el,
        flush: () => this.emitUpdate(),
        ...(this.collabSession && {
          collabHistory: direction => this.collabHistory(direction)
        })
      });
    }
    if (this.collabSession) {
      this.textSync = new TextSync({
        key: this.historyTarget,
        session: this.collabSession,
        host: this.collabHost()
      });
      this.unwatchCursors = this.$watch(
        () => this.remoteCursors(),
        cursors => setCursors(this.editor.view, cursors),
        { deep: true }
      );
    }
    apos.bus.$on('apos-refreshing', this.onAposRefreshing);
  },
  beforeUnmount() {
    editorRegistry.unregister(this.historyKey);
    this.unwatchCursors?.();
    if (this.textSync) {
      if (this.pending) {
        this.emitUpdate();
      }
      this.textSync.destroy();
      this.textSync = null;
    }
    for (const timer of this.changeTimers || []) {
      clearTimeout(timer);
    }
    this.editor?.destroy();
    apos.bus.$off('apos-refreshing', this.onAposRefreshing);
  },
  methods: {
    instantiateEditor() {
    // Cleanly namespace it so we don't conflict with other uses and instances
      const CustomPlaceholder = Placeholder.extend();
      const extensions = [
        BlockQuote,
        Bold,
        BulletList,
        Code,
        CodeBlock,
        Dropcursor,
        Gapcursor,
        HardBreak,
        this.contextHistory
          ? createContextHistory({
            onRecord: this.onHistoryRecord,
            collab: !!this.collabSession
          })
          : History,
        this.collabSession && Extension.create({
          name: 'aposCollabDecorations',
          addProseMirrorPlugins: () => [ collabDecorations() ]
        }),
        HorizontalRule,
        Italic,
        OrderedList,
        Paragraph,
        Strike,
        Text,
        TextAlign.configure({
          types: [ 'heading', 'paragraph', 'defaultNode' ]
        }),
        Highlight,
        Underline,
        Superscript,
        Subscript,
        Table.configure(this.tableOptions),
        TableCell,
        TableHeader,
        TableRow,
        CustomPlaceholder.configure({
          placeholder: () => {
            const text = this.$t(this.placeholderText);
            return text;
          },
          emptyNodeClass: 'apos-is-empty'
        }),
        FloatingMenu
      ]
        .filter(Boolean)
        .concat(this.aposTiptapExtensions());

      this.ensureExtensionsPriority(extensions);
      this.editor = new Editor({
        content: this.initialContent,
        autofocus: this.autofocus,
        editable: !this.readOnly,
        onUpdate: this.editorUpdate,
        onTransaction: this.onTransaction,
        extensions,
        editorProps: {
          attributes: {
            'aria-label': this.$t('apostrophe:richTextEditor')
          }
        },

        // The following events are triggered:
        //  - before the placeholder configuration function, when loading the page
        //  - after it, once the page is loaded and we interact with the editors
        // To solve this issue, use another `this.showPlaceholder` variable
        // and toggle it after the placeholder configuration function is called,
        // thanks to nextTick.
        // The proper thing would be to call nextTick inside the placeholder
        // function so that it can rely on the focus state set by these event
        // listeners, but the placeholder function is called synchronously...
        // When not autofocusing, we want to show the "Empty" placeholder right away.
        onCreate: () => {
          this.showPlaceholder = true;
        },
        onFocus: () => {
          this.isFocused = true;
          this.$nextTick(() => {
            this.showPlaceholder = false;
          });
        },
        onBlur: () => {
          this.isFocused = false;
          this.$nextTick(() => {
            this.showPlaceholder = true;
          });
        },
        onSelectionUpdate: ({ editor }) => {
          this.hasSelection = !editor.view.state.selection.empty;
          this.sendAwareness();
          this.$nextTick(() => {
            if (this.hasSelection) {
              this.$emit('interaction');
            }
          });
        }
      });
    },
    // Insert menu items just want to know what the original options were,
    // while "editorOptions" has morphed into a different, internal
    // representation
    getOptionsForInsertItem() {
      return klona({
        ...this.defaultOptions,
        ...this.options
      });
    },
    getOptionsForEditor() {
      // Deep clone to prevent runaway recursive rendering
      // as the subproperties are mutated in several places
      // by this code and its dependencies
      let activeOptions = klona(this.options);

      activeOptions = {
        ...activeOptions,
        ...this.enhanceStyles(
          activeOptions.styles?.length
            ? activeOptions.styles
            : klona(this.defaultOptions.styles)
        )
      };
      delete activeOptions.styles;

      // Allow default options to pass through if `false`
      Object.keys(this.defaultOptions).forEach((option) => {
        if (option !== 'styles') {
          activeOptions[option] = (activeOptions[option] !== undefined)
            ? activeOptions[option]
            : this.defaultOptions[option];
        }
      });

      activeOptions.className = (activeOptions.className !== undefined)
        ? activeOptions.className
        : this.moduleOptions.className;

      if (activeOptions.toolbar.includes('styles')) {
        activeOptions.toolbar = activeOptions.toolbar.filter(t => t !== 'styles');
        if (activeOptions.marks.length) {
          activeOptions.toolbar = [ 'marks', ...activeOptions.toolbar ];
        }
        if (activeOptions.nodes.length) {
          activeOptions.toolbar = [ 'nodes', ...activeOptions.toolbar ];
        }
      }

      // The table tool is no longer part of the toolbar but will
      // automatically appear when interacting with a table element,
      // no configuration needed. If:
      // 1. The table is configured for the toolbar but not insert, move it
      // 2. remove the table tool from the toolbar
      if (activeOptions.toolbar?.some(tool => tool === 'table')) {
        if (!activeOptions.insert?.some(tool => tool === 'table')) {
          activeOptions.insert = [
            ...(activeOptions.insert || []),
            'table'
          ];
        }
        activeOptions.toolbar = activeOptions.toolbar.filter(tool => tool !== 'table');
      }
      return activeOptions;
    },
    showTableControls() {
      return this.editor?.isActive('table') ?? false;
    },
    openPopover() {
      this.openedPopover = true;
    },
    onBtnBlur(e) {
      if (this.openedPopover) {
        return;
      }
      if (this.$refs.toolbar?.contains(e.relatedTarget)) {
        return;
      }
      this.closeToolbar();
    },
    onBubbleHide() {
      apos.bus.$emit('close-context-menus', 'richText');
    },
    handleUIKeyup(event) {
      if (event.key === 'Escape') {
        this.doSuppressInsertMenu();
      } else {
        this.suppressInsertMenu = false;
      }
      this.$emit('interaction');
    },
    doSuppressInsertMenu() {
      this.suppressInsertMenu = true;
      this.activeInsertMenuComponent = false;
      this.editor.commands.focus();
    },
    onAposRefreshing(refreshOptions) {
      if (this.activeInsertMenuComponent) {
        refreshOptions.refresh = false;
      }
    },
    async editorUpdate({ transaction } = {}) {
      const remote = !!transaction?.getMeta(COLLAB_REMOTE);
      if (this.textSync && !remote) {
        this.textSync.localChanged();
      }
      // Hint that we are typing, even though we're going to
      // debounce the actual updates for performance
      if (!remote && (this.docId === window.apos.adminBar.contextId)) {
        apos.bus.$emit('context-editing');
      }
      // Debounce updates. We have our own plumbing for
      // this so that we can change our minds to update
      // right away if we lose focus.
      if (this.pending) {
        // Don't reset the timeout; we still want to save at
        // least once per second if the user is actively typing
        return;
      }

      this.pending = setTimeout(() => {
        this.emitUpdate();
      }, 1000);
    },
    emitUpdate() {
      if (this.pending) {
        clearTimeout(this.pending);
        this.pending = null;
      }
      const html = this.editor.getHTML();
      this.lastEmitted = html;
      if (this.textSync) {
        // The collaboration session saves the text. Everything else holding
        // a copy of it just needs to hear about it
        withoutSaving(() => withoutHistory(() => this.$emit('update:modelValue', html)));
      } else if (this.contextHistory) {
        // What was typed is already on the undo stack, step by step (see
        // `onHistoryRecord`). This only saves it
        withoutHistory(() => this.$emit('update:modelValue', html));
      } else {
        this.$emit('update:modelValue', html);
      }
    },
    // What `TextSync` needs of us, see `text-sync.js`
    collabHost() {
      return {
        getState: () => this.editor.state,
        dispatch: tr => this.editor.view.dispatch(tr),
        registerPlugin: plugin => this.editor.registerPlugin(plugin),
        unregisterPlugin: name => this.editor.unregisterPlugin(name),
        setContent: ({ doc, value }) => {
          const { schema } = this.editor;
          const next = doc
            ? schema.nodeFromJSON(doc)
            : createDocument(
              this.prepareContent(value),
              schema,
              this.editor.options.parseOptions
            );
          const tr = this.editor.state.tr
            .replaceWith(0, this.editor.state.doc.content.size, next.content)
            .setMeta('addToHistory', false)
            .setMeta(HISTORY_META, true)
            .setMeta('preventUpdate', true);
          this.editor.view.dispatch(tr);
        },
        afterInit: () => {
          const steps = this.preCollabSteps;
          this.preCollabSteps = [];
          if (steps.length) {
            const tr = this.editor.state.tr;
            for (const step of steps) {
              tr.maybeStep(step);
            }
            if (tr.docChanged) {
              this.editor.view.dispatch(tr);
            }
          }
          this.emitUpdate();
        },
        getValue: () => this.editor.getHTML(),
        onRemote: (tr, batch) => this.showRemoteChange(tr, batch),
        onReset: () => this.emitUpdate()
      };
    },
    // Remember what is typed before collaboration can start, to apply it
    // again once it has (see `afterInit` above)
    onTransaction({ transaction }) {
      if (
        this.textSync &&
        !this.textSync.ready &&
        transaction.docChanged &&
        (transaction.getMeta('addToHistory') !== false)
      ) {
        this.preCollabSteps.push(...transaction.steps);
      }
    },
    // Tint what someone else just changed, with their name, for a while
    showRemoteChange(tr, batch) {
      const view = this.editor?.view;
      if (!view) {
        return;
      }
      const id = addChange(view, {
        // `rebased` is how many of our own steps were taken off first
        ranges: changedRanges(tr, {
          from: tr.getMeta('rebased') || 0,
          count: batch.count
        }),
        color: colorFor(batch.userId),
        title: batch.title
      });
      this.changeTimers = this.changeTimers || [];
      const timer = setTimeout(() => {
        this.changeTimers = this.changeTimers.filter(t => t !== timer);
        removeChange(view, id);
      }, markerHold + markerFade);
      this.changeTimers.push(timer);
    },
    // Where everyone else's cursor is in this text
    remoteCursors() {
      const store = useCollabStore();
      return Object.values(store.collaborators)
        .filter(({ awareness }) => awareness?.key === this.historyTarget)
        .map(({
          tabId, awareness, color, title
        }) => ({
          tabId,
          anchor: awareness.anchor,
          head: awareness.head,
          color,
          title
        }));
    },
    // Tell everyone else where our cursor is
    sendAwareness() {
      if (!this.collabSession || !this.textSync?.ready || !this.editor) {
        return;
      }
      const { anchor, head } = this.editor.state.selection;
      this.collabSession.setAwareness({
        key: this.historyTarget,
        anchor,
        head,
        version: this.textSync.version,
        widgetId: this.historyTarget.match(/^@([^.]+)\./)?.[1]
      });
    },
    // Undo or redo our own typing, and nobody else's, for the context bar
    collabHistory(direction) {
      const command = (direction === 'undo') ? undoCommand : redoCommand;
      command(this.editor.state, this.editor.view.dispatch);
      this.editor.view.focus();
    },
    // The markup to give the editor for `value`
    prepareContent(value) {
      const content = this.transformNamedAnchors(value || '');
      return content.length ? content : this.emptyContent;
    },
    // Hand the context bar what a transaction did, for its undo stack
    onHistoryRecord(record) {
      apos.bus.$emit('context-history-record', {
        ...record,
        instanceKey: this.historyKey,
        target: this.historyTarget
      });
    },
    // Legacy content may have `id` and `name` attributes on anchor tags
    // but our tiptap anchor extension needs them on a separate `span`, so nest
    // a span to migrate this content for each relevant anchor tag encountered
    transformNamedAnchors(html) {
      const el = document.createElement('div');
      el.innerHTML = html;
      const anchors = el.querySelectorAll('a[name]');
      for (const anchor of anchors) {
        const name = anchor.getAttribute('id') || anchor.getAttribute('name');
        if (typeof name !== 'string' || !name.length) {
          continue;
        }
        const span = document.createElement('span');
        span.setAttribute('id', name);
        anchor.removeAttribute('id');
        anchor.removeAttribute('name');
        if (anchor.children.length) {
          // Migrate children of the anchor to the span
          while (anchor.firstElementChild) {
            span.append(anchor.firstElementChild);
          }
          if (anchor.attributes.length) {
            anchor.prepend(span);
          } else {
            anchor.replaceWith(span);
          }
          if (!span.innerText.length) {
            span.innerText = '⚓︎';
          }
        } else {
          // Empty anchors result in empty spans, which
          // disappear in tiptap. Wrap the anchor around
          // the next text node encountered
          let el = anchor;
          while (true) {
            if ((el.nodeType === Node.TEXT_NODE) && (el.textContent.length > 0)) {
              break;
            }
            el = traverseNextNode(el);
          }
          if (el) {
            el.parentNode.insertBefore(span, el);
            span.append(el);
          } else {
            // Still no text discovered, supply something the
            // editor can lock on to
            span.innerText = '⚓︎';
            anchor.prepend(span);
          }
        }
      }
      return el.innerHTML;
    },
    // Enhances the dev-defined styles list with tiptap
    // commands and parameters used internally.
    // WARNING: mutates its argument
    enhanceStyles(styles) {
      const self = this;
      (styles || []).forEach(style => {
        style.options = {};
        for (const key in self.tiptapTextCommands) {
          if (self.tiptapTextCommands[key].includes(style.tag)) {
            style.command = key;
          }
        }
        for (const key in self.tiptapTypes) {
          if (self.tiptapTypes[key].includes(style.tag)) {
            style.type = key;
          }
        }

        // Set heading level
        if (style.type === 'heading') {
          const level = parseInt(style.tag.split('h')[1]);
          style.options.level = level;
        }

        // Handle custom attributes
        if (style.class) {
          style.options.class = style.class;
        } else {
          style.options.class = null;
        }

        if (!style.type) {
          apos.notify('apostrophe:richTextStyleConfigWarning', {
            type: 'warning',
            dismiss: true,
            icon: 'text-box-remove-icon',
            interpolate: {
              label: style.label,
              tag: style.tag
            }
          });
        }
      });

      // ensure a default so we can rely on it throughout
      const hasDefault = !!styles.find(style => style.def);
      if (!hasDefault && styles.length) {
        // If no dev set default, use the first paragraph we can find
        if (styles.filter(style => style.type === 'paragraph').length) {
          styles.filter(style => style.type === 'paragraph')[0].def = true;
        } else {
          // Otherwise, set the first style
          styles[0].def = true;
        }
      }

      // Split styles into node and mark selects
      const result = {
        nodes: styles.filter(style => style.command === 'setNode'),
        marks: styles.filter(style => style.command !== 'setNode')
      };
      return result;
    },
    localizeStyle(style) {
      return {
        ...style,
        label: this.$t(style.label)
      };
    },
    aposTiptapExtensions() {
      return (apos.tiptapExtensions || [])
        .map(extension => extension({
          ...this.editorOptions,
          nodes: this.editorOptions.nodes.map(this.localizeStyle),
          marks: this.editorOptions.marks.map(this.localizeStyle),
          types: this.tiptapTypes
        }));
    },
    // Find the `defaultNode` extension and ensure it's registered first.
    // Any other priority related logic should be handled here.
    // Why sorting is important?
    // See https://github.com/ProseMirror/prosemirror/issues/1534#issuecomment-2984216986
    // related with list item issues and `defaultNode`.
    // NOTE: this handler mutates the input array for performance reasons.
    ensureExtensionsPriority(extensions) {
      const defaultNodeIndex = extensions.findIndex(ext => ext.name === 'defaultNode');
      if (defaultNodeIndex > 0) {
        const defaultNode = extensions.splice(defaultNodeIndex, 1)[0];
        extensions.unshift(defaultNode);
      }

      return extensions;
    },
    showFloatingMenu({
      state, oldState
    }) {
      const hasChanges = JSON.stringify(state?.doc.toJSON()) !==
        JSON.stringify(oldState?.doc.toJSON());
      const { $to } = state.selection;

      if (
        !this.insertMenu ||
        !this.insert.length ||
        !hasChanges ||
        ($to.nodeAfter && $to.nodeAfter.text) ||
        this.suppressInsertMenu
      ) {
        this.isShowingInsert = false;
        return false;
      }

      if (state.selection.empty) {
        if ($to.nodeBefore && $to.nodeBefore.text) {
          const text = $to.nodeBefore.text;
          if (text.slice(-1) === '/') {
            this.isShowingInsert = true;
            return true;
          }
        }
      }

      this.isShowingInsert = false;
      return false;
    },
    closeInsertMenu(e) {
      if (
        [ 'ArrowUp', 'ArrowDown', 'Enter', ' ' ].includes(e.key) ||
        this.activeInsertMenuComponent
      ) {
        return;
      }
      if (e.key === 'Backspace') {
        // Don't let the global remove-widget shortcut see this key
        e.preventDefault();
        e.stopPropagation();
        removeSlash(this.editor);
        this.editor.commands.focus();
        return;
      }
      this.editor.commands.focus();
      this.activeInsertMenuComponent = false;
      // Only insert character keys
      if (e.key.length === 1) {
        this.editor.commands.insertContent(e.key);
      }
    },
    focusInsertMenuItem(prev = false, index) {
      if (this.activeInsertMenuComponent) {
        return;
      }
      const buttons = Array.from(this.$refs.insertMenu.$el.querySelectorAll('[data-insert-menu-item]'));
      const currentIndex = buttons.findIndex(el => el === document.activeElement);
      let targetIndex = prev ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex >= buttons.length) {
        targetIndex = 0;
      }
      if (targetIndex < 0) {
        targetIndex = buttons.length - 1;
      }
      buttons[index || targetIndex]?.focus();
    },
    setActiveInsertMenu(isActive = true) {
      this.activeInsertMenuComponent = isActive;
    },
    closeToolbar() {
      this.openedPopover = false;
      this.editor.chain().focus().run();
    }
  }
};

function traverseNextNode(node) {
  if (node.firstChild) {
    return node.firstChild;
  }
  while (node) {
    if (node.nextSibling) {
      return node.nextSibling;
    }
    node = node.parentNode;
  }
  return null;
}
</script>

<style lang="scss" scoped>
  $z-index-button-background: 1;
  $z-index-button-foreground: 2;

  .apos-rich-text-editor {
    position: relative;
    min-width: 0;
    max-width: 100%;
  }

  // The query container the bubble menu is sized against, stretched to the
  // editor's box. `container-type: inline-size` brings inline size
  // containment with it, which zeroes the element's contribution to the
  // intrinsic width of everything above it; out of flow, it has no such
  // contribution to lose, so the editor keeps its natural width and the site
  // around it lays out as if this were not here. Nothing is drawn in it, so
  // it lets clicks through to the text underneath; the menu itself takes
  // them back
  .apos-rich-text-editor__menus {
    container-type: inline-size;
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .bubble-menu {
    // Takes back what the overlay gave up. Set here rather than on the
    // overlay's children: tippy builds the element in between, so it carries
    // no scope attribute for a scoped selector to match
    pointer-events: auto;
    box-sizing: border-box;
    width: fit-content;
    max-width: calc(100cqw - 16px);
  }

  .apos-rich-text-toolbar.editor-menu-bubble {
    z-index: $z-index-manager-toolbar;
    position: absolute;
    transform: translate3d(-50%, -50%, 0);
  }

  :deep(.apos-rich-text-toolbar) {
    max-width: 100%;
    box-sizing: border-box;

    & > .apos-context-menu__pane {
      max-width: 100%;
      box-sizing: border-box;
      padding: 8px;
      border: 1px solid var(--a-primary-transparent-25);
      background-color: var(--a-background-primary);
      border-radius: var(--a-border-radius-large);
    }

    .apos-is-active .apos-button--rich-text::after,
    .apos-button--rich-text:hover::after,
    .apos-button--rich-text:active::after,
    .apos-button--rich-text:focus::after {
      opacity: 1;
      transform: scale(1.15) translateY(0);
    }

    .apos-is-active .apos-button--rich-text::after {
      background-color: var(--a-primary-transparent-10);
    }

    .apos-is-active .apos-button--rich-text:hover::after {
      background-color: var(--a-primary-transparent-15);
    }

    .apos-button--rich-text {
      position: relative;
      height: 24px;
      padding: 0 8px;
      border: none;
      border-radius: var(--a-border-radius);
      background-color: transparent;
      color: var(--a-base-1);

      &.apos-button--icon-only {
        width: 24px;
        padding: 0;
      }

      &:hover {
        background-color: transparent;
      }

      &:hover::after {
        background-color: var(--a-base-9);
      }

      &:active {
        background-color: transparent;
      }

      &:active .apos-button__icon {
        transform: scale(0.8);
      }

      &:active::after, &:focus::after {
        background-color: var(--a-primary-transparent-25);
      }

      &::after {
        content: '';
        z-index: $z-index-button-background;
        position: absolute;
        top: 0;
        left: 0;
        display: block;
        width: 100%;
        height: 100%;
        background-color: transparent;
        transition:
          opacity 500ms var(--a-transition-timing-bounce),
          transform 500ms var(--a-transition-timing-bounce),
          background-color 500ms ease;
        opacity: 0;
        transform: scale(0.3) translateY(-4px);
      }
    }

    .apos-button--rich-text .apos-button__content {
      z-index: $z-index-button-foreground;
      position: relative;
    }

    .apos-is-active {
      background-color: transparent;
    }
  }

  .apos-rich-text-toolbar.editor-menu-bar {
    display: inline-block;
    margin-bottom: 10px;
  }

  .apos-rich-text-toolbar__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    justify-content: flex-start;
    max-width: 100%;
    height: auto;
    gap: 6px;

    > * {
      flex: 0 0 auto;
    }
  }

/* stylelint-disable-next-line selector-class-pattern */
  .apos-rich-text-editor__editor :deep(.ProseMirror) {
    @include apos-transition();
  }

/* stylelint-disable-next-line selector-class-pattern */
  .apos-rich-text-editor__editor :deep(.ProseMirror:focus) {
    outline: none;
  }

  .apos-rich-text-editor:not(.apos-rich-text-editor--inline) {
  /* stylelint-disable-next-line selector-class-pattern */
    .apos-rich-text-editor__editor :deep(.ProseMirror) {
      padding: 10px 0;
    }
  }

  // The hint that an empty editor is waiting to be typed in. It is Apostrophe's
  // own UI, but it hangs off a paragraph of the document being edited, so
  // everything the site styles that paragraph with reaches it: in a widget or a
  // field edited in place there is no modal in between, and the page's own type
  // is what a pseudo element inherits. Every inherited property that would
  // change how the hint reads is therefore stated outright rather than left to
  // whatever the site has to say about `p`
  /* stylelint-disable-next-line selector-class-pattern, selector-no-qualifying-type */
  .apos-rich-text-editor__editor :deep(.ProseMirror:focus p.apos-is-empty::after) {
    display: block;
    margin: 5px 0 10px;
    padding-top: 5px;
    border-top: 1px solid var(--a-primary-transparent-50);
    color: var(--a-primary-transparent-50);
    font-family: var(--a-family-default);
    font-size: var(--a-type-smaller);
    font-style: normal;
    font-variant: normal;
    font-weight: 600;
    line-height: var(--a-line-tall);
    text-align: start;
    text-indent: 0;
    text-transform: uppercase;
    text-decoration: none;
    letter-spacing: 0.5px;
    word-spacing: normal;
    white-space: normal;
    content: attr(data-placeholder);
    pointer-events: none;
  }

  .apos-rich-text-editor__editor {
    @include apos-transition();

    & {
      position: relative;
      border-radius: var(--a-border-radius);
      background-color: transparent;
    }
  }

  .apos-rich-text-editor__editor :deep([data-tippy-root]) {
    transition: transform 400ms var(--a-transition-timing-bounce) 100ms;
  }

  .apos-rich-text-editor__editor :deep(
    .tippy-box[data-animation='fade'][data-state='hidden']
  ) {
    opacity: 0;
    transform: scale(0.9);
  }

  .apos-rich-text-editor__editor.apos-is-visually-empty {
    background-color: var(--a-primary-transparent-10);
    min-height: 50px;
  }

  // Still big enough to click into and to show the empty label, but the page
  // is not a modal: it should not sprout a 50px block wherever a field
  // happens to be empty
  .apos-rich-text-editor--inline .apos-rich-text-editor__editor.apos-is-visually-empty {
    min-height: 2em;
  }

  // The label of an editor with nothing in it, which sits in the page next to
  // the hint above and has the same reason to spell out what it inherits
  .apos-rich-text-editor__editor_after {
    @include type-small;

    & {
      position: absolute;
      inset: 0;
      display: block;
      width: 200px;
      height: 10px;
      margin: auto;
      color: var(--a-primary-transparent-50);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      font-style: normal;
      font-variant: normal;
      font-weight: 700;
      text-indent: 0;
      text-transform: uppercase;
      text-decoration: none;
      letter-spacing: 1px;
      word-spacing: normal;
      text-align: center;
    }

    &.apos-is-visually-empty {
      opacity: 1;
      visibility: visible;
    }
  }

  :deep(.apos-rich-text-toolbar__inner > .apos-rich-text-editor__control) {
    /* Addresses a Safari-only situation where it inherits the
      `::-webkit-scrollbar-button` 2px margin. */
    margin: 0;
  }

  // So editors can find anchors again
  .apos-rich-text-editor__editor :deep(span[id]) {
    text-decoration: underline dotted;
  }

  // So editors can find table cells while editing tables

  .apos-rich-text-editor__editor :deep(table) {
    min-width: 100%;
    min-height: 200px;
  }

  // So editors can identify the cells that would take part
  // in a merge operation
  /* stylelint-disable-next-line selector-class-pattern */
  .apos-rich-text-editor__editor :deep(.selectedCell) {
    // Should be visible on any background, light mode or dark mode
    backdrop-filter: invert(0.1);
  }
/* stylelint-disable-next-line selector-no-qualifying-type, selector-class-pattern */
  .apos-rich-text-editor__editor :deep(figure.ProseMirror-selectednode) {
    opacity: 0.5;
  }

  [data-placeholder] {
    display: none;
  }

  .apos-rich-text-insert-menu {
    cursor: pointer;
    user-select: none;
    min-width: 350px;
    border-radius: var(--a-border-radius);
    box-shadow: var(--a-box-shadow);
    background-color: var(--a-background-primary);
    border: 1px solid var(--a-base-8);
    color: var(--a-base-1);
    font-family: var(--a-family-default);
    font-size: var(--a-type-base);
  }

  .apos-rich-text-insert-menu-wrapper {
    display: flex;
    flex-direction: column;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .apos-rich-text-insert-menu-heading {
    padding: 12px 16px;
    border-bottom: 1px solid var(--a-base-7);
    color: var(--a-base-2);
    font-size: var(--a-type-label);
    background-color: var(--a-base-9);
    font-weight: 500;
    letter-spacing: 0.25px;
  }

  // Inline, the space between blocks is the site's business, not ours
  /* stylelint-disable-next-line selector-class-pattern */
  .apos-rich-text-editor:not(.apos-rich-text-editor--inline) :deep(.ProseMirror) {
    > * + * {
      margin-top: 0.75em;
    }
  }

  :deep(.ProseMirror-gapcursor) { /* stylelint-disable-line selector-class-pattern */
    position: relative;
    display: block;
    height: 20px;

    &::after {
      width: 1px;
      height: 20px;
      border-top: 0 none;
      border-left: 1px solid #000;
    }
  }
</style>
