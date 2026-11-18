<template>
  <div
    ref="root"
    class="apos-assistant-menu"
    data-apos-test="assistant-chat-menu"
    @keydown.esc.prevent="emit('close', { focus: true })"
    @keyup.esc.stop
  >
    <ul
      v-if="rows.length"
      class="apos-assistant-menu__list"
    >
      <li
        v-for="row in rows"
        :key="row._id"
        class="apos-assistant-menu__row"
        :class="{
          'apos-assistant-menu__row--active': row.active,
          'apos-assistant-menu__row--editing': editingId === row._id,
          'apos-assistant-menu__row--confirming': confirmingId === row._id
        }"
        data-apos-test="assistant-chat-row"
        :data-apos-chat-id="row._id"
      >
        <input
          v-if="editingId === row._id"
          ref="renameInput"
          v-model="title"
          type="text"
          class="apos-assistant-menu__rename"
          maxlength="60"
          :aria-label="$t('apostrophe:assistantChatName')"
          data-apos-test="assistant-rename-input"
          @keydown.enter.prevent="saveRename({ focus: true })"
          @keydown.esc.stop.prevent="cancelRename"
          @blur="saveRename()"
        >
        <div
          v-else-if="confirmingId === row._id"
          class="apos-assistant-menu__confirm"
          role="group"
          :aria-label="$t('apostrophe:assistantDeleteConfirm')"
        >
          <div class="apos-assistant-menu__confirm-line">
            <p class="apos-assistant-menu__confirm-copy">
              {{ $t('apostrophe:assistantDeleteConfirm') }}
            </p>
            <button
              type="button"
              class="apos-assistant-menu__text-button apos-assistant-menu__text-button--yes"
              data-apos-test="assistant-delete-yes"
              @click="confirmDelete(row)"
            >
              {{ $t('apostrophe:yes') }}
            </button>
            <button
              ref="noButton"
              type="button"
              class="apos-assistant-menu__text-button"
              data-apos-test="assistant-delete-no"
              @click="cancelDelete(row)"
              @keydown.esc.stop.prevent="cancelDelete(row)"
            >
              {{ $t('apostrophe:no') }}
            </button>
          </div>
          <p class="apos-assistant-menu__note">
            {{ $t('apostrophe:assistantDeleteNote') }}
          </p>
        </div>
        <template v-else>
          <button
            :ref="el => setRef(row._id, 'open', el)"
            type="button"
            class="apos-assistant-menu__open"
            :aria-current="row.active ? 'true' : undefined"
            data-apos-test="assistant-chat-open"
            @click="open(row)"
          >
            {{ row.title }}
          </button>
          <span class="apos-assistant-menu__actions">
            <button
              :ref="el => setRef(row._id, 'rename', el)"
              v-apos-tooltip="'apostrophe:assistantRename'"
              type="button"
              class="apos-assistant-menu__icon"
              :aria-label="$t('apostrophe:assistantRenameChat', { title: row.title })"
              data-apos-test="assistant-rename"
              @click="startRename(row)"
            >
              <AposIndicator
                icon="pencil-outline-icon"
                :icon-size="14"
              />
            </button>
            <button
              :ref="el => setRef(row._id, 'delete', el)"
              v-apos-tooltip="row.running
                ? 'apostrophe:assistantDeleteRunning'
                : 'apostrophe:assistantDelete'"
              type="button"
              class="apos-assistant-menu__icon"
              :aria-disabled="row.running ? 'true' : undefined"
              :aria-label="$t('apostrophe:assistantDeleteChat', { title: row.title })"
              data-apos-test="assistant-delete"
              @click="startDelete(row)"
            >
              <AposIndicator
                icon="trash-can-outline-icon"
                :icon-size="14"
              />
            </button>
          </span>
        </template>
        <p
          v-if="refusal?.id === row._id"
          class="apos-assistant-menu__refusal"
          role="status"
          data-apos-test="assistant-menu-refused"
        >
          {{ $t(refusal.text) }}
        </p>
      </li>
    </ul>
    <p
      v-else-if="store.chatsFailed"
      class="apos-assistant-menu__status"
      role="status"
      data-apos-test="assistant-menu-failed"
    >
      <span>{{ $t('apostrophe:assistantChatsFailed') }}</span>
      <button
        type="button"
        class="apos-assistant-menu__text-button"
        data-apos-test="assistant-menu-reload"
        @click="store.catchUp()"
      >
        {{ $t('apostrophe:assistantRetry') }}
      </button>
    </p>
    <p
      v-else-if="!store.loaded"
      class="apos-assistant-menu__status"
      role="status"
      data-apos-test="assistant-menu-loading"
    >
      <AposAssistantThinking />
      <span>{{ $t('apostrophe:assistantLoadingChats') }}</span>
    </p>
    <button
      type="button"
      class="apos-assistant-menu__new"
      data-apos-test="assistant-menu-new-chat"
      @click="newChat"
    >
      {{ $t('apostrophe:assistantNewChat') }}
    </button>
  </div>
