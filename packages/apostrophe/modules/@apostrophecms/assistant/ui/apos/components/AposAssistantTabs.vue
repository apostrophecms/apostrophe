<template>
  <div class="apos-assistant-tabs">
    <div
      class="apos-assistant-tabs__scroll"
      role="group"
      :aria-label="$t('apostrophe:assistantChatTabs')"
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
          type="button"
          class="apos-assistant-tabs__select"
          :aria-current="tab.active ? 'true' : undefined"
          @click="store.activate(tab.id)"
        >
          <AposAssistantThinking v-if="tab.thinking" />
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
          :aria-label="$t('apostrophe:assistantCloseTab', { title: tab.title })"
          data-apos-test="assistant-tab-close"
          @click="store.closeTab(tab.id)"
        >
          ×
        </button>
      </div>
    </div>
    <div class="apos-assistant-tabs__actions">
      <button
        v-apos-tooltip="'apostrophe:assistantNewChat'"
        type="button"
        class="apos-assistant-tabs__action"
        :aria-label="$t('apostrophe:assistantNewChat')"
        data-apos-test="assistant-new-chat"
        @click="store.newChat()"
      >
        <AposIndicator
          icon="plus-icon"
          :icon-size="14"
        />
      </button>
      <button
        ref="menuButton"
        v-apos-tooltip="'apostrophe:assistantAllChats'"
        type="button"
        class="apos-assistant-tabs__action"
        :class="{ 'apos-assistant-tabs__action--open': menuOpen }"
        :aria-label="$t('apostrophe:assistantAllChats')"
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
  computed, inject, ref
} from 'vue';
import { useAssistantStore, NEW_CHAT } from '../stores/assistant.js';

// The chat tabs of this browser tab, with New chat and All chats
const $t = inject('i18n');
const store = useAssistantStore();
const menuOpen = ref(false);
const menuButton = ref(null);

const tabs = computed(() => store.tabs.map(id => {
  const chat = store.getChat(id);
  return {
    id,
    title: getTitle(id, chat),
    active: id === store.activeId,
    thinking: [ 'running', 'stopping' ].includes(chat?.openRequest?.status)
  };
}));

function closeMenu({ focus }) {
  menuOpen.value = false;
  if (focus) {
    menuButton.value?.focus();
  }
}

function getTitle(id, chat) {
  if ((id === NEW_CHAT) || !chat?.title) {
    return $t('apostrophe:assistantNewChat');
  }
  return chat.title;
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
      flex-shrink: 0;
      padding: 0 8px 0 2px;
      color: var(--a-base-3);
      line-height: 1;
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
