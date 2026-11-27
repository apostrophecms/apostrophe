<template>
  <div
    class="apos-assistant-steps"
    data-apos-test="assistant-steps"
  >
    <button
      type="button"
      class="apos-assistant-steps__trigger"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="listId"
      data-apos-test="assistant-steps-toggle"
      @click="open = !open"
    >
      <span class="apos-assistant-steps__summary">{{ summary }}</span>
      <AposIndicator
        class="apos-assistant-steps__chevron"
        :class="{ 'apos-assistant-steps__chevron--open': open }"
        icon="chevron-down-icon"
        :icon-size="14"
      />
    </button>
    <ol
      v-show="open"
      :id="listId"
      class="apos-assistant-steps__list"
    >
      <li
        v-for="step in steps"
        :key="step.id"
        class="apos-assistant-steps__step"
        data-apos-test="assistant-step"
      >
        <button
          v-if="opens(step)"
          type="button"
          class="apos-assistant-steps__step-trigger"
          :aria-expanded="opened[step.id] ? 'true' : 'false'"
          @click="toggle(step)"
        >
          <span class="apos-assistant-steps__label">
            {{ step.label ? $t(step.label) : step.name }}
          </span>
          <AposIndicator
            class="apos-assistant-steps__chevron"
            :class="{ 'apos-assistant-steps__chevron--open': opened[step.id] }"
            icon="chevron-down-icon"
            :icon-size="14"
          />
        </button>
        <!-- Nothing to open: the label alone -->
        <span
          v-else
          class="apos-assistant-steps__step-trigger"
        >
          <span class="apos-assistant-steps__label">
            {{ step.label ? $t(step.label) : step.name }}
          </span>
        </span>
        <div
          v-if="opened[step.id]"
          class="apos-assistant-steps__details"
        >
          <p
            v-if="details[step.id] === 'loading'"
            class="apos-assistant-steps__note"
            role="status"
            data-apos-test="assistant-step-loading"
          >
            <AposAssistantThinking />
            <span>{{ $t('aposAssistant:assistantLoading') }}</span>
          </p>
          <p
            v-else-if="details[step.id] === 'failed'"
            class="apos-assistant-steps__note"
            role="status"
            data-apos-test="assistant-step-failed"
          >
            <span>{{ $t('aposAssistant:assistantStepLoadFailed') }}</span>
            <button
              type="button"
              class="apos-assistant-steps__retry"
              data-apos-test="assistant-step-retry"
              @click="load(step)"
            >
              {{ $t('aposAssistant:assistantRetry') }}
            </button>
          </p>
          <template v-else-if="typeof details[step.id] === 'object'">
            <div
              v-if="hasOverview(details[step.id])"
              class="apos-assistant-steps__overview"
            >
              <p
                v-if="details[step.id].failed"
                class="apos-assistant-steps__note"
                data-apos-test="assistant-step-error"
              >
                {{ $t('aposAssistant:assistantStepFailed') }}
              </p>
              <!-- Titles and the model's words are text here, never markup -->
              <ul
                v-if="details[step.id].summary.length"
                class="apos-assistant-steps__summary-list"
                data-apos-test="assistant-step-summary"
              >
                <li
                  v-for="(item, i) in details[step.id].summary"
                  :key="i"
                  class="apos-assistant-steps__summary-item"
                  data-apos-test="assistant-step-summary-item"
                >
                  {{ describe(item) }}
                  <span
                    v-if="showsLocale(item, details[step.id])"
                    class="apos-assistant-steps__locale"
                  >{{ item.locale }}</span>
                </li>
                <li
                  v-if="details[step.id].more"
                  class="apos-assistant-steps__summary-item apos-assistant-steps__summary-item--more"
                >
                  {{ $t('aposAssistant:assistantStepMore', { count: details[step.id].more }) }}
                </li>
              </ul>
            </div>
            <div
              v-if="stepDisplay !== 'summary'"
              class="apos-assistant-steps__data"
              :class="{
                'apos-assistant-steps__data--after': hasOverview(details[step.id])
              }"
              data-apos-test="assistant-step-data"
            >
              <!-- The model's arguments and a tool's result are text here,
                never markup -->
              <div
                v-for="block in getBlocks(step)"
                :key="block.name"
                class="apos-assistant-steps__block"
              >
                <div class="apos-assistant-steps__block-header">
                  <p class="apos-assistant-steps__block-title">
                    {{ $t(block.title) }}
                  </p>
                  <button
                    type="button"
                    class="apos-assistant-steps__copy"
                    :aria-label="$t('aposAssistant:assistantCopy', { title: $t(block.title) })"
                    :title="$t('aposAssistant:assistantCopy', { title: $t(block.title) })"
                    @click="copy(step.id, block)"
                  >
                    <AposIndicator
                      :icon="(copied === `${step.id}:${block.name}`) ? 'check-icon' : 'content-copy-icon'"
                      :icon-size="12"
                    />
                  </button>
                </div>
                <!-- Scrolls, so the keyboard can reach it -->
                <pre
                  class="apos-assistant-steps__code"
                  tabindex="0"
                ><code>{{ block.text }}</code></pre>
              </div>
            </div>
          </template>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import {
  computed, inject, reactive, ref
} from 'vue';
import { createId } from 'apostrophe/lib/beneath.js';
import { useAssistantStore } from '../stores/assistant.js';

