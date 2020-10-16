
<template>
  <transition name="fade">
    <li
      class="apos-slat"
      :data-id="item._id"
      tabindex="0"
      :class="{
        'is-engaged': engaged,
        'is-only-child': slatCount === 1,
        'is-selected': selected
      }"
      @keydown.prevent.space="toggleEngage"
      @keydown.prevent.enter="toggleEngage"
      @keydown.prevent.escape="disengage"
      @keydown.prevent.arrow-down="move(1)"
      @keydown.prevent.arrow-up="move(-1)"
      @keydown.prevent.backspace="remove(true)"
      @click="click"
      :aria-pressed="engaged"
      role="listitem"
      :aria-labelledby="parent"
    >
      <div class="apos-slat__main">
        <drag-icon
          v-if="slatCount > 1" class="apos-slat__control apos-slat__control--drag"
          :size="13"
        />
        <AposContextMenu
          v-if="item._fields"
          :button="more.button"
          :menu="more.menu"
          @item-clicked="$emit('item-clicked', item)"
        />
        <a
          class="apos-slat__control apos-slat__control--view"
          v-if="item._url || item._urls"
          :href="item._url || item._urls.original"
          target="_blank"
        >
          <eye-icon :size="14" />
        </a>
        <div v-if="item.group === 'images'" class="apos-slat__media-preview">
          <img :src="item._urls['one-sixth']" :alt="item.title" class="apos-slat__media" >
        </div>
        <div v-else-if="item.extension" class="apos-slat__extension-wrapper">
          <span class="apos-slat__extension" :class="[`apos-slat__extension--${item.extension}`]">
            {{ item.extension }}
          </span>
        </div>
        <div class="apos-slat__label">
          {{ item.title }}
        </div>
      </div>
      <div class="apos-slat__secondary">
        <div class="apos-slat__size" v-if="item.length && item.length.size">
          {{ itemSize }}
        </div>
        <AposButton
          v-if="removable"
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
    }
  },
  emits: [ 'engage', 'disengage', 'move', 'remove', 'item-clicked', 'select' ],
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
  computed: {
    itemSize() {
      const size = this.item.length.size;
      if (size < 1000000) {
        return `${(size / 1000).toFixed(0)}KB`;
      } else {
        return `${(size / 1000000).toFixed(1)}MB`;
      }
    }
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
    },
    click(e) {
      this.$emit('select', this.item._id);
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

    &:hover {
      cursor: grab;
      background-color: var(--a-base-7);
    }
    &:active {
      cursor: grabbing;
    }
    &:active,
    &:focus {
      background-color: var(--a-base-7);
    }

    &.apos-slat-list__item--disabled,
    &.is-only-child {
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

  .apos-slat.is-engaged,
  .apos-slat.is-engaged:focus,
  .apos-slat.sortable-chosen:focus,
  .apos-slat.is-dragging:focus,
  .apos-slat.is-selected,
  .apos-slat.is-selected:focus {
    background-color: var(--a-primary);
    &,
    /deep/ .apos-button {
      color: var(--a-white);
    }
    &:hover {
      background-color: var(--a-primary-button-hover);
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
    line-height: 1.4;
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

  .apos-slat__media-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--a-base-1);
    border: 1px solid var(--a-base-9);
  }

  .apos-slat__media {
    max-height: 30px;
    max-width: 50px;
  }
</style>
