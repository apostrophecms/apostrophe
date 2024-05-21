<template>
  <transition
    :name="transitionType"
    :duration="250"
    @enter="onEnter"
    @leave="onLeave"
  >
    <section
      v-if="modal.active"
      ref="modalEl"
      :class="classes"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="props.modalId"
      data-apos-modal
      @focus.capture="storeFocusedElement"
      @keydown="onKeydown"
    >
      <transition :name="transitionType">
        <div
          v-if="modal.showModal"
          class="apos-modal__overlay"
          @click="close"
        />
      </transition>
      <transition :name="transitionType" @after-leave="$emit('inactive')">
        <div
          v-if="modal.showModal"
          :class="innerClasses"
          class="apos-modal__inner"
          data-apos-modal-inner
        >
          <template v-if="modal.busy">
            <div class="apos-modal__busy">
              <p class="apos-modal__busy-text">
                {{ modal.busyTitle }}
              </p>
              <AposSpinner :weight="'heavy'" class="apos-busy__spinner" />
            </div>
          </template>
          <template v-else>
            <header v-if="!modal.disableHeader" class="apos-modal__header">
              <div class="apos-modal__header__main">
                <div v-if="hasSlot('secondaryControls')" class="apos-modal__controls--secondary">
                  <slot name="secondaryControls" />
                </div>
                <h2 :id="props.modalId" class="apos-modal__heading">
                  <span v-if="modal.a11yTitle" class="apos-sr-only">
                    {{ $t(modal.a11yTitle) }}
                  </span>
                  {{ $t(modalTitle) }}
                </h2>
                <div v-if="hasBeenLocalized || hasSlot('primaryControls')" class="apos-modal__controls--header">
                  <div v-if="hasBeenLocalized" class="apos-modal__locale">
                    <span class="apos-modal__locale-label">
                      {{ $t('apostrophe:locale') }}:
                    </span> <span class="apos-modal__locale-name">
                      {{ currentLocale }}
                    </span>
                  </div>
                  <div v-if="hasSlot('primaryControls')" class="apos-modal__controls--primary">
                    <slot name="primaryControls" />
                  </div>
                </div>
              </div>
              <div v-if="hasSlot('breadcrumbs')" class="apos-modal__breadcrumbs">
                <slot class="apos-modal__breadcrumbs" name="breadcrumbs" />
              </div>
            </header>
            <div class="apos-modal__main" :class="gridModifier">
              <slot name="leftRail" />
              <slot name="main" />
              <slot name="rightRail" />
            </div>
            <footer v-if="hasSlot('footer')" class="apos-modal__footer">
              <div class="apos-modal__footer__inner">
                <slot name="footer" />
              </div>
            </footer>
          </template>
        </div>
      </transition>
    </section>
  </transition>
</template>

<script setup>
// NOTE:
// To get the desired transition effect, modal props have two properties,
// `active` and `showModal`, which control their visibility. Basically,
// `active` starts the transition process for the overlay and the body of the
// modal, which enter at different speeds. `showModal` is what actually
// displays the modal.
// So as the modal exits, they should change in reverse. `showModal` becomes
// `false`, then `active` is set to `false` once the modal has finished its
// transition.

import {
  ref, onMounted, computed, watch, nextTick, useSlots
} from 'vue';
import { useAposFocus } from 'Modules/@apostrophecms/modal/composables/AposFocus';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';

const {
  cycleElementsToFocus,
  focusElement,
  focusLastModalFocusedElement,
  isElementVisible,
  storeFocusedElement
} = useAposFocus();

const props = defineProps({
  modal: {
    type: Object,
    required: true
  },
  modalTitle: {
    type: [ String, Object ],
    default: ''
  },
  modalId: {
    type: String,
    required: true
  }
});

const store = useModalStore();

const slots = useSlots();
const emit = defineEmits([ 'inactive', 'esc', 'show-modal', 'safe-close', 'no-modal', 'ready' ]);
const modalEl = ref(null);

const transitionType = computed(() => {
  if (props.modal.type !== 'slide') {
    return 'fade';
  }

  if (props.modal.origin === 'left') {
    return 'slide-right';
  }

  return 'slide-left';
});