// The steps a request took, listed once it ends: each tool call, which the
// editor can open to see what it worked on, read from the server as it
// opens, or what it was given and what came back (`stepDisplay` 'data'),
// or both ('all')
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
});

const COPIED_FOR = 1500;
// The sentence of each action a document or type in a tool's `summary`
// may name (the AI engine's tool `summary` points here), with `title`,
// `type`, `count`, `locale` and `reason`; an item with another action, or
// none, shows bare
const ACTIONS = {
  read: 'aposAssistant:aiStepRead',
  readHistory: 'aposAssistant:aiStepReadHistory',
  readChanges: 'aposAssistant:aiStepReadChanges',
  readUses: 'aposAssistant:aiStepReadUses',
  readTree: 'aposAssistant:aiStepReadTree',
  readFields: 'aposAssistant:aiStepReadFields',
  readGuidance: 'aposAssistant:aiStepReadGuidance',
  lookedThrough: 'aposAssistant:aiStepLookedThrough',
  created: 'aposAssistant:aiStepCreated',
  edited: 'aposAssistant:aiStepEdited',
  published: 'aposAssistant:aiStepPublished',
  alreadyLive: 'aposAssistant:aiStepAlreadyLive',
  addedWidgets: 'aposAssistant:aiStepAddedWidgets',
  movedWidgets: 'aposAssistant:aiStepMovedWidgets',
  removedWidgets: 'aposAssistant:aiStepRemovedWidgets',
  copiedWidgetsFrom: 'aposAssistant:aiStepCopiedWidgetsFrom',
  copiedWidgetsInto: 'aposAssistant:aiStepCopiedWidgetsInto',
  refused: 'aposAssistant:aiStepRefused',
  wentTo: 'aposAssistant:aiStepWentTo',
  lookedAtScreen: 'aposAssistant:aiStepLookedAtScreen',
  showedWidgets: 'aposAssistant:aiStepShowedWidgets',
  openedEditor: 'aposAssistant:aiStepOpenedEditor',
  readInEditor: 'aposAssistant:aiStepReadInEditor',
  editedInEditor: 'aposAssistant:aiStepEditedInEditor',
  lookedAt: 'aposAssistant:aiStepLookedAt',
  savedToMedia: 'aposAssistant:aiStepSavedToMedia',
  comparedLocale: 'aposAssistant:aiStepComparedLocale',
  localized: 'aposAssistant:aiStepLocalized',
  notLocalized: 'aposAssistant:aiStepNotLocalized',
  recordedLocalization: 'aposAssistant:aiStepRecordedLocalization'
};
// A refusal's sentence when its reason is known, the reason's after it
const BECAUSE = {
  refused: 'aposAssistant:aiStepRefusedBecause',
  notLocalized: 'aposAssistant:aiStepNotLocalizedBecause'
};
const REASONS = {
  locked: 'aposAssistant:aiStepReasonLocked',
  forbidden: 'aposAssistant:aiStepReasonForbidden',
  invalid: 'aposAssistant:aiStepReasonInvalid',
  changed: 'aposAssistant:aiStepReasonChanged',
  notfound: 'aposAssistant:aiStepReasonNotFound',
  exists: 'aposAssistant:aiStepReasonExists',
  parentMissing: 'aposAssistant:aiStepReasonParentMissing'
};
// The actions whose sentence names the locale
const LOCALE_ACTIONS = [ 'comparedLocale', 'localized', 'notLocalized',
  'recordedLocalization' ];

