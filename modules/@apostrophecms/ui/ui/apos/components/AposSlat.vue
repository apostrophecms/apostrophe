
<template>
  <transition name="fade">
    <li
      class="apos-slat"
      :data-id="item._id"
      tabindex="0"
      :class="{'is-engaged': engaged}"
      @keydown.prevent.space="toggleEngage"
      @keydown.prevent.enter="toggleEngage"
      @keydown.prevent.escape="disengage"
      @keydown.prevent.arrow-down="move(1)"
      @keydown.prevent.arrow-up="move(-1)"
      @keydown.prevent.backspace="remove(true)"
      :aria-pressed="engaged"
      role="listitem"
      :aria-labelledby="parent"
    >
      <div class="apos-slat__main">
        <drag-icon class="apos-slat__control apos-slat__control--drag" :size="13" />
        <AposContextMenu
          :button="more.button"
          :menu="more.menu"
          :item-props="item"
        />
        <a
          class="apos-slat__control apos-slat__control--view"
          v-if="item.url"
          :href="item.url"
        >
          <eye-icon :size="14" />
        </a>
        <div v-if="item.ext" class="apos-slat__extension-wrapper">
          <span class="apos-slat__extension" :class="[`apos-slat__extension--${item.ext}`]">
            {{ item.ext }}
          </span>
        </div>
        <div class="apos-slat__label">
          {{ item.title }}
        </div>
      </div>
      <div class="apos-slat__secondary">
        <div class="apos-slat__size" v-if="item.size">{{ item.size }}</div>
        <AposButton
          @click="remove"
          icon="close-icon"
          :icon-only="true"
          :modifiers="['inline']"
          label="Remove Item"
        />
      </div>
    </li>
  </transition>
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
    engaged: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'engage', 'disengage', 'move', 'remove' ],
  data() {
    return {
      more: {
        button: {
          label: 'More operations',
          iconOnly: true,
          icon: 'dots-vertical-icon',
          iconSize: 13,
          type: 'inline'
        },
        menu: [
          {
            label: 'Edit Relationship',
            action: 'edit-relationship'
          }
        ]
      }
    };
  },
  methods: {
    toggleEngage() {
      if (this.engaged) {
        this.disengage();
      } else {
        this.engage();
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
        if (dir > 0) {
          this.$emit('move', this.item._id, 1);
        } else {
          this.$emit('move', this.item._id, -1);
        }
      }
    },
    remove(focusNext) {
      this.$emit('remove', this.item, focusNext);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-slat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    border: 1px solid var(--a-base-5);
    border-radius: var(--a-border-radius);
    background-color: var(--a-base-9);
    color: var(--a-text-primary);
    @include apos-transition();
    &:hover:not(.apos-slat-list__item--disabled) {
      background-color: var(--a-base-7);
      cursor: grab;
    }
    &:active:not(.apos-slat-list__item--disabled) {
      cursor: grabbing;
    }
    &:active:not(.apos-slat-list__item--disabled),
    &:focus:not(.apos-slat-list__item--disabled) {
      background-color: var(--a-base-7);
    }
  }

  .apos-slat.is-engaged,
  .apos-slat.is-engaged:focus,
  .apos-slat.sortable-chosen:focus,
  .apos-slat.is-dragging:focus {
    background-color: var(--a-primary);
    color: var(--a-white);
  }

  .apos-slat-list__item--disabled {
    opacity: 0.5;
    &:hover {
      cursor: not-allowed;
    }
  }

  .apos-slat__main {
    display: flex;
  }

  .apos-slat__label {
    overflow: hidden;
    font-size: map-get($font-sizes, meta);
    margin-left: 10px;
    max-width: 220px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .apos-slat__control {
    display: flex;
    align-content: center;
    margin-right: 5px;
  }

  .apos-slat__control--remove:hover {
    cursor: pointer;
  }

  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.5s;
  }
  .fade-enter, .fade-leave-to {
    opacity: 0;
  }

  .apos-slat__secondary {
    display: flex;
  }

  .apos-slat__size {
    margin-right: 5px;
  }

  .apos-slat__control--view {
    color: inherit;
  }

  .apos-slat__extension-wrapper {
    width: 35px;
  }
  .apos-slat__extension {
    display: inline-block;
    padding: 1px 4px;
    text-transform: uppercase;
    background-color: var(--a-generic);
    color: var(--a-white);
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
</style>
