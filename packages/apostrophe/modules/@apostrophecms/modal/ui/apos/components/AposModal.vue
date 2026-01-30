<template>
  <transition
    :name="transitionType"
    :duration="250"
    @enter="onEnter"
    @leave="onLeave"
  >
    <section
      v-show="modal.active"
      ref="modalEl"
      :class="classes"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="props.modalData.id"
      data-apos-modal
      tabindex="0"
      @focus.capture="captureFocus"
      @keyup.tab="onKeyup"
      @keyup.esc="onKeyup"
    >
      <transition :name="transitionType">
        <div
          v-if="modal.showModal"
          :class="[
            'apos-modal__overlay',
            { [`apos-modal__overlay--${modal.overlay}`]: modal.overlay }
          ]"
          @click="emit('esc')"
        />
      </transition>
      <transition
        :name="transitionType"
        @after-leave="$emit('inactive')"
      >
        <div
          v-if="modal.showModal"
          ref="modalInnerEl"
          class="apos-modal__inner"
          :class="innerClasses"
          :style="isWindowModal ? windowStyle : {}"
          data-apos-modal-inner
          @mousedown="startDragging"
        >
          <template v-if="modal.busy">
            <div class="apos-modal__busy">
              <p class="apos-modal__busy-text">
                {{ modal.busyTitle }}
              </p>
              <AposSpinner
                :weight="'heavy'"
                class="apos-busy__spinner"
              />
            </div>
          </template>
          <div
            v-show="!renderingElements && !modal.busy"
            class="apos-modal__content"
            data-apos-test="modal-content"
          >
            <header
              v-if="!modal.disableHeader"
              class="apos-modal__header"
            >
              <div class="apos-modal__header__main">
                <div
                  v-if="hasSlot('secondaryControls')"
                  class="apos-modal__controls--secondary"
                >
                  <slot name="secondaryControls" />
                </div>
                <h2
                  v-if="modalTitle"
                  :id="props.modalData.id"
                  class="apos-modal__heading"
                >
                  <span
                    v-if="modal.a11yTitle"
                    class="apos-sr-only"
                  >
                    {{ $t(modal.a11yTitle) }}
                  </span>
                  {{ $t(modalTitle) }}
                </h2>
                <div
                  v-if="hasBeenLocalized ||
                    hasSlot('primaryControls') ||
                    hasSlot('localeDisplay')"
                  class="apos-modal__controls--header"
                >
                  <div
                    v-if="hasSlot('localeDisplay')"
                    class="apos-modal__locale"
                  >
                    <slot name="localeDisplay" />
                  </div>
                  <div
                    v-if="hasSlot('primaryControls')"
                    class="apos-modal__controls--primary"
                  >
                    <slot name="primaryControls" />
                  </div>
                </div>
              </div>
            </header>
            <div
              v-if="hasSlot('breadcrumbs')"
              class="apos-modal__breadcrumbs"
            >
              <slot
                class="apos-modal__breadcrumbs"
                name="breadcrumbs"
              />
            </div>
            <div
              class="apos-modal__main"
              :class="gridModifier"
            >
              <slot name="leftRail" />
              <slot name="main" />
              <slot name="rightRail" />
            </div>
            <footer
              v-if="hasSlot('footer')"
              class="apos-modal__footer"
            >
              <div class="apos-modal__footer__inner">
                <slot name="footer" />
              </div>
            </footer>
          </div>
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
  ref, onMounted, onUnmounted, computed, watch, nextTick, useSlots, useTemplateRef
} from 'vue';
import { useAposFocus } from 'Modules/@apostrophecms/modal/composables/AposFocus';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { useDraggableWindow } from 'Modules/@apostrophecms/ui/composables/useDraggableWindow.js';

const {
  cycleElementsToFocus,
  focusElement,
  focusLastModalFocusedElement,
  storeFocusedElement,
  findPriorityElementOrFirst
} = useAposFocus();

const props = defineProps({
  modal: {
    type: Object,
    required: true
  },
  modalTitle: {
    type: [ String, Object ],
    default: null
  },
  modalData: {
    type: Object,
    required: true
  }
});

const store = useModalStore();

const slots = useSlots();
const emit = defineEmits([ 'inactive', 'esc', 'show-modal', 'no-modal', 'ready' ]);
const modalEl = useTemplateRef('modalEl');
const modalInnerEl = useTemplateRef('modalInnerEl');
const findPriorityFocusElementRetryMax = ref(3);
const currentPriorityFocusElementRetry = ref(0);
const renderingElements = ref(true);
const nonDraggableElements = [
  '.apos-input-wrapper'
];

