<template>
  <div class="apos-assistant-tabs">
    <div
      ref="strip"
      class="apos-assistant-tabs__scroll"
      :class="{
        'apos-assistant-tabs__scroll--before': hidden.before,
        'apos-assistant-tabs__scroll--after': hidden.after
      }"
      role="group"
      :aria-label="$t('aposAssistant:assistantChatTabs')"
      @wheel="onWheel"
      @scroll.passive="measure"
    >
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="apos-assistant-tabs__tab"
        :class="{
          'apos-assistant-tabs__tab--active': tab.active,
          'apos-assistant-tabs__tab--thinking': tab.thinking
        }"
        data-apos-test="assistant-tab"
        :data-apos-chat-id="tab.id"
      >
        <button
          v-apos-tooltip="tab.waiting || tab.title"
          type="button"
          class="apos-assistant-tabs__select"
          :aria-current="tab.active ? 'true' : undefined"
          @click="select(tab.id)"
        >
          <!-- Paused until the editor comes to it or the screen is free -->
          <svg
            v-if="tab.waiting"
            class="apos-assistant-tabs__icon apos-assistant-tabs__icon--waiting"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            role="img"
            :aria-label="tab.waiting"
            data-apos-test="assistant-tab-waiting"
          >
            <path
              d="M8 5h3v14H8zM13 5h3v14h-3z"
              fill="currentColor"
            />
          </svg>
          <AposAssistantThinking
            v-else-if="tab.thinking"
            :label="$t('aposAssistant:assistantRunning')"
          />
          <AposIndicator
            v-else
            class="apos-assistant-tabs__icon"
            icon="chat-outline-icon"
            :icon-size="12"
          />
          <span class="apos-assistant-tabs__label">{{ tab.title }}</span>
        </button>
        <button
          type="button"
          class="apos-assistant-tabs__close"
          :aria-label="$t('aposAssistant:assistantCloseTab', { title: tab.title })"
          data-apos-test="assistant-tab-close"
          @click="closeTab(tab.id)"
        >
          <AposIndicator
            icon="close-icon"
            :icon-size="12"
          />
        </button>
      </div>
    </div>
    <div class="apos-assistant-tabs__actions">
      <button
        v-apos-tooltip="'aposAssistant:assistantNewChat'"
        type="button"
        class="apos-assistant-tabs__action"
        :aria-label="$t('aposAssistant:assistantNewChat')"
        data-apos-test="assistant-new-chat"
        @click="newChat"
      >
        <AposIndicator
          icon="plus-icon"
          :icon-size="14"
        />
      </button>
      <button
        ref="menuButton"
        v-apos-tooltip="'aposAssistant:assistantAllChats'"
        type="button"
        class="apos-assistant-tabs__action"
        :class="{ 'apos-assistant-tabs__action--open': menuOpen }"
        :aria-label="$t('aposAssistant:assistantAllChats')"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        data-apos-test="assistant-all-chats"
        @click="menuOpen = !menuOpen"
      >
        <AposIndicator
          icon="format-list-bulleted-icon"
          :icon-size="14"
        />
      </button>
      <AposAssistantChatMenu
        v-if="menuOpen"
        :ignore="menuButton"
        @close="closeMenu"
      />
    </div>
  </div>
</template>

<script setup>
import {
  computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch
} from 'vue';
import { useAssistantStore, NEW_CHAT } from '../stores/assistant.js';
import { getChatTitle } from '../lib/chat-title.js';

// The chat tabs of this browser tab, with New chat and All chats
const $t = inject('i18n');
const store = useAssistantStore();
const menuOpen = ref(false);
const menuButton = ref(null);
const strip = ref(null);

// The active chat tab in view, wherever the strip is scrolled
watch(() => store.activeId, async () => {
  await nextTick();
  strip.value?.querySelector('.apos-assistant-tabs__tab--active')
    ?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest'
    });
});

// Which ends of the strip hide tabs, for its fades
const hidden = ref({
  before: false,
  after: false
});
let resizeObserver;

