<template>
  <transition-group
    tag="div"
    class="apos-admin-bar__control-set apos-admin-bar__control-set--mode-and-settings"
    name="flip"
  >
    <!--
      TODO: Each div at this level serves as a discrete context menu state
      Modules should be able to provide their own menus here to complete
      tasks specific to them.
      It might also be worth breaking up the core menus into their own vue components to
      further illustrate this concept.
    -->
    <div
      v-if="!editMode"
      :key="'switchToEditMode'"
      class="apos-admin-bar__control-set__group"
    >
      <AposButton
        class="apos-admin-bar__context-button"
        label="apostrophe:edit"
        type="subtle"
        :modifiers="['small', 'no-motion']"
        :tooltip="{
          content: 'apostrophe:toggleEditMode',
          placement: 'bottom'
        }"
        @click="switchEditMode(true)"
      />
    </div>
    <div
      v-if="editMode"
      :key="'switchToPreviewMode'"
      class="apos-admin-bar__control-set__group"
    >
      <AposDocContextMenu
        :doc="context"
        :published="published"
        :show-preview="false"
      />
      <AposButton
        v-if="canSwitchToPreviewMode && !isAutopublished"
        class="apos-admin-bar__context-button"
        label="apostrophe:preview"
        :tooltip="{
          content: 'apostrophe:previewTooltip',
          placement: 'bottom'
        }"
        type="subtle"
        :modifiers="['small', 'no-motion']"
        @click="switchEditMode(false)"
      />
      <AposButton
        v-if="editMode && !isAutopublished"
        type="primary"
        :label="publishLabel"
        :tooltip="publishTooltip"
        :disabled="!readyToPublish"
        class="apos-admin-bar__btn apos-admin-bar__context-button"
        :modifiers="['no-motion']"
        @click="onPublish"
      />
    </div>
  </transition-group>
</template>
<script>
export default {
  name: 'TheAposContextModeAndSettings',
  props: {
    customPublishLabel: {
      type: String,
      default() {
        return null;
      }
    },
    hasCustomUi: {
      type: Boolean,
      required: true
    },
    context: {
      type: Object,
      required: true
    },
    published: {
      type: Object,
      default() {
        return null;
      }
    },
    editMode: Boolean,
    readyToPublish: Boolean,
    canPublish: Boolean
  },
  emits: [ 'switch-edit-mode', 'discard-draft', 'publish', 'dismiss-submission' ],
  data() {
    return {
      hasBeenPublishedButNotUpdated: false
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.adminBar;
    },
    contextEditorName() {
      return this.moduleOptions.contextEditorName;
    },
    publishLabel() {
      if (this.canPublish) {
        if (this.context.lastPublishedAt) {
          // Document went from unpublished to published and has nothing staged
          if (
            this.hasBeenPublishedThisPageload &&
            !this.readyToPublish &&
            this.hasBeenPublishedButNotUpdated
          ) {
            return 'apostrophe:published';
          // Document *has* had changes published this page load, but nothing
          // staged now
          } else if (this.hasBeenPublishedThisPageload && !this.readyToPublish) {
            return 'apostrophe:updated';
          // Document has been published and has staged changes
          } else {
            return 'apostrophe:update';
          }
        // Document has never been published and has staged changes
        } else {
          return 'apostrophe:publish';
        }
      } else {
        // Document has been submitted this page load and has nothing staged
        if (this.hasBeenPublishedThisPageload && !this.readyToPublish) {
          return 'apostrophe:submitted';
        }
        // Document has been previously published and contributor has staged
        // changes
        if (this.context.lastPublishedAt) {
          return 'apostrophe:submitUpdate';
        } else {
        // Document has never been published and has staged changes
          return 'apostrophe:submit';
        }
      }
    },
    publishTooltip() {
      if (
        this.canPublish &&
        this.context.lastPublishedAt &&
        !this.hasBeenPublishedThisPageload
      ) {
        return {
          content: 'apostrophe:updateTooltip',
          placement: 'bottom'
        };
      }

      return false;
    },
    isAutopublished() {
      return this.context._aposAutopublish ??
        (window.apos.modules[this.context.type].autopublish || false);
    },
    hasBeenPublishedThisPageload() {
      return (this.context.lastPublishedAt > this.mountedAt) ||
        ((this.context.submitted && this.context.submitted.at) > this.mountedAt);
    },
    canSwitchToEditMode() {
      return !this.editMode;
    },
    canSwitchToPreviewMode() {
      return this.editMode && !this.hasCustomUi;
    }
  },
  mounted() {
    this.mountedAt = (new Date()).toISOString();
    apos.bus.$on('command-menu-admin-bar-toggle-edit-preview', this.toggleEditPreviewMode);
    apos.bus.$on('command-menu-admin-bar-publish-draft', this.onPublish);
  },
  unmounted() {
    apos.bus.$off('command-menu-admin-bar-toggle-edit-preview', this.toggleEditPreviewMode);
    apos.bus.$off('command-menu-admin-bar-publish-draft', this.onPublish);
  },
  methods: {
    toggleEditPreviewMode() {
      if (this.canSwitchToEditMode) {
        this.switchEditMode(true);
      } else if (this.canSwitchToPreviewMode) {
        this.switchEditMode(false);
      }
    },
    switchEditMode(mode) {
      this.$emit('switch-edit-mode', mode);
    },
    onPublish() {
      if (!this.editMode || !this.readyToPublish) {
        return;
      }

      if (!this.context.lastPublishedAt) {
        this.hasBeenPublishedButNotUpdated = true;
      } else {
        this.hasBeenPublishedButNotUpdated = false;
      }
      this.$emit('publish');
    }
  }
};
</script>
<style lang="scss" scoped>
.apos-admin-bar__control-set--mode-and-settings {
  justify-content: flex-end;

  &:deep(.apos-button) {
    margin-left: 4px;
  }
}

.apos-admin-bar__control-set__group {
  display: flex;
  align-items: center;
}
</style>
