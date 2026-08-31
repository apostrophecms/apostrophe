<template>
  <div
    class="apos-wysiwyg-field-wrapper"
    :class="[
      themeClass,
      {
        'apos-wysiwyg-field-wrapper--inline': inline,
        'apos-is-hovered': isHovered && !readOnly,
        'apos-is-focused': isFocused && !readOnly
      }
    ]"
    @mouseover="mouseover"
    @mouseleave="mouseleave"
    @focusin="focus"
    @focusout="blur"
  >
    <div
      ref="label"
      class="apos-wysiwyg-field__label apos-ltr"
      :class="{
        'apos-is-visible': isLabeled,
        'apos-is-ui-adjusted': adjusted
      }"
    >
      <ol class="apos-wysiwyg-field__breadcrumbs">
        <li
          class="
            apos-wysiwyg-field__breadcrumb
            apos-wysiwyg-field__breadcrumb--field-icon
          "
        >
          <AposIndicator
            :icon="icon"
            :icon-size="13"
          />
        </li>
        <li
          v-for="(item, index) in ancestors"
          :key="item.id"
          class="apos-wysiwyg-field__breadcrumb"
          :data-apos-field-breadcrumb="ancestors.length - index"
        >
          <AposButton
            type="quiet"
            :label="item.label"
            icon="chevron-right-icon"
            :icon-size="9"
            :modifiers="[ 'icon-right', 'no-motion' ]"
            :disable-focus="!isLabeled"
            @click="focusWidget($event, item.id)"
          />
        </li>
        <li
          class="apos-wysiwyg-field__breadcrumb"
          data-apos-field-breadcrumb="0"
        >
          <AposButton
            type="quiet"
            :label="field.label || field.name"
            :modifiers="[ 'no-motion' ]"
            :disable-focus="!isLabeled"
            @click="focusField"
          />
        </li>
      </ol>
    </div>
    <component
      :is="component"
      ref="editor"
      :field="field"
      :model-value="modelValue"
      :doc-id="docId"
      :patch-key="patchKey"
      :options="options"
      @update:model-value="$emit('update:modelValue', $event)"
      @changed="$emit('changed', $event)"
    />
  </div>
</template>

<script>
// Wraps an editor mounted in place by the `{% field %}` custom tag, giving it
// the breadcrumb trail a widget has. The trail says what the user is about to
// edit, which is also how they find out that they can: a field on the page
// looks like the rest of the page until they come near it.
//
// The trail is built exactly as a widget builds its own, by walking up the
// DOM, so a field of a widget is preceded by that widget, and by whatever
// contains that, all the way up. Clicking a crumb focuses that widget, so the
// user can go from a field to the widget it belongs to in one step.
//
// Which trail is on screen is not ours to decide: exactly one is, anywhere on
// the page, and the widget store keeps that state so that fields and widgets
// take their turn by the same rule.
//
// Everything else is the business of the editor named by `component`, which
// is handed the same props this component was.

import { mapState, mapActions } from 'pinia';
import { useAposTheme } from 'Modules/@apostrophecms/ui/composables/AposTheme.js';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { wysiwygProps } from 'Modules/@apostrophecms/schema/mixins/AposWysiwygInputMixin';

// Enough to tell one field on the page from another. There is no id to hand
// on: two `{% field %}` tags may well output the same field of the same
// document, and they are still two things the user can be inside of
let next = 0;

