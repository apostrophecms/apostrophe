<template>
  <div
    :aria-controls="`insert-menu-${modelValue._id}`"
    @keydown="handleUIKeydown"
  >
    <bubble-menu
      v-if="editor"
      plugin-key="richTextMenu"
      class="bubble-menu"
      :tippy-options="{
        maxWidth: 'none',
        duration: 300,
        zIndex: 999,
        animation: 'fade',
        inertia: true,
        placement: 'bottom',
        hideOnClick: false,
        onHide: onBubbleHide
      }"
      :editor="editor"
    >
      <AposContextMenuDialog
        menu-placement="top"
        class-list="apos-rich-text-toolbar"
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
    <floating-menu
      v-if="editor"
      :id="`insert-menu-${modelValue._id}`"
      ref="insertMenu"
      :key="insertMenuKey"
      plugin-key="insertMenu"
      class="apos-rich-text-insert-menu"
      :tippy-options="{ duration: 100, zIndex: 999, placement: 'bottom-start' }"
      :should-show="showFloatingMenu"
      :editor="editor"
      role="listbox"
      tabindex="0"
    >
      <div class="apos-rich-text-insert-menu-heading">
        {{ $t('apostrophe:richTextInsertMenuHeading') }}
      </div>
      <ul
        class="apos-rich-text-insert-menu-wrapper"
        @keydown.prevent.arrow-up="focusInsertMenuItem(true)"
        @keydown.prevent.arrow-down="focusInsertMenuItem()"
        @keydown="closeInsertMenu"
      >
        <li
          v-for="(item, index) in insert"
          :key="`${item}-${index}`"
        >
          <AposTiptapInsertItem
            :name="item"
            :menu-item="insertMenu[item]"
            :editor="editor"
            :editor-options="editorOptions"
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
        :class="editorOptions.className"
      />
    </div>
    <div
      v-if="showPlaceholder !== null && (!placeholderText || !isFocused)"
      class="apos-rich-text-editor__editor_after"
      :class="editorModifiers"
    >
      {{ $t('apostrophe:emptyRichTextWidget') }}
    </div>
    <floating-menu
      v-if="editor"
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

