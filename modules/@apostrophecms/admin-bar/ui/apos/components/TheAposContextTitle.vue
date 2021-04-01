<template>
  <transition-group
    tag="div"
    class="apos-admin-bar__control-set apos-admin-bar__control-set--title"
    name="flip"
  >
    <span
      v-show="true"
      class="apos-admin-bar__title"
      :key="'title'"
    >
      <AposIndicator
        icon="information-outline-icon"
        fill-color="var(--a-primary)"
        :tooltip="docTooltip"
        class="apos-admin-bar__title__indicator"
      />
      <span class="apos-admin-bar__title__document-title">
        {{ context.title }}
      </span>
      <span class="apos-admin-bar__title__separator">
        —
      </span>
      <AposContextMenu
        class="apos-admin-bar__title__document"
        :button="draftButton"
        :menu="draftMenu"
        :disabled="hasCustomUi"
        @item-clicked="switchDraftMode"
        menu-offset="13, 10"
        menu-placement="bottom-end"
      />
    </span>
  </transition-group>
</template>
<script>
import dayjs from 'dayjs';

export default {
  name: 'TheAposContextTitle',
  props: {
    draftMode: {
      type: String,
      required: true
    },
    hasCustomUi: Boolean,
    context: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [ 'switchDraftMode' ],
  computed: {
    updatedBy() {
      let editorLabel = 'ApostropheCMS ■●▲';
      if (this.context.updatedBy) {
        const editor = this.context.updatedBy;
        editorLabel = '';
        editorLabel += editor.firstName ? `${editor.firstName} ` : '';
        editorLabel += editor.lastName ? `${editor.lastName} ` : '';
        editorLabel += editor.username ? `(${editor.username})` : '';
      }
      return editorLabel;
    },
    draftButton() {
      return {
        label: (this.draftMode === 'draft') ? 'Draft' : 'Published',
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'quiet'
      };
    },
    docTooltip() {
      return `Last saved on ${dayjs(this.context.updatedAt).format('ddd MMMM D [at] H:mma')} <br /> by ${this.updatedBy}`;
    },
    draftMenu() {
      return [
        {
          label: (this.draftMode === 'draft') ? '✓ Draft' : 'Draft',
          name: 'draft',
          action: 'draft',
          modifiers: (this.draftMode === 'draft') ? [ 'disabled' ] : null
        },
        {
          label: (this.draftMode === 'published') ? '✓ Published' : 'Published',
          name: 'published',
          action: 'published',
          modifiers: (this.draftMode === 'published') ? [ 'disabled' ] : null
        }
      ];
    }
  },
  methods: {
    switchDraftMode(mode) {
      this.$emit('switchDraftMode', mode);
    }
  }
};
</script>
<style lang="scss" scoped>
</style>