</template>

<script setup>
import {
  computed, nextTick, onBeforeUnmount, onMounted, ref
} from 'vue';
import { useAssistantStore } from '../stores/assistant.js';

// All chats: open one, start a new one, rename or delete one in its row
const props = defineProps({
  // The control that toggles the menu: a click on it is not "outside"
  ignore: {
    type: Object,
    default: null
  }
});
const emit = defineEmits([ 'close' ]);

const store = useAssistantStore();
const root = ref(null);
const renameInput = ref(null);
const noButton = ref(null);
const editingId = ref(null);
const title = ref('');
const confirmingId = ref(null);
// Why the row's last rename or delete didn't go through: `{ id, text }`
const refusal = ref(null);
const controls = new Map();

const rows = computed(() => store.getChats().map(chat => ({
  _id: chat._id,
  title: chat.title || '',
  active: chat._id === store.activeId,
  running: [ 'running', 'stopping' ].includes(chat.openRequest?.status)
})));

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true);
});

function onPointerDown(event) {
  const path = event.composedPath();
  if (path.includes(root.value) || (props.ignore && path.includes(props.ignore))) {
    return;
  }
  emit('close', { focus: false });
}

function setRef(id, name, el) {
  const key = `${id}:${name}`;
  if (el) {
    controls.set(key, el);
  } else {
    controls.delete(key);
  }
}

async function focusControl(id, name) {
  await nextTick();
  controls.get(`${id}:${name}`)?.focus();
}

function open(row) {
  store.openChat(row._id);
  emit('close', { focus: false });
}

function newChat() {
  store.newChat();
  emit('close', { focus: false });
}

async function startRename(row) {
  confirmingId.value = null;
  refusal.value = null;
  editingId.value = row._id;
  title.value = row.title;
  await nextTick();
  const [ input ] = renameInput.value || [];
  input?.focus();
  input?.select();
}

// Leaving the field saves, as Enter does; an empty field keeps the title.
// The new title shows at once; one the server didn't take gives way to the
// old one
async function saveRename({ focus = false } = {}) {
  const id = editingId.value;
  if (!id) {
    return;
  }
  editingId.value = null;
  const clean = title.value.replace(/\s+/g, ' ').trim();
  const chat = store.getChat(id);
  if (focus) {
    focusControl(id, 'rename');
  }
  if (clean && chat && (clean !== chat.title)) {
    refuse(id, await store.rename(id, clean));
  }
}

function cancelRename() {
  const id = editingId.value;
  editingId.value = null;
  focusControl(id, 'rename');
}

async function startDelete(row) {
  editingId.value = null;
  if (row.running) {
    refuse(row._id, 'running');
    return;
  }
  refusal.value = null;
  confirmingId.value = row._id;
  await nextTick();
  const [ button ] = noButton.value || [];
  button?.focus();
}

function cancelDelete(row) {
  confirmingId.value = null;
  focusControl(row._id, 'delete');
}

// The row leaves at once, and returns where it was if the server doesn't
// take it
async function confirmDelete(row) {
  confirmingId.value = null;
  const reason = await store.remove(row._id);
  if (reason) {
    refuse(row._id, reason);
    focusControl(row._id, 'delete');
  }
}

function refuse(id, reason) {
  const texts = {
    running: 'apostrophe:assistantDeleteRunning',
    noAnswer: 'apostrophe:assistantNotDoneNoAnswer'
  };
  refusal.value = texts[reason]
    ? {
      id,
      text: texts[reason]
    }
    : null;
}
</script>

