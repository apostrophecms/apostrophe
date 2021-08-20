<template>
  <transition-group
    tag="div"
    class="apos-admin-bar__control-set apos-admin-bar__control-set--mode-and-settings"
    name="flip"
  >
    <!--
      TODO: Each div at this level serves as a discrete context menu state
      Modules should be able to provide their own menus here to complete tasks specific to them.
      It might also be worth breaking up the core menus into their own vue components to
      further illustrate this concept.
    -->
    <div
      v-if="!editMode" :key="'switchToEditMode'"
      class="apos-admin-bar__control-set__group"
    >
      <AposButton
        class="apos-admin-bar__context-button"
        label="apostrophe:edit" type="subtle"
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
        v-if="!hasCustomUi"
        class="apos-admin-bar__context-button"
        label="apostrophe:preview" :tooltip="{
          content: 'apostrophe:previewTooltip',
          placement: 'bottom'
        }"
        type="subtle" :modifiers="['small', 'no-motion']"
        @click="switchEditMode(false)"
      />
      <AposButton
        v-if="editMode"
        type="primary" :label="publishLabel"
        :disabled="!readyToPublish"
        class="apos-admin-bar__btn apos-admin-bar__context-button"
        @click="onPublish"
        :modifiers="['no-motion']"
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
    hasCustomUi: Boolean,
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
          if (this.hasBeenPublishedThisPageload && !this.readyToPublish && this.hasBeenPublishedButNotUpdated) {
            return 'apostrophe:published';
          // Document *has* had changes published this page load, but nothing staged now
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
        // Document has been previously published and contributor has staged changes
        if (this.context.lastPublishedAt) {
          return 'apostrophe:submitUpdate';
        } else {
        // Document has never been published and has staged changes
          return 'apostrophe:submit';
        }
      }
    },
    hasBeenPublishedThisPageload() {
      return (this.context.lastPublishedAt > this.mountedAt) || ((this.context.submitted && this.context.submitted.at) > this.mountedAt);
    }
  },
  mounted() {
    this.mountedAt = (new Date()).toISOString();
  },
  methods: {
    switchEditMode(mode) {
      this.$emit('switch-edit-mode', mode);
    },
    onPublish() {
      if (!this.context.lastPublishedAt) {
        this.hasBeenPublishedButNotUpdated = true;
      } else {
        this.hasBeenPublishedButNotUpdated = false;
      }
      this.$emit('publish');
    },
    emitEvent(name) {
      apos.bus.$emit('admin-menu-click', name);
    }
  }
};
</script>
<style lang="scss" scoped>
.apos-admin-bar__control-set--mode-and-settings {
  justify-content: flex-end;
  & ::v-deep .apos-button {
    margin-left: 4px;
  }
}

.apos-admin-bar__control-set__group {
  display: flex;
  align-items: center;
}
</style>
