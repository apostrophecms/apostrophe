<template>
  <li
    class="apos-slat"
    :data-id="item._id"
    :tabindex="slatCount > 1 ? '0' : '-1'"
    :class="{
      'apos-is-engaged': engaged,
      'apos-is-only-child': slatCount === 1,
      'apos-is-selected': selected,
      'apos-is-disabled': disabled,
    }"
    :aria-pressed="engaged"
    role="listitem"
    :aria-labelledby="parent"
    @keydown.space="toggleEngage"
    @keydown.enter="toggleEngage"
    @keydown.escape="disengage"
    @keydown.arrow-down="move(1)"
    @keydown.arrow-up="move(-1)"
    @keydown.backspace="remove($event, true)"
    @click="click"
  >
    <div class="apos-slat__main">
      <drag-icon
        v-if="slatCount > 1"
        class="apos-slat__control apos-slat__control--drag"
        :size="13"
      />
      <AposContextMenu
        v-if="hasRelationshipFields && more.menu.length"
        :button="more.button"
        :menu="more.menu"
        menu-placement="bottom-start"
        :disabled="disabled"
        @item-clicked="$emit('item-clicked', item)"
      />
      <AposButton
        v-if="editorIcon && hasRelationshipEditor"
        class="apos-slat__editor-btn"
        role="button"
        :tooltip="{
          content: editorLabel,
          placement: 'bottom'
        }"
        :icon="editorIcon"
        :icon-only="true"
        :modifiers="['inline']"
        :disabled="disabled"
        @click="$emit('item-clicked', item)"
        @keydown.prevent.enter="nativeClick"
        @keydown.prevent.space="nativeClick"
      />
      <AposButton
        v-if="item._url || item._urls"
        class="apos-slat__control apos-slat__control--view"
        icon="eye-icon"
        :icon-only="true"
        :modifiers="['inline']"
        label="apostrophe:preview"
        :href="item._url || item._urls.original"
        target="_blank"
        @keydown.prevent.enter="nativeClick"
        @keydown.prevent.space="nativeClick"
      />
      <div
        v-if="item.attachment &&
          item.attachment.group === 'images' &&
          item.attachment._urls"
        class="apos-slat__media-preview"
      >
        <img
          :src="item.attachment._urls.uncropped
            ? item.attachment._urls.uncropped['one-sixth']
            : item.attachment._urls['one-sixth']"
          :alt="item.description || item.title"
          class="apos-slat__media"
        >
      </div>
      <div
        v-else-if="item.extension"
        class="apos-slat__extension-wrapper"
      >
        <span
          class="apos-slat__extension"
          :class="[`apos-slat__extension--${item.extension}`]"
        >
          {{ item.extension }}
        </span>
      </div>
      <div class="apos-slat__label">
        {{ item.title }}
      </div>
    </div>
    <div class="apos-slat__secondary">
      <div
        v-if="item.length && item.length.size"
        class="apos-slat__size"
      >
        {{ itemSize }}
      </div>
      <AposButton
        v-if="removable"
        class="apos-slat__control apos-slat__control--remove"
        icon="close-icon"
        :icon-only="true"
        :modifiers="['inline']"
        label="apostrophe:removeItem"
        :disabled="disabled"
        @click="remove($event)"
        @keydown.prevent.space="remove($event)"
      />
    </div>
  </li>
</template>

<script>
// TODO: Add Storybook story with demo API.

