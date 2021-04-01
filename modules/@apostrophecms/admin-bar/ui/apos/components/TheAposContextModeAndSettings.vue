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
        :disabled="!context.modified"
        :is-modified="context.modified"
        :can-discard-draft="context.modified"
        :is-modified-from-published="context.modified"
        :is-published="!!context.lastPublishedAt"
        :can-save-draft="false"
        @discardDraft="onDiscardDraft"
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
    readyToPublish: Boolean
  },
  emits: [ 'switchEditMode', 'discardDraft', 'publish' ],
  computed: {
    moduleOptions() {
      return window.apos.adminBar;
    },
    contextEditorName() {
      return this.moduleOptions.contextEditorName;
    },
    publishLabel() {
      if (this.customPublishLabel) {
        return this.customPublishLabel;
      } else if (this.context.lastPublishedAt) {
        return 'Publish Changes';
      } else {
        return 'Publish';
      }
    }
  },
  methods: {
    switchEditMode(mode) {
      this.$emit('switchEditMode', mode);
    },
    onDiscardDraft() {
      this.$emit('discardDraft');
    },
    onPublish() {
      this.$emit('publish');
    },
    emitEvent(name) {
      apos.bus.$emit('admin-menu-click', name);
    }
  }
};
</script>