const shouldTrapFocus = computed(() => {
  return props.modal.trapFocus || props.modal.trapFocus === undefined;
});

const triggerFocusRefresh = computed(() => {
  return props.modal.triggerFocusRefresh;
});

const hasBeenLocalized = computed(() => {
  return Object.keys(apos.i18n.locales).length > 1;
});

const currentLocale = computed(() => {
  return apos.i18n.locale;
});

function hasSlot(slotName) {
  return Boolean(slots[slotName]);
}

const classes = computed(() => {
  const classes = [ 'apos-modal' ];
  classes.push(`apos-modal--${props.modal.type}`);
  if (props.modal.type === 'slide') {
    if (props.modal.origin) {
      classes.push(`apos-modal--origin-${props.modal.origin}`);
    } else {
      classes.push('apos-modal--origin-right');
    }
    classes.push('apos-modal--full-height');
  }
  if (props.modal.busy) {
    classes.push('apos-modal--busy');
  }
  return classes.join(' ');
});

const innerClasses = computed(() => {
  const classes = [];
  if (props.modal.width) {
    classes.push(`apos-modal__inner--${props.modal.width}`);
  };

  return classes;
});

const gridModifier = computed(() => {
  const hasLeftRail = hasSlot('leftRail');
  const hasRightRail = hasSlot('rightRail');

  if (hasLeftRail && hasRightRail) {
    return 'apos-modal__main--with-rails';
  }
  if (hasLeftRail && !hasRightRail) {
    return 'apos-modal__main--with-left-rail';
  }
  if (!hasLeftRail && hasRightRail) {
    return 'apos-modal__main--with-right-rail';
  }
  return false;
});

watch(triggerFocusRefresh, (newVal) => {
  if (shouldTrapFocus.value) {
    nextTick(trapFocus);
  }
});

onMounted(async () => {
  await nextTick();
  if (shouldTrapFocus.value) {
    trapFocus();
  }
  store.updateModalData(props.modalId, { modalEl: modalEl.value });
});

function onKeydown(e) {
  const hasPressedEsc = e.keyCode === 27;
  if (hasPressedEsc) {
    close(e);
  }

  const currentModal = store.get(props.modalId);
  cycleElementsToFocus(e, currentModal.elementsToFocus);
}

async function onEnter() {
  emit('show-modal');

  await nextTick();
  emit('ready');
}

function onLeave() {
  emit('safe-close');
  store.remove(props.modalId);
  focusLastModalFocusedElement();
  emit('no-modal');
}

function trapFocus() {
  const elementSelectors = [
    '[tabindex]',
    '[href]',
    'input',
    'select',
    'textarea',
    'button'
  ];

  const selector = elementSelectors
    .map(addExcludingAttributes)
    .join(', ');

  const elementsToFocus = [ ...modalEl.value.querySelectorAll(selector) ]
    .filter(isElementVisible);

  store.updateModalData(props.modalId, { elementsToFocus });
  const currentModal = store.get(props.modalId);

  focusElement(currentModal.focusedElement, currentModal.elementsToFocus[0]);

  function addExcludingAttributes(element) {
    return `${element}:not([tabindex="-1"]):not([disabled]):not([type="hidden"]):not([aria-hidden])`;
  }
}

function close() {
  emit('esc');
}
</script>