export default {
  name: 'AposRichTextWidgetEditor',
  components: {
    EditorContent,
    BubbleMenu,
    FloatingMenu,
    AposTiptapTableControls
  },
  props: {
    type: {
      type: String,
      required: true
    },
    options: {
      type: Object,
      required: true
    },
    modelValue: {
      type: Object,
      default() {
        return {};
      }
    },
    // not used, but we need to keep it here to avoid
    // an attribute [object Object]
    meta: {
      type: Object,
      default() {
        return {};
      }
    },
    docId: {
      type: String,
      required: false,
      default() {
        return null;
      }
    },
    focused: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'update', 'suppressWidgetControls' ],
  data() {
    return {
      editor: null,
      docFields: {
        data: {
          ...this.modelValue
        },
        hasErrors: false
      },
      pending: null,
      isFocused: null,
      isShowingInsert: false,
      showPlaceholder: null,
      activeInsertMenuComponent: false,
      suppressInsertMenu: false,
      suppressWidgetControls: false,
      hasSelection: false,
      insertMenuKey: null,
      openedPopover: false
    };
  },
  computed: {
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
        appendTo: document.body
      };
    },
    moduleOptions() {
      return apos.modules[apos.area.widgetManagers[this.type]];
    },
    defaultOptions() {
      return this.moduleOptions.defaultOptions;
    },
    editorOptions() {
      // Deep clone to prevent runaway recursive rendering
      // as the subproperties are mutated in several places
      // by this code and its dependencies
      let activeOptions = klona(this.options);

      activeOptions = {
        ...activeOptions,
        ...this.enhanceStyles(
          activeOptions.styles?.length
            ? activeOptions.styles
            : this.defaultOptions.styles
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
    autofocus() {
      // Only true for a new rich text widget
      return !this.modelValue.content.length;
    },
    initialContent() {
      const content = this.transformNamedAnchors(this.modelValue.content);
      if (content.length) {
        return content;
      }

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
    // Names of active toolbar items for this particular widget, as an array
    toolbar() {
      return this.editorOptions.toolbar;
    },
    // Information about all available toolbar items, as an object
    tools() {
      return this.moduleOptions.tools;
    },
    // Names of active insert menu items for this particular widget, as an array
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
      div.innerHTML = this.modelValue.content?.trim();
      if (this.editor) {
        const editorJSON = this.editor.getJSON();
        // We are interested in different than the default `p` wrappers
        // when the innerHTML is empty.
        hasSomeContent = !!editorJSON?.content
          .filter(c => ![ 'paragraph' ].includes(c.type)).length;
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
    suppressWidgetControls(newVal) {
      if (newVal) {
        this.$emit('suppressWidgetControls');
      }
    },
    isFocused(newVal) {
      if (!newVal) {
        this.suppressWidgetControls = false;
        if (this.pending) {
          this.emitWidgetUpdate();
        }
      } else {
        apos.bus.$emit('close-context-menus');
      }
    },
    isShowingInsert(newVal) {
      if (newVal) {
        this.focusInsertMenuItem(false, 0);
      }
    }
  },
  mounted() {
    this.insertMenuKey = this.generateKey();
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
      History,
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
      onUpdate: this.editorUpdate,
      extensions,

      // The following events are triggered:
      //  - before the placeholder configuration function, when loading the page
      //  - after it, once the page is loaded and we interact with the editors
      // To solve this issue, use another `this.showPlaceholder` variable
      // and toggle it after the placeholder configuration function is called,
      // thanks to nextTick.
      // The proper thing would be to call nextTick inside the placeholder
      // function so that it can rely on the focus state set by these event
      // listeners, but the placeholder function is called synchronously...
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
        this.$nextTick(() => {
          if (!editor.view.state.selection.empty) {
            this.suppressWidgetControls = true;
          }
        });
      }
    });
    apos.bus.$on('apos-refreshing', this.onAposRefreshing);
  },

  beforeUnmount() {
    this.editor.destroy();
    apos.bus.$off('apos-refreshing', this.onAposRefreshing);
  },
  methods: {
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
    generateKey() {
      return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
    },
    handleUIKeydown(e) {
      if (e.key === 'Escape') {
        this.doSuppressInsertMenu();
      } else {
        this.suppressInsertMenu = false;
      }
      this.suppressWidgetControls = true;
    },
    doSuppressInsertMenu() {
      this.suppressInsertMenu = true;
      this.activeInsertMenuComponent = false;
      this.insertMenuKey = this.generateKey();
      this.editor.commands.focus();
    },
    onAposRefreshing(refreshOptions) {
      if (this.activeInsertMenuComponent) {
        refreshOptions.refresh = false;
      }
    },
    async editorUpdate() {
      // Hint that we are typing, even though we're going to
      // debounce the actual updates for performance
      if (this.docId === window.apos.adminBar.contextId) {
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
        this.emitWidgetUpdate();
      }, 1000);
    },
    emitWidgetUpdate() {
      if (this.pending) {
        clearTimeout(this.pending);
        this.pending = null;
      }
      const content = this.editor.getHTML();
      const widget = this.docFields.data;
      widget.content = content;
      // ... removes need for deep watching in parent
      this.$emit('update', { ...widget });
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

  .bubble-menu {
    width: max-content;
    max-width: 95vw;
  }

  .apos-rich-text-toolbar.editor-menu-bubble {
    z-index: $z-index-manager-toolbar;
    position: absolute;
    transform: translate3d(-50%, -50%, 0);
  }

  :deep(.apos-rich-text-toolbar) {
    & > .apos-context-menu__pane {
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
    max-width: 100%;
    height: auto;
    gap: 6px;
  }

/* stylelint-disable-next-line selector-class-pattern */
  .apos-rich-text-editor__editor :deep(.ProseMirror) {
    @include apos-transition();
  }

/* stylelint-disable-next-line selector-class-pattern */
  .apos-rich-text-editor__editor :deep(.ProseMirror:focus) {
    outline: none;
  }

/* stylelint-disable-next-line selector-class-pattern */
  .apos-rich-text-editor__editor :deep(.ProseMirror) {
    padding: 10px 0;
  }

/* stylelint-disable-next-line selector-class-pattern, selector-no-qualifying-type */
  .apos-rich-text-editor__editor :deep(.ProseMirror:focus p.apos-is-empty::after) {
    display: block;
    margin: 5px 0 10px;
    padding-top: 5px;
    border-top: 1px solid var(--a-primary-transparent-50);
    color: var(--a-primary-transparent-50);
    font-size: var(--a-type-smaller);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
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
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
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

  :deep(.ProseMirror) { /* stylelint-disable-line selector-class-pattern */
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
