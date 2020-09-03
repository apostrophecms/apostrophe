<template>
  <div class="apos-media-manager-display">
    <div class="apos-media-manager-display__grid">
      <label class="apos-media-manager-display__cell apos-media-manager-display__media-drop">
        <div class="apos-media-manager-display__media-drop__inner">
          <div class="apos-media-manager-display__media-drop__icon">
            <CloudUpload :size="64" />
          </div>
          <div class="apos-media-manager-display__media-drop__instructions">
            <p class="apos-media-manager-display__media-drop__primary">
              Drop new media here
            </p>
            <p class="apos-media-manager-display__media-drop__secondary">
              Or click to open the file explorer
            </p>
          </div>
        </div>
        <input
          type="file" class="apos-sr-only"
          ref="apos-upload-input"
          @input="uploadMedia"
        >
      </label>
      <div
        class="apos-media-manager-display__cell" v-for="item in media"
        :key="generateId(item._id)"
        :class="{'is-selected': checked.includes(item._id)}"
      >
        <div class="apos-media-manager-display__checkbox">
          <AposCheckbox
            tabindex="-1"
            :field="{
              name: item._id,
              type: 'checkbox',
              hideLabel: true,
              label: `Toggle selection of ${item.title}`,
              disableFocus: true
            }"
            :status="{}"
            :choice="{ value: item._id }"
            v-model="checkedProxy"
          />
        </div>
        <button
          class="apos-media-manager-display__select"
          @click.exact="$emit('select', item._id)"
          @click.shift="$emit('select-series', item._id)"
          @click.meta="$emit('select-another', item._id)"
        >
          <!-- TODO: make sure using TITLE is the correct alt tag application here. -->
          <img
            class="apos-media-manager-display__media"
            :src="item.attachment._urls['one-sixth']" :alt="item.title"
          >
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import AposHelpers from 'Modules/@apostrophecms/ui/mixins/AposHelpersMixin';
import CloudUpload from 'vue-material-design-icons/CloudUpload.vue';

export default {
  components: {
    CloudUpload
  },
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
    media: {
      type: Array,
      default() {
        return [];
      }
    }
  },
  emits: [
    'select',
    'select-series',
    'select-another',
    'change',
    'upload-started',
    'upload-complete'
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
      console.info(acceptTypes);
      this.$refs['apos-upload-input'].setAttribute('accept', acceptTypes);
    }
  },
  methods: {
    async uploadMedia (event) {
      this.$emit('upload-started');
      const file = event.target.files[0];

      const emptyDoc = await apos.http.post(this.moduleOptions.action, {
        body: {
          _newInstance: true
        }
      });

      // TODO: While the upload is working, set an uploading animation.
      await this.insertImage(file, emptyDoc);

      // When complete, refresh the image grid, with the new images at top.
      this.$emit('upload-complete');

      // TODO: If uploading one image, when complete, load up the edit schema in the right rail.
      // TODO: Else if uploading multiple images, show them as a set of selected images for editing.
    },
    async insertImage(file, emptyDoc) {
      const formData = new window.FormData();

      formData.append('file', file);
      let attachment;

      // Make an async request to upload the image.
      try {
        attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
          body: formData
        });
      } catch (error) {
        console.error('Error uploading media.', error);
        // apos.notify('Error uploading media.');
        return;
      }

      const imageData = Object.assign(emptyDoc, {
        title: attachment.title,
        attachment
      });

      try {
        await apos.http.post(this.moduleOptions.action, {
          body: imageData
        });
      } catch (error) {
        console.error('Error saving media.', error);
        // apos.notify('Error saving media.');
      }
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

    &:before {
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

  .apos-media-manager-display__media {
    max-width: 100%;
    max-height: 100%;
    opacity: 0.85;
    @include apos-transition();
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

    // TODO: Confirm this doesn't need the !important it previously had.
    &:active + .apos-media-manager-display__checkbox {
      opacity: 1;
    }
  }

  .apos-media-manager-display__cell.is-selected .apos-media-manager-display__select,
  .apos-media-manager-display__select:hover,
  .apos-media-manager-display__select:focus,
  .apos-media-manager-display__checkbox:hover ~ .apos-media-manager-display__select {
    border-color: var(--a-primary);
    outline: 1px solid var(--a-primary);
    box-shadow: 0 0 10px 1px var(--a-base-7);
  }

  .apos-media-manager-display__media-drop {
    @include apos-button-reset();
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--a-base-3);
    grid-column: 1 / 3;
    grid-row: 1 / 2;
    @include apos-transition();
    &:hover, &:active, &:focus {
      border: 2px dashed var(--a-primary);
      box-shadow: 0 0 10px -4px var(--a-primary-button-active);
      .apos-media-manager-display__media-drop__icon {
        color: var(--a-primary);
        filter: drop-shadow(0 0 5px var(--a-primary-50));
        transform: translateY(-2px);
      }
    }
    &:active, &:focus {
      outline: 1px solid var(--a-primary);
    }
  }

  .apos-media-manager-display__media-drop__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .apos-media-manager-display__media-drop__icon {
    height: 55px;
    margin-bottom: 5px;
    color: var(--a-base-5);
    @include apos-transition();
  }

  .apos-media-manager-display__media-drop__instructions {
    padding: 0 5px;
  }

  .apos-media-manager-display__media-drop__primary,
  .apos-media-manager-display__media-drop__secondary {
    @include apos-p-reset();
    text-align: center;
  }
  .apos-media-manager-display__media-drop__primary {
    max-width: 100px;
    margin: 5px auto 10px;
    font-size: map-get($font-sizes, input-label);
  }
</style>