<style lang="scss" scoped>
  // NOTE: Transition timings below are set to match the wrapper transition
  // timing in the template to coordinate the inner and overlay animations.
  .apos-modal__inner {
    z-index: $z-index-modal;
    position: fixed;
    top: $spacing-base;
    right: $spacing-base;
    bottom: $spacing-base;
    left: $spacing-base;
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: calc(100vh - #{$spacing-base * 2});
    border-radius: var(--a-border-radius);
    background-color: var(--a-background-primary);
    border: 1px solid var(--a-base-9);
    color: var(--a-text-primary);

    @include media-up(lap) {
      top: $spacing-double;
      right: $spacing-double;
      bottom: $spacing-double;
      left: $spacing-double;
      height: calc(100vh - #{$spacing-double * 2});
    }

    .apos-modal--slide & {
      position: fixed;
      transition: transform 0.15s ease;
      top: 0;
      bottom: 0;
      transform: translateX(0);
      width: 100%;
      border-radius: 0;
      height: 100vh;

      @media screen and (min-width: 800px) {
        max-width: 540px;
      }
    }

    .apos-modal--origin-right & {
      right: 0;
      left: auto;
    }

    .apos-modal--origin-left & {
      right: auto;
      left: 0;
    }

    &.apos-modal__inner--two-thirds {
      @media screen and (min-width: 800px) {
        max-width: 66%;
      }
    }

    &.apos-modal__inner--half {
      @media screen and (min-width: 800px) {
        max-width: 50%;
      }
    }

    &.apos-modal__inner--full {
      @media screen and (min-width: 800px) {
        max-width: 100%;
      }
    }

    &.slide-left-enter-from,
    &.slide-left-leave-to {
      transform: translateX(100%);
    }

    &.slide-right-enter-from,
    &.slide-right-leave-to {
      transform: translateX(-100%);
    }

    .apos-modal--overlay & {
      transform: scale(1);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }

    &.fade-enter-from,
    &.fade-leave-to {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  .apos-modal--full-height .apos-modal__inner {
    height: 100%;
  }

  .apos-modal__header {
    grid-row: 1 / 2;
  }

  .apos-modal__main {
    display: grid;
    grid-row: 2 / 3;
    overflow-y: auto;
  }

  .apos-modal__overlay {
    z-index: $z-index-modal;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: var(--a-overlay-modal);

    .apos-modal--slide &,
    .apos-modal--overlay & {
      transition: opacity 0.15s ease;
    }

    &.slide-left-enter-from,
    &.slide-left-leave-to,
    &.slide-right-enter-from,
    &.slide-right-leave-to,
    &.fade-enter-from,
    &.fade-leave-to {
      opacity: 0;
    }
  }

  .apos-modal__footer {
    z-index: $z-index-base;
    position: relative;

    &::before {
      content: '';
      z-index: $z-index-base;
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      width: 100%;
      height: 0;
      box-shadow: var(--a-box-shadow);
    }
  }

  .apos-modal__footer__inner,
  .apos-modal__header__main {
    display: flex;
    padding: $spacing-double;
    align-items: center;
  }

  .apos-modal__header__main {
    border-bottom: 1px solid var(--a-base-9);
  }

  .apos-modal__footer {
    grid-row: 3 / 4;
  }

  .apos-modal__footer__inner {
    z-index: $z-index-default;
    position: relative;
    justify-content: space-between;
    padding: 20px;
    background-color: var(--a-white);
  }

  .apos-modal__controls--header,
  .apos-modal__controls--primary,
  .apos-modal__controls--secondary {
    display: flex;
    align-items: center;
  }

  .apos-modal__controls--header {
    justify-content: flex-end;
    flex-grow: 1;
  }
  :deep(.apos-modal__controls--primary) {
    & > .apos-button__wrapper,
    & > .apos-context-menu {
      margin-left: 7.5px;
    }
  }

  .apos-modal__locale {
    @include type-base;
    margin-right: $spacing-double;
    font-weight: var(--a-weight-bold);
  }

  .apos-modal__locale-name {
    color: var(--a-primary);
  }

  .apos-modal__heading {
    @include type-title;
    margin: 0;
  }

  .apos-modal__controls--secondary {
    margin-right: 20px;
  }

  .apos-modal__main--with-rails {
    grid-template-columns: 15% 1fr minmax(200px, 10%);
    @include media-up(lap) {
      grid-template-columns: 15% 1fr minmax(250px, $modal-rail-right-w);
    }
  }

  .apos-modal__main--with-left-rail {
    grid-template-columns: 22% 78%;
  }

  .apos-modal__main--with-right-rail {
    grid-template-columns: 78% $modal-rail-right-w;
  }

  .apos-modal--busy .apos-modal__inner {
    $height: 190px;
    top: 50%;
    bottom: -50%;
    display: flex;
    height: $height;
    transform: translateY(math.div($height, 2) * -1);
    justify-content: center;
    align-items: center;
    text-align: center;
  }

  .apos-modal__busy-text {
    margin-bottom: $spacing-triple;
    font-size: var(--a-type-heading);
  }
</style>