onMounted(() => {
  resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(strip.value);
  measure();
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(() => store.tabs.length, async () => {
  await nextTick();
  measure();
});

function measure() {
  const el = strip.value;
  if (!el) {
    return;
  }
  hidden.value = {
    before: el.scrollLeft > 0,
    after: el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  };
}

// A mouse wheel scrolls the strip sideways; a trackpad already does
function onWheel(event) {
  const el = strip.value;
  if (!el || (el.scrollWidth <= el.clientWidth) ||
    (Math.abs(event.deltaX) >= Math.abs(event.deltaY))) {
    return;
  }
  event.preventDefault();
  el.scrollLeft += event.deltaY;
}

const tabs = computed(() => store.tabs.map(id => {
  const chat = store.getChat(id);
  const step = store.getBrowserStep(chat);
  return {
    id,
    title: getTitle(id, chat),
    active: id === store.activeId,
    thinking: [ 'running', 'stopping' ].includes(chat?.openRequest?.status) || Boolean(step),
    waiting: getWaiting(step)
  };
}));

// What a chat tab's browser step waits on: the editor's attention, with what
// it will do once they come, or the screen
function getWaiting(step) {
  if (step?.state === 'attention') {
    return step.label
      ? $t('aposAssistant:assistantWaitingForYouTo', { action: $t(step.label) })
      : $t('aposAssistant:assistantWaitingForYou');
  }
  if (step?.state === 'hold') {
    return $t('aposAssistant:assistantWaiting');
  }
  return null;
}

function select(id) {
  store.activate(id);
  store.focusComposer();
}

function newChat() {
  store.newChat();
  store.focusComposer();
}

// Its × leaves with it: focus goes to the composer of the chat tab that
// takes its place
function closeTab(id) {
  store.closeTab(id);
  store.focusComposer();
}

function closeMenu({ focus }) {
  menuOpen.value = false;
  if (focus) {
    menuButton.value?.focus();
  }
}

function getTitle(id, chat) {
  if (id === NEW_CHAT) {
    return $t('aposAssistant:assistantNewChat');
  }
  // A chat not read yet keeps the title it last showed
  return store.getTabTitle(id) || getChatTitle(chat, $t) ||
    $t(chat ? 'aposAssistant:assistantNewChat' : 'aposAssistant:assistantLoading');
}
</script>

<style lang="scss" scoped>
  .apos-assistant-tabs {
    display: flex;
    flex-shrink: 0;
    align-items: stretch;
    border-top: 1px solid var(--a-base-8);
    border-bottom: 1px solid var(--a-base-8);
  }

  .apos-assistant-tabs__scroll {
    display: flex;
    flex: 1;
    align-items: stretch;
    min-width: 0;
    margin-bottom: -1px;
    padding-bottom: 1px;
    overflow-x: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  // Tabs out of view fade at the end that hides them
  .apos-assistant-tabs__scroll--before {
    mask-image: linear-gradient(to right, transparent, #000 32px);
  }

  .apos-assistant-tabs__scroll--after {
    mask-image: linear-gradient(to left, transparent, #000 32px);
  }

  .apos-assistant-tabs__scroll--before.apos-assistant-tabs__scroll--after {
    mask-image: linear-gradient(to right, transparent, #000 32px, #000 calc(100% - 32px), transparent);
  }

  .apos-assistant-tabs__tab {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    max-width: 150px;
    border-right: 1px solid var(--a-base-8);
    color: var(--a-base-1);
    background-color: var(--a-base-10);
    transition: color 200ms, background-color 200ms;

    &:hover:not(.apos-assistant-tabs__tab--active) {
      color: var(--a-text-primary);
      background-color: var(--a-base-9);
    }
  }

  .apos-assistant-tabs__tab--active {
    z-index: $z-index-default;
    color: var(--a-text-primary);
    background-color: var(--a-background-primary);

    // The active chat tab opens into the thread below it
    &::after {
      content: '';
      position: absolute;
      right: 0;
      bottom: -1px;
      left: 0;
      height: 1px;
      background-color: var(--a-background-primary);
    }
  }

  .apos-assistant-tabs__select {
    @include apos-button-reset();
    @include type-base;

    & {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      padding: 6px 4px 6px 10px;
      color: inherit;
      line-height: var(--a-line-tall);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: -2px;
    }
  }

  .apos-assistant-tabs__icon--waiting {
    color: var(--a-warning-dark);
  }

  .apos-assistant-tabs__icon {
    flex-shrink: 0;
  }

  .apos-assistant-tabs__label {
    overflow: hidden;
    min-width: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .apos-assistant-tabs__close {
    @include apos-button-reset();
    @include type-base;

    & {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      align-self: stretch;
      padding: 0 8px 0 2px;
      color: var(--a-base-3);
      opacity: 0;
      transition: opacity 200ms;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      opacity: 1;
    }
  }

  // As the prototype: shown on hover, and on keyboard focus
  .apos-assistant-tabs__tab:hover .apos-assistant-tabs__close {
    opacity: 1;
  }

  .apos-assistant-tabs__actions {
    z-index: $z-index-manager-display;
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: stretch;
    border-left: 1px solid var(--a-base-8);
    background-color: var(--a-background-primary);
  }

  .apos-assistant-tabs__action {
    @include apos-button-reset();

    & {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      color: var(--a-base-1);
      transition: color 200ms, background-color 200ms;
    }

    &:hover,
    &.apos-assistant-tabs__action--open {
      color: var(--a-text-primary);
      background-color: var(--a-base-9);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: -2px;
    }
  }
</style>
