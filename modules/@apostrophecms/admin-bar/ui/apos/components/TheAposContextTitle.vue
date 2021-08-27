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
        v-if="!isUnpublished"
        class="apos-admin-bar__title__document"
        :button="draftButton"
        :menu="draftMenu"
        :disabled="hasCustomUi || isUnpublished"
        @item-clicked="switchDraftMode"
        menu-offset="13, 10"
        menu-placement="bottom-end"
      />
      <AposLabel
        v-else
        label="apostrophe:draft" :modifiers="['apos-is-warning', 'apos-is-filled']"
        tooltip="apostrophe:notYetPublished"
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
  emits: [ 'switch-draft-mode' ],
  computed: {
    updatedBy() {
      let editorLabel = 'ApostropheCMS ■●▲';
      if (this.context.updatedBy) {
        const editor = this.context.updatedBy;
        editorLabel = '';
        editorLabel += editor.title ? `${editor.title} ` : '';
        editorLabel += editor.username ? `(${editor.username})` : '';
      }
      return editorLabel;
    },
    draftButton() {
      return {
        label: (this.draftMode === 'draft') ? 'apostrophe:draft' : 'apostrophe:published',
        icon: 'chevron-down-icon',
        modifiers: [ 'icon-right', 'no-motion' ],
        type: 'quiet'
      };
    },
    isUnpublished() {
      return !this.context.lastPublishedAt;
    },
    docTooltip() {
      return {
        key: 'apostrophe:lastUpdatedBy',
        updatedAt: dayjs(this.context.updatedAt).format(this.$t('apostrophe:dayjsTitleDateFormat')),
        updatedBy: this.updatedBy
      };
    },
    draftMenu() {
      return [
        {
          label: 'apostrophe:draft',
          name: 'draft',
          action: 'draft',
          modifiers: (this.draftMode === 'draft') ? [ 'disabled', 'selected' ] : null
        },
        {
          label: 'apostrophe:published',
          name: 'published',
          action: 'published',
          modifiers: (this.draftMode === 'published') ? [ 'disabled', 'selected' ] : null
        }
      ];
    }
  },
  methods: {
    switchDraftMode(mode) {
      this.$emit('switch-draft-mode', mode);
    }
  }
};
</script>
<style lang="scss" scoped>
.apos-admin-bar__control-set--title {
  justify-content: center;
  align-items: center;
}
.apos-admin-bar__title {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;

  &__document-title,
  &__separator {
    display: inline-flex;
    color: var(--a-text-primary);
  }

  &__document-title {
    margin-top: 1px;
  }

  &__separator {
    align-items: center;
    padding: 0 7px;
    margin-top: 1px;
  }

  &__document {
    margin-top: 3.5px;
  }
}

.apos-admin-bar__title__indicator {
  margin-right: 5px;
  color: var(--a-text-primary);
}
</style>