export default {
  name: 'AposSlat',
  props: {
    item: {
      type: Object,
      required: true
    },
    parent: {
      type: String,
      required: true
    },
    slatCount: {
      type: Number,
      required: true
    },
    engaged: {
      type: Boolean,
      default: false
    },
    removable: {
      type: Boolean,
      default: true
    },
    selected: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    relationshipSchema: {
      type: Array,
      default: () => null
    },
    editorLabel: {
      type: String,
      default: null
    },
    editorIcon: {
      type: String,
      default: null
    }
  },
  emits: [ 'engage', 'disengage', 'move', 'remove', 'item-clicked', 'select' ],
  data() {
    return {
      more: {
        button: {
          label: 'apostrophe:moreOperations',
          iconOnly: true,
          icon: 'dots-vertical-icon',
          iconSize: 13,
          type: 'inline'
        },
        menu: [
          ...!this.editorIcon
            ? [ {
              label: 'apostrophe:editRelationship',
              action: 'edit-relationship'
            } ]
            : []
        ]
      }
    };
  },
  computed: {
    itemSize() {
      const size = this.item.length?.size;
      if (size < 1000000) {
        return `${(size / 1000).toFixed(0)}KB`;
      } else {
        return `${(size / 1000000).toFixed(1)}MB`;
      }
    },
    hasRelationshipEditor() {
      if (this.item.attachment && this.item.attachment.group === 'images') {
        return this.relationshipSchema && this.item.attachment._isCroppable;
      }
      return this.relationshipSchema;
    },
    hasRelationshipFields() {
      return this.hasRelationshipEditor &&
        Array.isArray(this.relationshipSchema) &&
        this.relationshipSchema.length;
    }
  },
  methods: {
    nativeClick(e) {
      e.preventDefault();
      return e.target.click();
    },
    toggleEngage() {
      if (this.slatCount > 1) {
        if (this.engaged) {
          this.disengage();
        } else {
          this.engage();
        }
      }
    },
    engage() {
      this.$emit('engage', this.item._id);
    },
    disengage() {
      this.$emit('disengage', this.item._id);
    },
    move(dir) {
      if (this.engaged) {
        const direction = dir > 0 ? 1 : -1;
        this.$emit('move', this.item._id, direction);
      }
    },
    remove(event, focusNext) {
      event.preventDefault();
      this.$emit('remove', this.item, focusNext);
    },
    click(e) {
      this.$emit('select', this.item._id);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-slat {
    @include apos-transition();

    & {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px;
      border: 1px solid var(--a-base-5);
      border-radius: var(--a-border-radius);
      background-color: var(--a-base-9);
      color: var(--a-text-primary);
    }

    &.apos-is-disabled {
      .apos-slat__control--view {
        pointer-events: none;
      }
    }

    &:hover {
      cursor: grab;
      background-color: var(--a-base-7);
    }

    &:active {
      cursor: grabbing;
    }

    &:active,
    &:focus,
    &:focus-visible {
      background-color: var(--a-base-7);
      outline: 1px solid var(--a-primary-transparent-90);
    }

    &.apos-slat-list__item--disabled,
    &.apos-is-only-child {
      &:hover,
      &:active {
        cursor: default;
      }

      &:hover,
      &:active,
      &:focus {
        background-color: var(--a-base-9);
      }
    }
  }

  .apos-slat {
    :deep(.apos-button) {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;

      &:focus {
        outline: 1px solid var(--a-primary-transparent-90)
      }
    }
  }

  .apos-slat.apos-is-engaged,
  .apos-slat.sortable-chosen,
  .apos-slat.apos-is-selected {
    :deep(.apos-button:focus) {
      outline: 1px solid var(--a-base-7);
    }
  }

  .apos-slat.apos-is-engaged,
  .apos-slat.apos-is-engaged:focus,
  .apos-slat.sortable-chosen:focus,
  .apos-slat.apos-is-dragging:focus,
  .apos-slat.apos-is-selected,
  .apos-slat.apos-is-selected:focus {
    background-color: var(--a-primary);

    &,
    :deep(.apos-button) {
      color: var(--a-white);
    }

    &:hover {
      background-color: var(--a-primary-dark-10);
    }

    .apos-slat__label {
      color: var(--a-white);
    }
  }

  .apos-slat-list__item--disabled {
    opacity: 0.5;

    &:hover {
      cursor: not-allowed;
    }
  }

  .apos-slat__main {
    display: flex;
    align-items: center;
    max-width: 75%;

    &:deep(.trigger) {
      // This gets inline positioned and has doesn't provide an extra
      // class to beef up, sorry
      /* stylelint-disable-next-line declaration-no-important */
      display: flex !important;
    }
  }

  .apos-slat__label {
    @include type-small;

    & {
      overflow: hidden;
      margin-left: 5px;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .apos-slat__editor-btn {
    margin-right: 5px;
  }

  .apos-slat__control {
    display: flex;
    align-content: center;
    margin-right: 5px;
    line-height: 0;
  }

  .apos-slat__control--remove:hover {
    cursor: pointer;
  }

  .apos-slat__secondary {
    display: flex;
    align-items: center;
  }

  .apos-slat__size {
    @include type-small;

    & {
      margin-right: 5px;
    }
  }

  .apos-slat__control--view {
    color: inherit;
  }

  .apos-slat__extension {
    @include type-help;

    & {
      display: inline-block;
      padding: 4px;
      background-color: var(--a-generic);
      color: var(--a-white);
    }
  }

  // file types

  // spreadsheets
  .apos-slat__extension--xls,
  .apos-slat__extension--xlsx,
  .apos-slat__extension--xlsm,
  .apos-slat__extension--numbers,
  .apos-slat__extension--csv {
    background-color: var(--a-spreadsheet);
  }

  .apos-slat__extension--key,
  .apos-slat__extension--ppt,
  .apos-slat__extension--pptx {
    background-color: var(--a-presentation);
  }

  .apos-slat__extension--doc,
  .apos-slat__extension--docx,
  .apos-slat__extension--txt {
    background-color: var(--a-document);
  }

  .apos-slat__extension--pdf {
    background-color: var(--a-pdf);
  }

  .apos-slat__media-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--a-background-primary);
    border: 1px solid var( --a-base-8);
  }

  .apos-slat__media {
    max-height: 30px;
    max-width: 50px;
  }

  .apos-slat__control--view-icon {
    display: flex;
    align-items: center;
  }
</style>