<style lang="scss" scoped>
  .apos-assistant-menu {
    z-index: $z-index-manager-toolbar;
    position: absolute;
    top: calc(100% + 5px);
    right: 0;
    display: flex;
    flex-direction: column;
    width: 280px;
    padding: 5px;
    border: 1px solid color-mix(in srgb, var(--a-base-7) 60%, transparent);
    max-width: calc(100vw - 32px);
    max-height: 360px;
    border-radius: var(--a-border-radius-large);
    background-color: var(--a-background-primary);
    box-shadow: var(--a-box-shadow);
  }

  .apos-assistant-menu__status {
    @include type-base;

    & {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 8px 10px;
      color: var(--a-base-2);
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-menu__list {
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .apos-assistant-menu__row {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    border-radius: var(--a-border-radius);

    &:hover,
    &:focus-within {
      background-color: var(--a-base-10);
    }
  }

  .apos-assistant-menu__row--active,
  .apos-assistant-menu__row--active:hover,
  .apos-assistant-menu__row--active:focus-within {
    background-color: var(--a-base-9);
  }

  .apos-assistant-menu__row--editing,
  .apos-assistant-menu__row--editing:hover {
    padding: 2px 0;
    background-color: transparent;
  }

  .apos-assistant-menu__row--confirming,
  .apos-assistant-menu__row--confirming:hover {
    background-color: var(--a-base-10);
  }

  .apos-assistant-menu__open {
    @include apos-button-reset();
    @include type-base;

    & {
      overflow: hidden;
      flex: 1;
      min-width: 0;
      padding: 7px 10px;
      color: var(--a-text-primary);
      line-height: var(--a-line-tall);
      white-space: nowrap;
      text-align: left;
      text-overflow: ellipsis;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: -1px;
    }
  }

  .apos-assistant-menu__row--active .apos-assistant-menu__open {
    color: var(--a-primary);
  }

  .apos-assistant-menu__actions {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    padding-right: 6px;
    opacity: 0;
  }

  .apos-assistant-menu__row:hover .apos-assistant-menu__actions,
  .apos-assistant-menu__row:focus-within .apos-assistant-menu__actions {
    opacity: 1;
  }

  .apos-assistant-menu__icon {
    @include apos-button-reset();

    & {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: var(--a-border-radius);
      color: var(--a-base-1);
    }

    &:hover {
      color: var(--a-text-primary);
      background-color: var(--a-base-8);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
    }

    &[aria-disabled='true'],
    &[aria-disabled='true']:hover {
      background-color: transparent;
      opacity: 0.35;
      cursor: default;
    }
  }

  .apos-assistant-menu__rename {
    @include type-base;

    & {
      flex: 1;
      min-width: 0;
      margin: 0 4px;
      padding: 6px 9px;
      border: 1px solid var(--a-primary);
      border-radius: var(--a-border-radius);
      color: var(--a-text-primary);
      background-color: var(--a-background-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--a-primary) 14%, transparent);
      line-height: var(--a-line-tall);
    }

    &:focus {
      outline: none;
    }
  }

  .apos-assistant-menu__confirm {
    width: 100%;
    padding: 6px 10px;
  }

  .apos-assistant-menu__confirm-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .apos-assistant-menu__confirm-copy {
    @include type-base;

    & {
      overflow: hidden;
      flex: auto;
      min-width: 0;
      margin: 0;
      color: var(--a-text-primary);
      line-height: var(--a-line-tall);
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .apos-assistant-menu__text-button {
    @include apos-button-reset();
    @include type-base;

    & {
      padding: 2px 6px;
      border-radius: var(--a-border-radius);
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
      transition: background-color 200ms, color 200ms;
    }

    &:hover {
      color: var(--a-text-primary);
      background-color: var(--a-base-9);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  // The theme's red, darkened to read at 4.5:1
  .apos-assistant-menu__text-button--yes {
    color: color-mix(in srgb, var(--a-danger) 80%, var(--a-black));

    &:hover {
      color: color-mix(in srgb, var(--a-danger) 80%, var(--a-black));
      background-color: var(--a-danger-button-background);
    }
  }

  .apos-assistant-menu__note,
  .apos-assistant-menu__refusal {
    @include type-small;

    & {
      margin: 4px 0 0;
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
    }
  }

  .apos-assistant-menu__refusal {
    width: 100%;
    margin: 0;
    padding: 0 10px 7px;
  }

  .apos-assistant-menu__new {
    @include apos-button-reset();
    @include type-base;

    & {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 7px 10px;
      border-top: 1px solid var(--a-base-8);
      color: var(--a-base-1);
      line-height: var(--a-line-tall);
      text-align: left;
    }

    &:hover {
      color: var(--a-text-primary);
      background-color: var(--a-base-10);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: -1px;
    }
  }

  .apos-assistant-menu__list:empty + .apos-assistant-menu__new,
  .apos-assistant-menu > .apos-assistant-menu__new:first-child {
    margin-top: 0;
    border-top: 0;
  }
</style>
