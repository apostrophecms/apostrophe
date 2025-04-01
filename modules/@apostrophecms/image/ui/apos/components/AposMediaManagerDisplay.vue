<template>
  <div class="apos-media-manager-display">
    <div class="apos-media-manager-display__grid">
      <AposMediaUploader
        v-if="moduleOptions.canCreate"
        :action="moduleOptions.action"
        :accept="accept"
        @upload-started="$emit('upload-started')"
        @upload-complete="$emit('upload-complete', $event)"
        @create-placeholder="$emit('create-placeholder', $event)"
      />
      <div
        v-for="item in itemsWithKeys"
        :key="item.__key"
        class="apos-media-manager-display__cell"
        :class="{'apos-is-selected': checked.includes(item._id)}"
        :style="getCellStyles(item)"
      >
        <div class="apos-media-manager-display__checkbox">
          <AposCheckbox
            v-show="item._id !== 'placeholder' && !options.hideCheckboxes"
            v-model="checkedProxy"
            tabindex="-1"
            :field="{
              name: item._id,
              hideLabel: true,
              label: $t({
                key: 'apostrophe:toggleSelectionOf',
                title: item.title
              }),
              disableFocus: true,
              readOnly: canSelect(item._id) === false
            }"
            :choice="{ value: item._id }"
          />
        </div>
        <button
          :id="`btn-${(item._id || item.__placeholder || '').replaceAll(':', '-')}`"
          :disabled="
            item._id === 'placeholder' || canSelect(item._id) === false
          "
          class="apos-media-manager-display__select"
          @click.exact="$emit('select', item._id)"
          @click.shift="$emit('select-series', item._id)"
          @click.meta="$emit('select-another', item._id)"
          @click.ctrl="$emit('select-another', item._id)"
        >
          <img
            v-if="item.attachment?._urls"
            class="apos-media-manager-display__media"
            :src="item.attachment._urls['one-sixth']"
            :alt="item.description || item.title"
          >
          <div
            v-else
            class="apos-media-manager-display__placeholder"
          />
        </button>
      </div>
      <div
        v-if="items.length === 0"
        class="apos-media-manager-display__cell apos-is-hidden"
        aria-hidden="true"
      >
        <button
          disabled="true"
          class="apos-media-manager-display__select"
        />
      </div>
    </div>
    <div
      v-if="!isLastPage"
      ref="scrollLoad"
      class="apos-media-manager-display__scroll-load"
      :class="{ 'apos-media-manager-display__scroll-load--loading': isScrollLoading }"
    >
      <AposLoading
        v-if="isScrollLoading"
        class="apos-loading"
      />
    </div>
    <div
      v-else
      class="apos-media-manager-display__end-reached"
    >
      <p>{{ $t('apostrophe:mediaLibraryEndReached') }}</p>
    </div>
  </div>
</template>

<script>
import { createId } from '@paralleldrive/cuid2';

