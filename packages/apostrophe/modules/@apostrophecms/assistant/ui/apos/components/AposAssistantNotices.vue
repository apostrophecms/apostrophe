<template>
  <AposAssistantActivity
    v-for="notice in notices"
    :key="notice._id"
    :tone="TONES[notice.tone] || 'general'"
    :title="$t(notice.title, notice.interpolate)"
    :text="notice.text ? $t(notice.text, notice.interpolate) : null"
    :actions="getActions(notice)"
    data-apos-test="assistant-notice"
    @action="name => act(notice, name)"
  />
</template>

<script setup>
import { computed, inject } from 'vue';
import { useAssistantStore } from '../stores/assistant.js';

// The notices a request's tools posted ("Saved to Media", "Not saved to
// Media"), every one shown the same way: its document opens in its editor,
// and its action runs once as a request of its own. The panel knows
// nothing of the tool behind them
const props = defineProps({
  request: {
    type: Object,
    required: true
  },
  // Only the notices of this tool call, else every one
  callId: {
    type: String,
    default: null
  }
});
const TONES = {
  success: 'general',
  error: 'error'
};

const $t = inject('i18n');
const store = useAssistantStore();
const notices = computed(() => (props.request.notices || [])
  .filter(notice => !props.callId || (notice.callId === props.callId)));
// Another request is open: an action waits for it, as a send does
const busy = computed(() => Boolean(store.getChat(props.request.chatId)?.openRequest));

function getActions(notice) {
  const actions = [];
  if (notice.link) {
    actions.push({
      name: 'link',
      label: $t(notice.link.label)
    });
  }
  if (notice.action) {
    actions.push({
      name: 'action',
      label: $t(notice.action.label),
      disabled: Boolean(notice.action.pending) || busy.value,
      busy: Boolean(notice.action.pending)
    });
  }
  return actions;
}

function act(notice, name) {
  if (name === 'link') {
    apos.doc.edit({
      type: notice.link.type,
      _id: notice.link._id
    });
  } else if ((name === 'action') && notice.action && !notice.action.pending) {
    store.runNoticeAction(props.request.chatId, props.request, notice);
  }
}
</script>
