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
      <AposButtonSplit
        :menu="saveMenu"
        :button="saveButton"
      />
      <AposButton
        class="apos-admin-bar__context-button"
        label="Edit" type="subtle"
        :modifiers="['small', 'no-motion']"
        :tooltip="{
          content: 'Toggle Edit Mode',
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
      <AposButton
        v-if="context._id && !hasCustomUi"
        class="apos-admin-bar__context-button"
        label="Page Settings" :tooltip="{
          content: 'Page Settings',
          placement: 'bottom'
        }"
        type="subtle" :modifiers="['small', 'no-motion']"
        icon="cog-icon" :icon-only="true"
        @click="emitEvent({
          itemName: contextEditorName,
          props: {
            docId: context._id
          }
        })"
      />
      <!-- TODO later the :disabled will go away for most cases because options
        like duplicate and share do not require that the draft be modified, but
        right now we just have Discard Draft which requires a modified draft.

        Use disabled, not v-if, to avoid jumpy repositioning of the icons when
        toggling between context documents. -->

      <AposDocMoreMenu
        :doc-id="context._id"
        :disabled="!context.modified && !canDismissSubmission"
        :is-modified="context.modified"
        :can-discard-draft="context.modified"
        :is-modified-from-published="context.modified"
        :is-published="!!context.lastPublishedAt"
        :can-save-draft="false"
        :can-dismiss-submission="canDismissSubmission"
        @discard-draft="onDiscardDraft"
        @dismiss-submission="onDismissSubmission"
      />
      <AposButton
        v-if="!hasCustomUi"
        class="apos-admin-bar__context-button"
        label="Preview" :tooltip="{
          content: 'Toggle Preview Mode',
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
    editMode: Boolean,
    readyToPublish: Boolean,
    canPublish: Boolean,
    canDismissSubmission: Boolean
  },
  emits: [ 'switchEditMode', 'discard-draft', 'publish', 'dismiss-submission' ],
  data() {
    return {
      hasBeenPublishedThisPageload: false,
      hasBeenPublishedButNotUpdated: false,
      saveButton: {
        type: 'primary'
      },
      saveMenu: [
        {
          label: 'Publish',
          description: 'Publish new changes now.',
          action: 'publish'
        },
        {
          label: 'Publish and Navigate',
          description: 'Publish new changes and then be redirected to it.',
          action: 'publish-and-navigate'
        },
        {
          label: 'Save Draft',
          description: 'Save changes as a draft to publish later.',
          action: 'save-draft',
          def: true
        },
        {
          label: 'Save Draft and Navigate',
          description: 'Save changes as a draft to publish later, then be redirected to it.',
          action: 'save-draft-and-navigate'
        }
      ]
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
            return 'Published';
          // Document *has* had changes published this page load, but nothing staged now
          } else if (this.hasBeenPublishedThisPageload && !this.readyToPublish) {
            return 'Updated';
          // Document has been published and has staged changes
          } else {
            return 'Update';
          }
        // Document has never been published and has staged changes
        } else {
          return 'Publish';
        }
      } else {
        // Document has been submitted this page load and has nothing staged
        if (this.hasBeenPublishedThisPageload && !this.readyToPublish) {
          return 'Submitted';
        }
        // Document has been previously published and contributor has staged changes
        if (this.context.lastPublishedAt) {
          return 'Submit Update';
        } else {
        // Document has never been published and has staged changes
          return 'Submit';
        }
      }
    }
  },
  methods: {
    switchEditMode(mode) {
      this.$emit('switchEditMode', mode);
    },
    onDiscardDraft() {
      this.$emit('discard-draft');
    },
    onDismissSubmission() {
      this.$emit('dismiss-submission');
    },
    onPublish() {
      if (!this.context.lastPublishedAt) {
        this.hasBeenPublishedButNotUpdated = true;
      } else {
        this.hasBeenPublishedButNotUpdated = false;
      }
      this.$emit('publish');
      this.hasBeenPublishedThisPageload = true;
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
  & /deep/ .apos-button {
    margin-left: 4px;
  }
}

.apos-admin-bar__control-set__group {
  display: flex;
  align-items: center;
}
</style>