export default {
  name: 'AposWysiwygField',
  props: {
    ...wysiwygProps,
    // The editor for this field type, e.g. `AposWysiwygInputRichText`
    component: {
      type: String,
      required: true
    },
    // Opens the trail, as the icon of a widget type opens a widget's trail
    icon: {
      type: String,
      default: 'pencil-icon'
    },
    // The field was rendered inline, so it is edited inline: see the wrapper
    // styles below
    inline: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'update:modelValue', 'changed' ],
  setup() {
    // The admin colors are defined on this class, and an area editor is the
    // only thing that carries it on a page. A field of the page itself has no
    // area above it, so it brings the theme along: without it every
    // `var(--a-...)` here resolves to nothing and the trail and the outline
    // are drawn in no color at all
    const { themeClass } = useAposTheme();
    return { themeClass };
  },
  data() {
    return {
      id: `wysiwyg-field:${++next}`,
      adjusted: false,
      ancestors: []
    };
  },
  computed: {
    ...mapState(useWidgetStore, [ 'labeled', 'hoveredField', 'focusedField' ]),
    readOnly() {
      return !!this.field.readOnly;
    },
    isHovered() {
      return this.hoveredField === this.id;
    },
    isFocused() {
      return this.focusedField === this.id;
    },
    // A read only field is displayed and never edited, so the trail has
    // nothing to offer the user
    isLabeled() {
      return !this.readOnly &&
        this.labeled?.type === 'field' &&
        this.labeled.id === this.id;
    }
  },
  mounted() {
    this.getAncestors();
  },
  beforeUnmount() {
    // Whatever replaced us, the page must not be left with a trail belonging
    // to a field that is no longer there, and no way to raise another
    this.clearHoveredField(this.id);
    this.clearFocusedField(this.id);
  },
  methods: {
    ...mapActions(useWidgetStore, [
      'setFocusedWidget',
      'setHoveredField',
      'clearHoveredField',
      'setFocusedField',
      'clearFocusedField'
    ]),

    mouseover(e) {
      // The innermost thing under the mouse is the thing to name, just as it
      // is for a widget inside a widget. We are the innermost, so a widget we
      // are inside of gives up its own trail while the mouse is here
      if (e) {
        e.stopPropagation();
      }
      if (this.isHovered) {
        return;
      }
      this.setHoveredField(this.id);
      this.adjust();
    },

    mouseleave() {
      this.clearHoveredField(this.id);
    },

    focus() {
      this.setFocusedField(this.id);
      this.adjust();
    },

    blur() {
      this.clearFocusedField(this.id);
    },

    // The trail sits above the field, where the admin bar may well be. When
    // there is no room for it there, drop it onto the top of the field
    // instead, exactly as a widget's trail does
    adjust() {
      const label = this.$refs.label;
      if (!label) {
        return;
      }
      const adminBarHeight = window.apos.modules['@apostrophecms/admin-bar'].height || 0;
      const { top } = this.$el.getBoundingClientRect();
      this.adjusted = (top - label.offsetHeight) < adminBarHeight;
    },

    // Hand the user off to the widget the crumb names, the way the same crumb
    // does in a widget's own trail
    focusWidget(e, widgetId) {
      if (e) {
        e.stopPropagation();
      }
      // Hand over the trail as well. Clicking the crumb put the focus in it,
      // which is inside this field, but the user asked for the widget
      this.clearFocusedField(this.id);
      const el = document.querySelector(`[data-area-widget="${widgetId}"]`);
      const area = el && apos.util.closest(el, '[data-apos-area]');
      this.setFocusedWidget(widgetId, area ? area.dataset.aposArea : null);
    },

    // The last crumb names this field, so clicking it starts editing it,
    // which is what the user just said they wanted to do
    focusField(e) {
      if (e) {
        e.stopPropagation();
      }
      const el = this.$refs.editor?.$el;
      const focusable = el && el.querySelector(
        'textarea, input, [contenteditable="true"]'
      );
      if (focusable) {
        focusable.focus();
      }
    },

    // The widgets we are inside of, outermost first. There is no component to
    // ask: an area editor renders the widgets, but the markup between them
    // and the field is the site's own, so only the DOM knows
    getAncestors() {
      const ancestors = [];
      let el = this.$el.parentNode;
      while (el) {
        const widget = apos.util.closest(el, '[data-area-widget]');
        if (!widget) {
          break;
        }
        ancestors.unshift({
          id: widget.dataset.areaWidget,
          label: widget.dataset.areaLabel
        });
        el = widget.parentNode;
      }
      this.ancestors = ancestors;
    }
  }
};
</script>

<style lang="scss" scoped>
  // The editor stands in for markup the page rendered, so the wrapper must be
  // as invisible as that markup was: a positioning context and nothing else,
  // so that the trail and the outline have something to hang from
  .apos-wysiwyg-field-wrapper {
    position: relative;
  }

  // The page put this value on a line with other things on it, so the editor
  // takes an inline box too, as wide as the text and no wider, and the line
  // reads as it did before editing began. `max-width` so that a long value
  // wraps within the page rather than running off the side of it
  .apos-wysiwyg-field-wrapper--inline {
    display: inline-block;
    max-width: 100%;
    vertical-align: top;
  }

  .apos-wysiwyg-field__label {
    @include apos-breadcrumbs-bar;

    & {
      z-index: $z-index-widget-label;
      opacity: 0;
      pointer-events: none;
    }

    &.apos-is-visible {
      opacity: 1;
      pointer-events: auto;
    }

    // No room above the field, so the trail overlaps the top of it rather
    // than hiding under the admin bar
    &.apos-is-ui-adjusted {
      transform: translateY(0);
    }
  }

  .apos-wysiwyg-field__breadcrumbs {
    @include apos-breadcrumbs-list;
  }

  .apos-wysiwyg-field__breadcrumb,
  .apos-wysiwyg-field__breadcrumb :deep(.apos-button__content) {
    @include apos-breadcrumb;
  }

  .apos-wysiwyg-field__breadcrumbs:hover .apos-wysiwyg-field__breadcrumb,
  .apos-wysiwyg-field__breadcrumbs:hover .apos-wysiwyg-field__breadcrumb
    :deep(.apos-button__content) {
    color: var(--a-text-primary);
  }

  .apos-wysiwyg-field__breadcrumb--field-icon {
    @include apos-breadcrumb-icon;
  }

  .apos-wysiwyg-field__breadcrumbs:hover
    .apos-wysiwyg-field__breadcrumb--field-icon {
    background-color: var(--a-primary-transparent-25);
  }

  .apos-wysiwyg-field__breadcrumb :deep(.apos-button) {
    @include apos-breadcrumb-button;
  }

  // Whatever the field type, the same invitation to click into it
  .apos-wysiwyg-field-wrapper.apos-is-hovered {
    @include apos-editable-in-place-outline;
  }

  .apos-wysiwyg-field-wrapper.apos-is-focused {
    @include apos-editable-in-place-outline;
    @include apos-editing-in-place-outline;
  }
</style>