const isWindowModal = computed(() => {
  return props.modal.type === 'window';
});

// Default dimensions for window modals
const DEFAULT_WINDOW_SIZE = {
  width: 380,
  height: 500
};

// Set up draggable window composable (always called, but only used for window modals)
const size = ref({
  width: DEFAULT_WINDOW_SIZE.width,
  height: DEFAULT_WINDOW_SIZE.height
});

const getDefaultPosition = (origin = 'right') => {
  const adminBarHeight = window.apos?.adminBar?.height || 0;
  const windowSize = window.innerWidth;
  const spacing = 30;
  const left = origin === 'left' ? spacing : windowSize - size.value.width - spacing;
  const top = adminBarHeight + spacing;

  return {
    left,
    top
  };
};

const {
  style: windowStyle,
  startDragging: composableStartDragging,
  setPosition: setWindowPosition,
  constrainPosition
} = useDraggableWindow({
  size,
  getDefaultPosition: () => getDefaultPosition(props.modal.origin)
});

// Wrap handler to only work for window modals
const startDragging = (e) => {
  const nonDraggable = nonDraggableElements.some(
    sel => e.target.closest(sel)
  );

  if (isWindowModal.value && !nonDraggable) {
    composableStartDragging(e);
  }
};

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

  if (props.modal.type === 'window') {
    classes.push('apos-window');
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
    await trapFocus();
  } else {
    renderingElements.value = false;
  }
  store.updateModalData(props.modalData.id, { modalEl: modalEl.value });

  // Set up window modal positioning and size
  if (isWindowModal.value && modalInnerEl.value) {
    await nextTick();
    const rect = modalInnerEl.value.getBoundingClientRect();
    size.value = {
      width: rect.width || DEFAULT_WINDOW_SIZE.width,
      height: rect.height || DEFAULT_WINDOW_SIZE.height
    };
    setWindowPosition();

    // Add resize handler for window modals
    window.addEventListener('resize', handleResize);
  }
});

// Watch for modal show/hide to update position
watch(() => props.modal.showModal, async (showModal) => {
  if (isWindowModal.value && showModal && modalInnerEl.value) {
    await nextTick();
    const rect = modalInnerEl.value.getBoundingClientRect();
    size.value = {
      width: rect.width || DEFAULT_WINDOW_SIZE.width,
      height: rect.height || DEFAULT_WINDOW_SIZE.height
    };
    setWindowPosition();
  }
});

// Watch for switch to window modal (e.g. dock → window) and compute position
watch(isWindowModal, async (isWindow) => {
  if (isWindow && modalInnerEl.value) {
    await nextTick();
    const rect = modalInnerEl.value.getBoundingClientRect();
    size.value = {
      width: rect.width || DEFAULT_WINDOW_SIZE.width,
      height: rect.height || DEFAULT_WINDOW_SIZE.height
    };
    setWindowPosition();
  }
});

function handleResize() {
  if (isWindowModal.value) {
    constrainPosition();
  }
}

onUnmounted(() => {
  if (isWindowModal.value) {
    window.removeEventListener('resize', handleResize);
  }
});

function onKeyup(event) {
  if (!store.isOnTop(modalEl.value)) {
    return;
  }

  if (event.key === 'Tab') {
    cycleElementsToFocus(event, props.modalData.elementsToFocus);
    return;
  }

  if (event.key === 'Escape') {
    // Don't confuse escape key handlers in other modal layers etc.
    event.stopPropagation();

    close();
  }
}

async function onEnter() {
  // For window modals, calculate position before showing so the modal
  // appears in the correct place (avoids flash from 0,0).
  if (isWindowModal.value) {
    setWindowPosition();
  }
  emit('show-modal');

  await nextTick();
  emit('ready');
}

function onLeave() {
  store.remove(props.modalData.id);
  focusLastModalFocusedElement();
  emit('no-modal');
}

function captureFocus(e) {
  storeFocusedElement(e);
  store.updateModalData(props.modalData.id, { focusedElement: e.target });
}

