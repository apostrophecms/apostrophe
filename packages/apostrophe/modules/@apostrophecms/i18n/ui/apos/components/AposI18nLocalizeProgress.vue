<template>
  <div
    class="apos-localizing"
    data-apos-test="localizing"
  >
    <ul class="apos-localizing__locales">
      <li
        v-for="locale in view.locales"
        :key="locale"
        class="apos-localizing__locale"
      >
        <span class="apos-localizing__chip">{{ locale }}</span>
      </li>
    </ul>
    <div>
      <p class="apos-localizing__heading">
        {{ view.heading }}
      </p>
      <!-- Stopped: a message in the error, warning or info tone, then what
           happened, item by item, with the plan's status icons -->
      <template v-if="view.card">
        <div
          ref="card"
          class="apos-localizing__message"
          :class="`apos-localizing__message--${view.card.tone}`"
          role="group"
          aria-labelledby="apos-localizing-message-title"
          tabindex="-1"
          data-apos-test="localizingMessage"
        >
          <p
            id="apos-localizing-message-title"
            class="apos-localizing__message-title"
          >
            {{ view.card.title }}
          </p>
          <p class="apos-localizing__message-text">
            {{ view.card.message }}
          </p>
        </div>
        <ol
          v-if="view.steps?.length"
          class="apos-localizing__plan"
        >
          <li
            v-for="item in view.steps"
            :key="item.id"
            class="apos-localizing__plan-item"
            :class="`apos-localizing__plan-item--${item.status}`"
          >
            <svg
              class="apos-localizing__plan-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path :d="icons[item.status]" />
            </svg>
            <span>
              {{ item.label }}<span class="apos-sr-only">, {{ $t(statusLabels[item.status]) }}</span>
            </span>
            <span
              v-if="item.ai && item.status === 'done'"
              class="apos-localizing__ai apos-localizing__ai--small"
              :aria-label="$t('apostrophe:localizingWithAi')"
            >
              <svg
                class="apos-localizing__ai-spark"
                :viewBox="sparkViewBox"
                aria-hidden="true"
              ><path :d="sparkPath" /></svg>
            </span>
          </li>
        </ol>
      </template>
      <!-- Running: the thinking mark and one phrase at a time -->
      <p
        v-else-if="view.phase === 'running'"
        class="apos-localizing__thinking"
        aria-live="polite"
        data-apos-test="localizingPhrase"
      >
        <span
          class="apos-localizing__thinking-grid"
          aria-hidden="true"
        ><span /><span /><span /><span /></span>
        <span class="apos-localizing__thinking-shell">
          <Transition name="apos-localizing-thought">
            <span
              :key="view.phrase.text"
              class="apos-localizing__phrase"
            >{{ view.phrase.text }}</span>
          </Transition>
        </span>
        <span
          v-if="view.phrase.count"
          class="apos-localizing__count"
        >{{ view.phrase.count }}</span>
      </p>
      <!-- Done: what changed in one line, then the trace, collapsed -->
      <template v-else>
        <p
          class="apos-localizing__summary"
          data-apos-test="localizingSummary"
        >
          {{ view.summary }}
        </p>
        <div class="apos-localizing__trace">
          <button
            type="button"
            class="apos-localizing__trigger"
            :aria-expanded="traceOpen ? 'true' : 'false'"
            @click="traceOpen = !traceOpen"
          >
            <span class="apos-localizing__trace-label">{{ view.elapsed }}</span>
            <svg
              class="apos-localizing__chevron"
              :class="{ 'apos-localizing__chevron--open': traceOpen }"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            ><path
              :d="chevronPath"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg>
          </button>
          <div
            v-if="traceOpen"
            class="apos-localizing__trace-panel"
          >
            <div
              v-for="stage in view.trace"
              :key="stage.id"
            >
              <component
                :is="stage.detail ? 'button' : 'p'"
                :type="stage.detail ? 'button' : undefined"
                class="apos-localizing__trigger apos-localizing__stage"
                :class="{ 'apos-localizing__stage--text': !stage.detail }"
                :aria-expanded="stage.detail
                  ? (openStages[stage.id] ? 'true' : 'false')
                  : undefined"
                @click="stage.detail && (openStages[stage.id] = !openStages[stage.id])"
              >
                <span class="apos-localizing__trace-label">{{ stage.label }}</span>
                <span
                  v-if="stage.ai"
                  class="apos-localizing__ai apos-localizing__ai--small"
                  :aria-label="$t('apostrophe:localizingWithAi')"
                >
                  <svg
                    class="apos-localizing__ai-spark"
                    :viewBox="sparkViewBox"
                    aria-hidden="true"
                  ><path :d="sparkPath" /></svg>
                </span>
                <svg
                  v-if="stage.detail"
                  class="apos-localizing__chevron"
                  :class="{ 'apos-localizing__chevron--open': openStages[stage.id] }"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                ><path
                  :d="chevronPath"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg>
              </component>
              <p
                v-if="openStages[stage.id]"
                class="apos-localizing__detail"
              >
                {{ stage.detail }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </div>
    <p
      v-if="view.help"
      class="apos-localizing__help"
    >
      {{ view.help }}
    </p>
  </div>
</template>

<script>
// The Localizing step of the Localize dialog. It only shows what the dialog
// works out (see `localizingView` in AposI18nLocalize): while the run goes,
// one phrase at a time beside the thinking mark; once done, a summary line
// and a collapsed trace of what was done; when it stops early, a message and
// each item with its status.
//
// The thinking mark, the trace, the message tones and the status icons
// follow the agent chat prototype, as the Localize prototype uses them
// (apostrophecms/design: apps/agent, apps/localize-translate)

// Material Design icons, Apostrophe's own set
const ICONS = {
  done: 'M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z',
  error: 'M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z',
  skipped: 'M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
  pending: 'M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z'
};

export default {
  name: 'AposI18nLocalizeProgress',
  props: {
    // { heading, locales, phase ("running", "done" or "stopped"),
    // phrase: { text, count }, summary, elapsed, trace: [ { id, label, ai,
    // detail } ], card: { tone, title, message }, steps: [ { id, label,
    // status, ai } ], help }
    view: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      traceOpen: false,
      openStages: {},
      icons: ICONS,
      statusLabels: {
        done: 'apostrophe:localizingStatusDone',
        error: 'apostrophe:localizingStatusFailed',
        skipped: 'apostrophe:localizingStatusSkipped',
        pending: 'apostrophe:localizingStatusNotRun'
      },
      chevronPath: 'M6 9l6 6 6-6',
      // The four-point AI sparkle, drawn centered in its box
      sparkPath: 'M12 2.5c.36 2.86 1.02 4.84 2.09 5.9C15.16 9.48 17.14 10.14 20 10.5c-2.86.36-4.84 1.02-5.91 2.09C13.02 13.66 12.36 15.64 12 18.5c-.36-2.86-1.02-4.84-2.09-5.91C8.84 11.52 6.86 10.86 4 10.5c2.86-.36 4.84-1.02 5.91-2.1C10.98 7.34 11.64 5.36 12 2.5Z',
      sparkViewBox: '0 -1.5 24 24'
    };
  },
  watch: {
    // When the run stops early, the message takes focus, so keyboard and
    // screen reader users learn why without looking for it
    async 'view.card'(card, old) {
      if (!card || old) {
        return;
      }
      await this.$nextTick();
      this.$refs.card?.focus({ preventScroll: true });
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-localizing {
  font-family: var(--a-family-default);
}

.apos-localizing__locales {
  margin: 0 0 $spacing-base;
  padding-left: 0;
  list-style-type: none;
}

.apos-localizing__locale {
  display: inline-block;
  margin-bottom: 5px;

  &:not(:last-of-type) {
    margin-right: 5px;
  }
}

.apos-localizing__chip {
  display: inline-block;
  padding: 6px 10px;
  border-radius: var(--a-border-radius);
  background-color: var(--a-primary);
  color: var(--a-white);
  font-size: var(--a-type-small);
  letter-spacing: var(--a-letter-base);
  line-height: 1;
}

// The settings steps' group heading, in a gray readable at 12px
.apos-localizing__heading {
  @include type-base;

  & {
    margin: 0 0 $spacing-base;
    padding-bottom: $spacing-base;
    border-bottom: 1px solid var(--a-base-8);
    color: var(--a-base-1);
  }
}

.apos-localizing__thinking {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 16px;
}

.apos-localizing__thinking-grid {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: repeat(2, 4px);
  grid-template-rows: repeat(2, 4px);
  gap: 1.5px;
  width: 9.5px;
  height: 9.5px;
}

.apos-localizing__thinking-grid span {
  display: block;
  border-radius: 1px;
  background-color: var(--a-primary);
  opacity: 0.15;
  animation: apos-localizing-cell ease-in-out infinite;
}

.apos-localizing__thinking-grid span:nth-child(1) {
  animation-duration: 1050ms;
  animation-delay: 120ms;
}

.apos-localizing__thinking-grid span:nth-child(2) {
  animation-duration: 1380ms;
  animation-delay: 510ms;
}

.apos-localizing__thinking-grid span:nth-child(3) {
  animation-duration: 920ms;
  animation-delay: 740ms;
}

.apos-localizing__thinking-grid span:nth-child(4) {
  animation-duration: 1620ms;
  animation-delay: 230ms;
}

@keyframes apos-localizing-cell {
  0%,
  100% {
    opacity: 0.15;
  }

  50% {
    opacity: 0.9;
  }
}

.apos-localizing__thinking-shell {
  position: relative;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  min-height: calc(var(--a-type-base) * var(--a-line-tall));
}

.apos-localizing__phrase,
.apos-localizing__summary {
  display: block;
  margin: 0;
  color: var(--a-text-primary);
  font-size: var(--a-type-base);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-tall);
}

.apos-localizing__phrase {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.apos-localizing__summary {
  margin-bottom: 12px;
}

.apos-localizing__count {
  flex-shrink: 0;
  color: var(--a-base-1);
  font-size: var(--a-type-base);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-tall);
}

.apos-localizing-thought-enter-active,
.apos-localizing-thought-leave-active {
  transition: opacity 500ms cubic-bezier(0.23, 1, 0.32, 1);
}

.apos-localizing-thought-leave-active {
  position: absolute;
  inset: 0;
}

.apos-localizing-thought-enter-from,
.apos-localizing-thought-leave-to {
  opacity: 0;
}

.apos-localizing__trace {
  margin-bottom: 16px;
}

.apos-localizing__trigger {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  max-width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  font-family: var(--a-family-default);
  text-align: left;
  cursor: pointer;
  appearance: none;
}

.apos-localizing__trigger:focus-visible {
  border-radius: var(--a-border-radius);
  outline: 1px solid var(--a-primary);
  outline-offset: 2px;
}

.apos-localizing__trace-label {
  min-width: 0;
  color: var(--a-base-1);
  font-size: var(--a-type-label);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-tall);
}

.apos-localizing__chevron {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  opacity: 0;
  color: var(--a-base-3);
  transform: rotate(-90deg);
  transition: opacity 200ms ease, transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.apos-localizing__trigger:hover .apos-localizing__chevron,
.apos-localizing__trigger:focus-visible .apos-localizing__chevron,
.apos-localizing__trigger[aria-expanded='true'] .apos-localizing__chevron {
  opacity: 1;
}

.apos-localizing__chevron--open {
  transform: rotate(0deg);
}

.apos-localizing__trace-panel {
  display: flex;
  flex-direction: column;
  margin-top: 4px;
  margin-left: 3px;
  padding-left: 12px;
  border-left: 1px solid var(--a-base-8);
}

.apos-localizing__stage {
  padding: 3px 0;
}

.apos-localizing__stage--text {
  margin: 0;
  cursor: default;
}

.apos-localizing__detail {
  margin: 0 0 10px;
  color: var(--a-base-1);
  font-size: var(--a-type-base);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-tall);
}

// The AI mark: the sparkle in the primary color on a disc
.apos-localizing__ai {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--a-base-8);
  color: var(--a-primary);
  background: var(--a-background-primary);
  border-radius: 999px;
}