const $t = inject('i18n');
// 'summary', 'data' (the arguments and result, for developers) or 'all'
const { stepDisplay } = apos.modules['@apostrophecms/assistant'];
const store = useAssistantStore();
const listId = `apos-assistant-steps-${createId()}`;
const open = ref(true);
const opened = reactive({});
// Each opened step as read: 'loading', 'failed', or `{ summary, more,
// failed, input, output, error }`
const details = reactive({});
const copied = ref(null);
let copiedTimer = null;

const steps = computed(() => props.request.steps || []);

// How long the request worked, or how many steps it took when it hasn't
// ended (it waits for an answer)
const summary = computed(() => {
  const { createdAt, endedAt } = props.request;
  if (!endedAt) {
    return $t('aposAssistant:assistantStepCount', { count: steps.value.length });
  }
  const total = Math.max(1, Math.round((new Date(endedAt) - new Date(createdAt)) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const duration = minutes
    ? $t('aposAssistant:assistantMinutes', {
      minutes,
      seconds
    })
    : $t('aposAssistant:assistantSeconds', { seconds });
  return $t('aposAssistant:assistantThoughtFor', { duration });
});

// A step read with its result or error stays as read; one read before it
// had either is read again when it opens
function toggle(step) {
  opened[step.id] = !opened[step.id];
  const detail = details[step.id];
  const settled = (typeof detail === 'object') &&
    ((detail.output !== null) || (detail.error !== null));
  if (opened[step.id] && (detail !== 'loading') && !settled) {
    load(step);
  }
}

async function load(step) {
  details[step.id] = 'loading';
  try {
    details[step.id] = await store.loadStep(props.request.chatId, props.request._id,
      step.id);
  } catch (e) {
    details[step.id] = 'failed';
  }
}

// A step opens when it has something to show: under 'summary', what it
// worked on or that it failed; otherwise always, its arguments at least
function opens(step) {
  return (stepDisplay !== 'summary') || step.listed;
}

// What happened, or that it failed, shows above any data
function hasOverview(detail) {
  return (stepDisplay !== 'data') && (detail.failed || (detail.summary.length > 0));
}

// A summary item as the panel words it: text translated (an i18n key, or
// plain text passed through) with `title`, `type` and `locale`; a document or type
// as its action's sentence, or bare without a known action
function describe(item) {
  const type = item.type && $t(item.type);
  const locale = item.localeLabel && $t(item.localeLabel);
  if (item.kind === 'text') {
    return $t(item.text, {
      title: item.title,
      type,
      locale
    });
  }
  const key = ACTIONS[item.action];
  if (!key) {
    return (item.kind === 'type') ? type : item.title;
  }
  const reason = REASONS[item.reason];
  return $t((reason && BECAUSE[item.action]) || key, {
    title: item.title,
    type,
    count: item.count ?? 1,
    locale,
    reason: reason && $t(reason)
  });
}

// A document's locale shows when the step worked in more than one, and its
// sentence doesn't name a locale already
function showsLocale(item, detail) {
  if (!item.locale || LOCALE_ACTIONS.includes(item.action)) {
    return false;
  }
  const locales = new Set(detail.summary
    .filter(each => each.kind === 'document')
    .map(each => each.locale));
  return locales.size > 1;
}

function getBlocks(step) {
  const detail = details[step.id];
  if (typeof detail !== 'object') {
    return [];
  }
  return [
    detail.input && {
      name: 'input',
      title: 'aposAssistant:assistantStepArguments',
      text: detail.input
    },
    detail.error && {
      name: 'error',
      title: 'aposAssistant:assistantStepError',
      text: detail.error
    },
    detail.output && {
      name: 'output',
      title: 'aposAssistant:assistantStepResult',
      text: detail.output
    }
  ].filter(Boolean);
}

async function copy(stepId, block) {
  try {
    await navigator.clipboard.writeText(block.text);
  } catch (e) {
    // The text stays selectable
    return;
  }
  copied.value = `${stepId}:${block.name}`;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = null;
  }, COPIED_FOR);
}
</script>