async function trapFocus() {
  if (modalEl?.value) {
    const elementSelectors = [
      '[tabindex]',
      '[href]',
      'input',
      'select',
      'textarea',
      'button',
      '[data-apos-focus-priority]'
    ];

    const selector = elementSelectors
      .map(addExcludingAttributes)
      .join(', ');

    const elementsToFocus = [ ...modalEl.value.querySelectorAll(selector) ];

    store.updateModalData(props.modalData.id, { elementsToFocus });

    const firstElementToFocus = findPriorityElementOrFirst(elementsToFocus);
    const foundPriorityElement = firstElementToFocus?.hasAttribute('data-apos-focus-priority');

    // Components render at various times and can't be counted on to be available on
    // modal's mount. Update the trap focus list until a data-apos-focus-priority element
    // is found or the retry limit is reached
    if (
      !foundPriorityElement &&
      findPriorityFocusElementRetryMax.value > currentPriorityFocusElementRetry.value
    ) {
      await new Promise(resolve => setTimeout(resolve, 50));
      currentPriorityFocusElementRetry.value++;
      await trapFocus();
      return;
    }
    renderingElements.value = false;
    await nextTick();
    focusElement(props.modalData.focusedElement, firstElementToFocus);
  }

  function addExcludingAttributes(element) {
    return `${element}:not([tabindex="-1"]):not([disabled]):not([type="hidden"]):not([aria-hidden]):not(.apos-sr-only)`;
  }
}

function close() {
  const activeModalId = store.activeModal?.id;
  if (activeModalId === props.modalData.id) {
    emit('esc');
  }
}
</script>

<style lang="scss" scoped>
  // NOTE: Transition timings below are set to match the wrapper transition
  // timing in the template to coordinate the inner and overlay animations.
  .apos-modal__inner {
    z-index: $z-index-modal;
    position: fixed;
    inset: $spacing-base $spacing-base $spacing-base $spacing-base;
    display: flex;
    flex-direction: column;
    height: calc(100vh - $spacing-base * 2);
    border-radius: var(--a-border-radius);
    background-color: var(--a-background-primary);
    border: 1px solid var(--a-base-9);
    color: var(--a-text-primary);
    overflow: hidden;

    @include media-up(lap) {
      inset: $spacing-double $spacing-double $spacing-double $spacing-double;
      height: calc(100vh - #{$spacing-double * 2});
    }

    .apos-modal--slide & {
      position: fixed;
      top: 0;
      bottom: 0;
      width: 100%;
      height: 100vh;
      transition: transform 200ms ease;
      transform: translateX(0);
      border-radius: 0;

      @include media-up(hands-wide) {
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
      @include media-up(hands-wide) {
        max-width: 66%;
      }
    }

    &.apos-modal__inner--half {
      @include media-up(hands-wide) {
        max-width: 50%;
      }
    }

    &.apos-modal__inner--full {
      @include media-up(hands-wide) {
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
      transition: opacity 200ms ease, transform 200ms ease;
    }

    &.fade-enter-from,
    &.fade-leave-to {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  .apos-modal--window {
    // Default dimensions are set via inline styles from DEFAULT_WINDOW_SIZE constant
    .apos-modal__inner {
      border-radius: 10px;
    }

    :deep(.apos-modal__body) {
      padding: 15px 12.5px;
    }

    :deep(.apos-modal__footer__inner) {
      padding: 10px;
    }
  }

  .apos-modal--full-height .apos-modal__inner {
    height: 100%;
  }

  .apos-modal__content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .apos-modal__main {
    display: grid;
    flex-grow: 1;
    overflow-y: auto;
  }

  .apos-modal__overlay {
    z-index: $z-index-modal;
    position: fixed;
    inset: 0;
    background-color: var(--a-overlay-modal);

    &--transparent {
      background-color: transparent;
    }

    // .apos-modal--slide &,
    // .apos-modal--overlay & {
    //   transition: opacity 200ms ease;
    // }

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
    align-items: center;
    padding: $spacing-double;
    line-height: var(--a-line-base);
  }

  .apos-modal__header__main {
    border-bottom: 1px solid var(--a-base-9);
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
    flex-grow: 1;
    justify-content: flex-end;
  }

  :deep(.apos-modal__controls--primary) {
    & > .apos-button__wrapper,
    & > .apos-context-menu {
      margin-right: 7.5px;
      margin-left: 7.5px;
    }
  }

  .apos-modal__locale {
    margin-right: $spacing-double;
  }

  .apos-modal__heading {
    @include type-title;

    & {
      margin: 0;
    }
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
    align-items: center;
    justify-content: center;
    height: $height;
    text-align: center;
    transform: translateY(math.div($height, 2) * -1);
  }

  .apos-modal__busy-text {
    margin-bottom: $spacing-triple;
    font-size: var(--a-type-heading);
  }
</style>
