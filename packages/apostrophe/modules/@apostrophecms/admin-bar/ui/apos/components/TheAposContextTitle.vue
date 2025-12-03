<template>
  <transition-group
    tag="div"
    class="apos-admin-bar__control-set apos-admin-bar__control-set--title"
    name="flip"
  >
    <span
      v-show="true"
      :key="'title'"
      class="apos-admin-bar__title"
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
      <div
        v-if="!isAutopublished"
        class="apos-admin-bar__title__context"
      >
        <span class="apos-admin-bar__title__separator">
          —
        </span>
        <AposContextMenu
          v-if="!isUnpublished"
          class="apos-admin-bar__title__document"
          :button="draftButton"
          :menu="draftMenu"
          :disabled="hasCustomUi || isUnpublished"
          :center-on-icon="true"
          menu-placement="bottom-end"
          @item-clicked="switchDraftMode"
        />
        <AposLabel
          v-else
          :label="'apostrophe:draft'"
          :tooltip="'apostrophe:notYetPublished'"
          :modifiers="['apos-is-warning', 'apos-is-filled']"
        />
      </div>
      <AposLabel
        v-for="{id, label, tooltip = '', modifiers = []} in moduleOptions.contextLabels"
        :key="id"
        class="apos-admin-bar__title-context-label"
        :label="label"
        :tooltip="tooltip"
        :modifiers="modifiers"
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
    },
    canTogglePublishDraftMode() {
      return !this.isUnpublished && !this.hasCustomUi;
    },
    moduleOptions() {
      return window.apos.adminBar;
    },
    isAutopublished() {
      return this.context._aposAutopublish ??
        (window.apos.modules[this.context.type].autopublish || false);
    }
  },
  mounted() {
    apos.bus.$on('command-menu-admin-bar-toggle-publish-draft', this.togglePublishDraftMode);
  },
  unmounted() {
    apos.bus.$off('command-menu-admin-bar-toggle-publish-draft', this.togglePublishDraftMode);
  },
  methods: {
    togglePublishDraftMode() {
      if (this.canTogglePublishDraftMode) {
        this.switchDraftMode({
          action: this.draftMode === 'draft' ? 'published' : 'draft'
        });
      }
    },
    switchDraftMode(item) {
      this.$emit('switch-draft-mode', item.action);
    }
  }
};
</script>
<style lang="scss" scoped>
.apos-admin-bar__control-set--title {
  align-items: center;
  justify-content: center;
}

.apos-admin-bar__title {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;

  &__context,
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
    margin-top: 1px;
    padding: 0 7px;
  }

  &__document {
    margin-top: 3.5px;

    :deep(.apos-context-menu__items) {
      min-width: 150px;
    }
  }
}

.apos-admin-bar__title-context-label  {
  margin-left: 5px;
}

.apos-admin-bar__title__indicator {
  margin-right: 5px;
  color: var(--a-text-primary);
}
</style>