<style lang="scss" scoped>
  .apos-assistant-steps {
    min-width: 0;
  }

  .apos-assistant-steps__trigger,
  .apos-assistant-steps__step-trigger {
    @include apos-button-reset();

    & {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      border-radius: var(--a-border-radius);
      text-align: start;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-assistant-steps__summary,
  .apos-assistant-steps__label {
    @include type-label;

    & {
      min-width: 0;
      color: var(--a-base-1);
      font-weight: var(--a-weight-base);
    }
  }

  .apos-assistant-steps__chevron {
    flex-shrink: 0;
    color: var(--a-base-3);
    opacity: 0;
    transition: opacity 200ms ease, transform 200ms ease;
    transform: rotate(-90deg);
  }

  .apos-assistant-steps__chevron--open {
    transform: rotate(0deg);
  }

  .apos-assistant-steps__trigger:hover .apos-assistant-steps__chevron,
  .apos-assistant-steps__trigger:focus-visible .apos-assistant-steps__chevron,
  .apos-assistant-steps__trigger[aria-expanded='true'] .apos-assistant-steps__chevron,
  .apos-assistant-steps__step-trigger:hover .apos-assistant-steps__chevron,
  .apos-assistant-steps__step-trigger:focus-visible .apos-assistant-steps__chevron,
  .apos-assistant-steps__step-trigger[aria-expanded='true'] .apos-assistant-steps__chevron {
    opacity: 1;
  }

  .apos-assistant-steps__list {
    display: flex;
    flex-direction: column;
    margin: 4px 0 0 3px;
    padding: 0 0 0 12px;
    border-left: 1px solid var(--a-base-8);
    list-style: none;
  }

  .apos-assistant-steps__step-trigger {
    padding: 3px 0;
  }

  .apos-assistant-steps__details {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 4px 0 10px;
  }

  .apos-assistant-steps__note {
    @include type-small;

    & {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      color: var(--a-base-2);
    }
  }

  .apos-assistant-steps__overview,
  .apos-assistant-steps__data {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  // Below the summary, the data reads as a section of its own
  .apos-assistant-steps__data--after {
    margin-top: 6px;
  }

  .apos-assistant-steps__summary-list {
    @include type-small;

    & {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      padding: 0 0 0 16px;
      color: var(--a-text-primary);
      list-style: disc;
      overflow-wrap: anywhere;
    }
  }

  .apos-assistant-steps__summary-item--more {
    color: var(--a-base-2);
    list-style: none;
  }

  .apos-assistant-steps__locale {
    margin-left: 4px;
    color: var(--a-base-3);
    text-transform: uppercase;
  }

  .apos-assistant-steps__retry {
    @include apos-button-reset();

    & {
      color: var(--a-primary);
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 2px;
    }
  }

  .apos-assistant-steps__block {
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--a-base-7) 70%, transparent);
    border-radius: var(--a-border-radius-large);
    background-color: var(--a-background-primary);
  }

  .apos-assistant-steps__block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-right: 4px;
    border-bottom: 1px solid var(--a-base-8);
    background-color: var(--a-base-10);
  }

  .apos-assistant-steps__block-title {
    @include type-small;

    & {
      margin: 0;
      padding: 4px 8px;
      color: var(--a-base-1);
      font-weight: var(--a-weight-bold);
    }
  }

  .apos-assistant-steps__copy {
    @include apos-button-reset();

    & {
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border-radius: var(--a-border-radius);
      color: var(--a-base-4);
      opacity: 0;
      transition: opacity 200ms, color 200ms;
    }

    &:hover {
      color: var(--a-text-primary);
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: 1px;
      opacity: 1;
    }
  }

  .apos-assistant-steps__block:hover .apos-assistant-steps__copy {
    opacity: 1;
  }

  .apos-assistant-steps__code {
    @include type-small;

    & {
      overflow: auto;
      max-height: 220px;
      margin: 0;
      padding: 4px 10px;
      color: var(--a-text-primary);
      line-height: 1.45;
      white-space: pre;
      tab-size: 2;
    }

    &:focus-visible {
      outline: 1px solid var(--a-primary);
      outline-offset: -1px;
    }
  }
</style>
