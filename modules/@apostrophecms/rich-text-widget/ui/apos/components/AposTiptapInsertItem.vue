<template>
  <AposContextMenu
    v-if="props.menuItem.modal"
    menu-placement="bottom-end"
    :keep-open-under-modals="true"
    @open="openModal"
    @close="closeModal"
  >
    <template #button>
      <AposTiptapInsertBtn
        :name="props.name"
        :menu-item="props.menuItem"
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
    :name="props.name"
    :menu-item="props.menuItem"
    @click="activate()"
  />
  <component
    :is="menuItem.component"
    v-if="isComponentShowed"
    :active="true"
    :editor="editor"
    :options="editorOptions"
    @done="closeInsertMenuItem"
    @close="closeInsertMenuItem"
    @before-commands="removeSlash"
  />
</template>

      <!-- @cancel="cancelInsertMenuItem" -->
      <!-- @done="closeInsertMenuItem" -->
      <!-- @close="closeInsertMenuItem" -->

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
  activeMenuComponent: {
    type: Object,
    default: null
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
const emit = defineEmits([ 'cancel', 'done', 'close', 'set-active-insert-menu' ]);

const isComponentActive = ref(false);
const isComponentShowed = computed(() => {
  return !props.menuItem.modal &&
    props.menuItem.component &&
    isComponentActive.value;
});

function activate() {
  if (props.menuItem.component) {
    emit('set-active-insert-menu', true);
    isComponentActive.value = true;
  } else {
  // Select the / and remove it
    removeSlash();
    props.editor.commands[props.menuItem.action || props.name]();
    props.editor.commands.focus();
  }
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
  isComponentActive.value = false;
}

function openModal() {
  emit('set-active-insert-menu', true);
}
function closeModal() {
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
