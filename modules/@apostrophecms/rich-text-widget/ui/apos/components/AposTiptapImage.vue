<template>
  <div class="apos-image-control">
    <AposButton
      type="rich-text"
      @click="click"
      :class="{ 'apos-is-active': buttonActive }"
      :label="tool.label"
      :icon-only="!!tool.icon"
      :icon="tool.icon || false"
      :modifiers="['no-border', 'no-motion']"
      @close="close"
    />
    <AposImageControlDialog
      :active="active"
      :editor="editor"
    />
  </div>
</template>

<script>
export default {
  name: 'AposTiptapImage',
  props: {
    tool: {
      type: Object,
      required: true
    },
    editor: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      active: false
    };
  },
  computed: {
    buttonActive() {
      return this.editor.getAttributes('img').src || this.active;
    }
  },
  methods: {
    click() {
      this.active = !this.active;
    },
    close() {
      this.active = false;
      this.editor.chain().focus();
    },
    save() {
      this.triggerValidation = true;
      this.$nextTick(() => {
        if (this.docFields.hasErrors) {
          return;
        }
        const image = this.docFields.data._image[0];
        this.docFields.data.imageId = image && image.aposDocId;
        this.editor.commands.setImage({
          imageId: this.docFields.data.imageId,
          caption: this.docFields.data.caption,
          style: this.docFields.data.style
        });
        this.close();
      });
    },
    keyboardHandler(e) {
      if (e.keyCode === 27) {
        this.close();
      }
      if (e.keyCode === 13) {
        if (this.docFields.data.href || e.metaKey) {
          this.save();
          this.close();
          e.preventDefault();
        } else {
          e.preventDefault();
        }
      }
    },
    async populateFields() {
      try {
        const attrs = this.editor.getAttributes('image');
        this.docFields.data = {};
        this.schema.forEach((item) => {
          this.docFields.data[item.name] = attrs[item.name] || '';
        });
        const defaultStyle = getOptions().imageStyles?.[0]?.value;
        if (defaultStyle && !this.docFields.data.style) {
          this.docFields.data.style = defaultStyle;
        }
        if (attrs.imageId) {
          try {
            const doc = await apos.http.get(`/api/v1/@apostrophecms/image/${attrs.imageId}`, {
              busy: true
            });
            this.docFields.data._image = [ doc ];
          } catch (e) {
            if (e.status === 404) {
              // No longer available
              this.docFields._image = [];
            } else {
              throw e;
            }
          }
        }
      } finally {
        this.generation++;
      }
    }
  }
};

function getOptions() {
  return apos.modules['@apostrophecms/rich-text-widget'];
}
</script>

<style lang="scss" scoped>
  .apos-image-control {
    position: relative;
    display: inline-block;
  }

  .apos-is-active {
    background-color: var(--a-base-7);
  }
</style>