.apos-localizing__ai-spark {
  width: 13px;
  height: 13px;
  fill: currentcolor;
}

.apos-localizing__message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: var(--a-border-radius-large);
}

.apos-localizing__message:focus-visible {
  outline: 2px solid var(--a-primary);
  outline-offset: 2px;
}

.apos-localizing__message--warning {
  background-color: color-mix(in srgb, var(--a-warning) 12%, transparent);
}

.apos-localizing__message--error {
  background-color: var(--a-danger-button-background);
}

.apos-localizing__message--info {
  background-color: var(--a-base-10);
}

.apos-localizing__message-title,
.apos-localizing__message-text {
  margin: 0;
  font-size: var(--a-type-base);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-tall);
}

.apos-localizing__message-title {
  color: var(--a-text-primary);
  font-weight: var(--a-weight-bold);
}

.apos-localizing__message-text {
  color: var(--a-base-1);
}

.apos-localizing__plan {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.apos-localizing__plan-item {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--a-text-primary);
  font-size: var(--a-type-base);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-tall);
}

.apos-localizing__plan-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 2px;
}

.apos-localizing__plan-item--done .apos-localizing__plan-icon {
  color: var(--a-success-dark);
}

.apos-localizing__plan-item--error .apos-localizing__plan-icon {
  color: var(--a-danger);
}

.apos-localizing__plan-item--skipped .apos-localizing__plan-icon {
  color: var(--a-warning-dark);
}

.apos-localizing__plan-item--pending {
  color: var(--a-base-2);
}

.apos-localizing__plan-item--pending .apos-localizing__plan-icon {
  color: var(--a-base-5);
}

.apos-localizing__help {
  margin: 12px 0 0;
  color: var(--a-base-1);
  font-size: var(--a-type-base);
  letter-spacing: var(--a-letter-base);
  line-height: var(--a-line-tall);
}
</style>
