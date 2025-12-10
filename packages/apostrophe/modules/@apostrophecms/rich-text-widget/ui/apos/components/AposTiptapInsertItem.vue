<template>
  <AposContextMenu
    v-if="menuItem.component && !menuItem.noPopover"
    ref="contextMenu"
    menu-placement="bottom-end"
    :rich-text-menu="true"
    @open="openPopover"
    @close="closePopover"
  >
    <template #button="btnProps">
      <AposTiptapInsertBtn
        :name="name"
        :menu-item="menuItem"
        @click="btnProps.onClick"
      />
    </template>
    <component
      :is="menuItem.component"
      :editor="editor"
      :options="editorOptions"
      @done="closeInsertMenuItem"
      @close="closeInsertMenuItem"
      @before-commands="removeSlash"
    />
  </AposContextMenu>

  <AposTiptapInsertBtn
    v-else
    :name="name"
    :menu-item="menuItem"
    @click="activate()"
  />
  <component
    :is="menuItem.component"
    v-if="isInlineComponentShowed"
    :active="true"
    :editor="editor"
    :options="editorOptions"
    @done="closeInsertMenuItem"
    @close="closeInsertMenuItem"
    @before-commands="removeSlash"
  />
</template>

<script setup>
import { ref, computed } from 'vue';
const props = defineProps({
  name: {
    type: String,
    required: true
  },
  menuItem: {
    type: Object,
    required: true
  },
  editor: {
    type: Object,
    required: true
  },

  editorOptions: {
    type: Object,
    required: true
  }
});
const emit = defineEmits([ 'set-active-insert-menu', 'done' ]);

const isInlineComponentActive = ref(false);
const contextMenu = ref(null);
const isInlineComponentShowed = computed(() => {
  return Boolean(props.menuItem.noPopover &&
    props.menuItem.component &&
    isInlineComponentActive.value);
});

function activate() {
  if (props.menuItem.component) {
    emit('set-active-insert-menu', true);
    isInlineComponentActive.value = true;
    return;
  }

  // Select the / and remove it
  removeSlash();
  props.editor.commands[props.menuItem.action || props.name]();
  props.editor.commands.focus();
}

function removeSlash() {
  const state = props.editor.state;
  const { $to } = state.selection;
  if (state.selection.empty && $to?.nodeBefore?.text) {
    const text = $to.nodeBefore.text;
    if (text.slice(-1) === '/') {
      const pos = props.editor.view.state.selection.$anchor.pos;
      // Select the slash so an insert operation can replace it
      props.editor.commands.setTextSelection({
        from: pos - 1,
        to: pos
      });
      props.editor.commands.deleteSelection();
    }
  }
}

function closeInsertMenuItem() {
  removeSlash();
  emit('set-active-insert-menu', false);
  isInlineComponentActive.value = false;
  if (contextMenu.value) {
    contextMenu.value.hide();
  }
}

function openPopover() {
  emit('set-active-insert-menu', true);
}
function closePopover() {
  emit('set-active-insert-menu', false);
}
</script>

<style lang="scss">
  .apos-button--rich-text .apos-button__icon {
    transition: all 300ms var(--a-transition-timing-bounce);
  }

  .apos-rich-text-insert-menu-label {
    display: flex;
    flex-direction: column;
    gap: 5px;

    h4, p {
      margin: 0;
      font-family: var(--a-family-default);
    }

    h4 {
      font-weight: 500;
      font-size: var(--a-type-large);
    }

    p {
      font-size: var(--a-type-label);
    }
  }
</style>