export default {
  // Custom model to handle the v-model connection on the parent.
  props: {
    maxReached: {
      type: Boolean,
      default: false
    },
    checked: {
      type: [ Array, Boolean ],
      default: false
    },
    moduleOptions: {
      type: Object,
      required: true
    },
    items: {
      type: Array,
      default() {
        return [];
      }
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    accept: {
      type: String,
      required: false,
      default: null
    },
    largePreview: {
      type: Boolean,
      default: false
    },
    relationshipField: {
      type: [ Object, Boolean ],
      default: false
    },
    isLastPage: {
      type: Boolean,
      default: false
    },
    isScrollLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'update:checked',
    'select',
    'select-series',
    'select-another',
    'upload-started',
    'upload-complete',
    'create-placeholder',
    'set-load-ref'
  ],
  computed: {
    // Handle the local check state within this component.
    checkedProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit(
          'update:checked',
          this.relationshipField?.max === 1
            ? [].concat(val.at(-1) || [])
            : val
        );
      }
    },
    itemsWithKeys() {
      return this.items.map((item) => ({
        ...item,
        __key: this.idFor(item)
      }));
    }
  },
  watch: {
    async isLastPage(val) {
      await this.$nextTick();
      this.$emit('set-load-ref', this.$refs.scrollLoad);
    },
    async checked(newVal) {
      if (newVal.length) {
        await this.$nextTick();
        const target = newVal[newVal.length - 1];
        this.$el.querySelector(`#btn-${target.replaceAll(':', '-')}`)?.focus();
      }
    }
  },
  mounted() {
    this.$emit('set-load-ref', this.$refs.scrollLoad);
  },
  methods: {
    getCellStyles(item) {
      if (this.largePreview && item.dimensions) {
        return {
          width: `${item.dimensions.width}px`,
          height: `${item.dimensions.height}px`
        };
      }
    },
    addDragClass(event) {
      event.target.classList.add('apos-is-hovering');
    },
    removeDragClass(event) {
      event.target.classList.remove('apos-is-hovering');
    },
    idFor(item) {
      return `${item._id}-${createId()}`;
    },
    canSelect(id) {
      return this.checked.includes(id) ||
        this.relationshipField?.max === 1 ||
        (this.relationshipField?.max && !this.maxReached);
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-manager-display__grid {
    display: grid;
    grid-auto-rows: 140px;
    grid-template-columns: repeat(5, 1fr);
    gap: 15px;
    padding: 20px 0;

    @include media-up(lap) {
      grid-template-columns: repeat(7, 1fr);
      gap: 20px;
    }
  }

  .apos-media-manager-display__cell {
    @include apos-transition();

    & {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    &.apos-is-hidden { visibility: hidden; }

    &:hover,
    &.apos-is-selected,
    &:focus {
      .apos-media-manager-display__media {
        opacity: 1;
      }
    }
  }

  .apos-media-manager-display__checkbox {
    @include apos-transition();

    & {
      z-index: $z-index-manager-display;
      position: absolute;
      top: -6px;
      left: -6px;
      opacity: 0;
    }
  }

  .apos-media-manager-display__cell:hover .apos-media-manager-display__checkbox,
  .apos-media-manager-display__cell.apos-is-selected .apos-media-manager-display__checkbox {
    opacity: 1;
  }

  .apos-media-manager-display__media,
  .apos-media-manager-display__placeholder {
    @include apos-transition();

    & {
      max-width: 100%;
      max-height: 100%;
      opacity: 0.85;
    }
  }

  .apos-media-manager-display__placeholder {
    background-color: var(--a-base-9);
  }

  .apos-media-manager-display__select {
    @include apos-button-reset();
    @include apos-transition();

    & {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border: 1px solid var(--a-base-7);
    }

    &:active + .apos-media-manager-display__checkbox {
      opacity: 1;
    }

    &[disabled] {
      cursor: not-allowed;
    }
  }

  // The button when hovering/focused
  .apos-media-manager-display__select:hover,
  .apos-media-manager-display__select:focus,
  // The button when selected
  .apos-media-manager-display__cell.apos-is-selected .apos-media-manager-display__select,
  // The button when hovering on the checkbox
  .apos-media-manager-display__checkbox:hover ~ .apos-media-manager-display__select {
    border-color: var(--a-primary);
    outline: 1px solid var(--a-primary);
    box-shadow: 0 0 10px 1px var(--a-base-7);

    &[disabled] {
      border-color: var(--a-base-7);
      outline-width: 0;
      box-shadow: none;
    }
  }

  .apos-media-manager-display__scroll-load {
    display: flex;
    align-items: center;
    justify-content: center;

    &--loading {
      height: 80px;
      margin-top: 15px;
      background-color: var(--a-base-10);
      margin-bottom: 10px;
      border: 1px solid var(--a-base-8);
      border-radius: 8px;
    }

    .apos-loading {
      flex-grow: 1;
    }
  }

  .apos-media-manager-display__end-reached {
    @include type-label;

    & {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 40px;
    }
  }
</style>
