<template>
  <div class="apos-media-manager-display">
    <div class="apos-media-manager-display__grid">
      <AposMediaUploader
        :action="moduleOptions.action"
        @upload-started="$emit('upload-started')"
        @upload-complete="$emit('upload-complete', $event)"
        @create-placeholder="$emit('create-placeholder', $event)"
      />
      <div
        class="apos-media-manager-display__cell" v-for="item in items"
        :key="generateId(item._id)"
        :class="{'is-selected': checked.includes(item._id)}"
      >
        <div class="apos-media-manager-display__checkbox">
          <AposCheckbox
            v-show="item._id !== 'placeholder'"
            tabindex="-1"
            :field="{
              name: item._id,
              hideLabel: true,
              label: `Toggle selection of ${item.title}`,
              disableFocus: true,
              disabled: options.disableUnchecked && !checked.includes(item._id)
            }"
            :choice="{ value: item._id }"
            v-model="checkedProxy"
          />
        </div>
        <button
          :disabled="
            item._id === 'placeholder' ||
              (options.disableUnchecked && !checked.includes(item._id))
          "
          class="apos-media-manager-display__select"
          @click.exact="$emit('select', item._id)"
          @click.shift="$emit('select-series', item._id)"
          @click.meta="$emit('select-another', item._id)"
          ref="btns"
        >
          <div
            v-if="item.dimensions"
            class="apos-media-manager-display__placeholder"
            :style="getPlaceholderStyles(item)"
          />
          <!-- TODO: make sure using TITLE is the correct alt tag application here. -->
          <img
            v-else
            class="apos-media-manager-display__media"
            :src="item.attachment._urls['one-sixth']" :alt="item.title"
          >
        </button>
      </div>
      <!-- We need a placeholder display cell to generate the first image
      placeholder. -->
      <div
        v-if="items.length === 0"
        class="apos-media-manager-display__cell is-hidden"
        aria-hidden="true"
      >
        <button
          disabled="true"
          class="apos-media-manager-display__select"
          ref="btns"
        />
      </div>
    </div>
  </div>
</template>

<script>
import AposHelpers from 'Modules/@apostrophecms/ui/mixins/AposHelpersMixin';

export default {
  mixins: [ AposHelpers ],
  // Custom model to handle the v-model connection on the parent.
  model: {
    prop: 'checked',
    event: 'change'
  },
  props: {
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
    }
  },
  emits: [
    'select',
    'select-series',
    'select-another',
    'change',
    'upload-started',
    'upload-complete',
    'create-placeholder'
  ],
  computed: {
    // Handle the local check state within this component.
    checkedProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit('change', val);
      }
    }
  },
  mounted() {
    // Get the acceptable file types, if set.
    const imageGroup = apos.modules['@apostrophecms/attachment'].fileGroups
      .find(group => group.name === 'images');

    if (imageGroup && this.$refs['apos-upload-input']) {
      const acceptTypes = imageGroup.extensions.map(type => `.${type}`)
        .join(',');

      this.$refs['apos-upload-input'].setAttribute('accept', acceptTypes);
    }
  },
  methods: {
    getPlaceholderStyles(item) {
      // Account for whether the refs have been set by the v-for or if on the
      // placeholder.
      const btn = Array.isArray(this.$refs.btns) ? this.$refs.btns[0] : this.$refs.btns;
      const {
        width: parentWidth,
        height: parentHeight
      } = btn.getBoundingClientRect();

      const parentRatio = parentWidth / parentHeight;
      const itemRatio = item.dimensions.width / item.dimensions.height;

      if (parentRatio < itemRatio) {
        return {
          width: `${item.dimensions.width}px`,
          paddingTop: `${(item.dimensions.height / item.dimensions.width) * 100}%`
        };
      } else {
        return {
          height: `${parentHeight}px`,
          width: `${parentHeight * itemRatio}px`
        };
      }

    },
    async notifyErrors(error, fallback) {
      if (error.body && error.body.errors) {
        for (const err of error.body.errors) {
          console.error('Error saving media.', err);

          if (err.error && err.error.description) {
            await apos.notify(err.error.description || fallback, {
              type: 'danger',
              icon: 'alert-circle-icon',
              dismiss: true
            });
          }
        }
      }
    },
    addDragClass(event) {
      event.target.classList.add('is-hovering');
    },
    removeDragClass(event) {
      event.target.classList.remove('is-hovering');
    }
  }
};
</script>

<style lang="scss" scoped>
  .apos-media-manager-display__grid {
    display: grid;
    grid-auto-rows: 140px;
    grid-template-columns: repeat(5, 17.1%);
    gap: 2.4% 2.4%;

    @include media-up(lap) {
      grid-template-columns: repeat(7, 12.22%);
      gap: 2.4% 2.4%;
    }
  }

  .apos-media-manager-display__cell {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    @include apos-transition();

    &.is-hidden { visibility: hidden; }

    &::before {
      content: '';
      display: inline-block;
      width: 1px;
      height: 0;
      padding-bottom: calc(100% / (1/1));
    }

    &:hover,
    &.is-selected,
    &:focus {
      .apos-media-manager-display__media {
        opacity: 1;
      }
    }
  }

  .apos-media-manager-display__checkbox {
    z-index: $z-index-manager-display;
    position: absolute;
    top: -6px;
    left: -6px;
    opacity: 0;
    @include apos-transition();
  }

  .apos-media-manager-display__cell:hover .apos-media-manager-display__checkbox,
  .apos-media-manager-display__cell.is-selected .apos-media-manager-display__checkbox {
    opacity: 1;
  }

  .apos-media-manager-display__media,
  .apos-media-manager-display__placeholder {
    max-width: 100%;
    max-height: 100%;
    opacity: 0.85;
    @include apos-transition();
  }

  .apos-media-manager-display__placeholder {
    background-color: var(--a-base-9);
  }

  .apos-media-manager-display__select {
    @include apos-button-reset();
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    border: 1px solid var(--a-base-7);
    @include apos-transition();

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
  .apos-media-manager-display__cell.is-selected .apos-media-manager-display__select,
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
</style>
