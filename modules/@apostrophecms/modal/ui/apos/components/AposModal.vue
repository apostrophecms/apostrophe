<template>
  <transition
    :name="transitionType"
    @enter="onEnter"
    @leave="onLeave"
    :duration="250"
  >
    <section
      v-if="modal.active"
      :class="classes"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="id"
      ref="modalEl"
      @keydown="cycleElementsToFocus"
      @focus.capture="storeFocusedElement"
      data-apos-modal
    >
      <transition :name="transitionType">
        <div
          @click="close"
          v-if="modal.showModal"
          class="apos-modal__overlay"
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
            <header class="apos-modal__header" v-if="!modal.disableHeader">
              <div class="apos-modal__header__main">
                <div v-if="hasSecondaryControls" class="apos-modal__controls--secondary">
                  <slot name="secondaryControls" />
                </div>
                <h2 :id="id" class="apos-modal__heading">
                  <span v-if="modal.a11yTitle" class="apos-sr-only">
                    {{ $t(modal.a11yTitle) }}
                  </span>
                  {{ $t(modalTitle) }}
                </h2>
                <div class="apos-modal__controls--header" v-if="hasBeenLocalized || hasPrimaryControls">
                  <div class="apos-modal__locale" v-if="hasBeenLocalized">
                    <span class="apos-modal__locale-label">
                      {{ $t('apostrophe:locale') }}:
                    </span> <span class="apos-modal__locale-name">
                      {{ currentLocale }}
                    </span>
                  </div>
                  <div class="apos-modal__controls--primary" v-if="hasPrimaryControls">
                    <slot name="primaryControls" />
                  </div>
                </div>
              </div>
              <div class="apos-modal__breadcrumbs" v-if="hasBreadcrumbs">
                <slot class="apos-modal__breadcrumbs" name="breadcrumbs" />
              </div>
            </header>
            <div class="apos-modal__main" :class="gridModifier">
              <slot v-if="hasLeftRail" name="leftRail" />
              <slot name="main" />
              <slot name="rightRail" />
            </div>
            <footer v-if="hasFooter" class="apos-modal__footer">
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

<script>
// NOTE:
// To get the desired transition effect, modal props have two properties,
// `active` and `showModal`, which control their visibility. Basically,
// `active` starts the transition process for the overlay and the body of the
// modal, which enter at different speeds. `showModal` is what actually
// displays the modal.
// So as the modal exits, they should change in reverse. `showModal` becomes
// `false`, then `active` is set to `false` once the modal has finished its
// transition.
import AposFocusMixin from 'Modules/@apostrophecms/modal/mixins/AposFocusMixin';

export default {
  name: 'AposModal',
  mixins: [
    AposFocusMixin
  ],
  props: {
    modal: {
      type: Object,
      required: true
    },
    modalTitle: {
      type: [ String, Object ],
      default: ''
    }
  },
  emits: [ 'inactive', 'esc', 'show-modal', 'no-modal', 'ready' ],
  data() {
    return {
      // For aria purposes
      id: 'modal:' + Math.random().toString().replace('.', '')
    };
  },
  computed: {
    transitionType: function () {
      if (this.modal.type === 'slide') {
        if (this.modal.origin === 'left') {
          return 'slide-right';
        } else {
          return 'slide-left';
        }
      } else {
        return 'fade';
      }
    },
    shouldTrapFocus() {
      return this.modal.trapFocus || this.modal.trapFocus === undefined;
    },
    triggerFocusRefresh () {
      return this.modal.triggerFocusRefresh;
    },
    hasBeenLocalized: function() {
      return Object.keys(apos.i18n.locales).length > 1;
    },
    currentLocale: function() {
      return apos.i18n.locale;
    },
    hasPrimaryControls: function () {
      return !!this.$slots.primaryControls;
    },
    hasSecondaryControls: function () {
      return !!this.$slots.secondaryControls;
    },
    hasBreadcrumbs: function () {
      return !!this.$slots.breadcrumbs;
    },
    hasLeftRail: function () {
      return !!this.$slots.leftRail;
    },
    hasRightRail: function () {
      return !!this.$slots.rightRail;
    },
    hasFooter: function () {
      return !!this.$slots.footer;
    },
    classes() {
      const classes = [ 'apos-modal' ];
      classes.push(`apos-modal--${this.modal.type}`);
      if (this.modal.type === 'slide') {
        if (this.modal.origin) {
          classes.push(`apos-modal--origin-${this.modal.origin}`);
        } else {
          classes.push('apos-modal--origin-right');
        }
        classes.push('apos-modal--full-height');
      }
      if (this.modal.busy) {
        classes.push('apos-modal--busy');
      }
      return classes.join(' ');
    },
    innerClasses() {
      const classes = [];
      if (this.modal.width) {
        classes.push(`apos-modal__inner--${this.modal.width}`);
      };
      return classes;
    },
    gridModifier() {
      if (this.hasLeftRail && this.hasRightRail) {
        return 'apos-modal__main--with-rails';
      }
      if (this.hasLeftRail && !this.hasRightRail) {
        return 'apos-modal__main--with-left-rail';
      }
      if (!this.hasLeftRail && this.hasRightRail) {
        return 'apos-modal__main--with-right-rail';
      }
      return false;
    }
  },
  watch: {
    // Simple way to re-trigger focusable elements
    // that might have been created or removed
    // after an update, like an XHR call to get the
    // pieces list in the AposDocsManager modal, for instance.
    triggerFocusRefresh (newVal) {
      if (this.shouldTrapFocus) {
        this.$nextTick(this.trapFocus);
      }
    }
  },
  mounted() {
    if (this.shouldTrapFocus) {
      this.$nextTick(this.trapFocus);
    }
  },
  methods: {
    onKeydown (e) {
      const hasPressedEsc = e.keyCode === 27;
      if (hasPressedEsc) {
        this.close(e);
      }
    },
    onEnter () {
      this.$emit('show-modal');
      this.bindEventListeners();
      apos.modal.stack = apos.modal.stack || [];
      apos.modal.stack.push(this);
      this.$nextTick(() => {
        this.$emit('ready');
      });
    },
    onLeave () {
      this.removeEventListeners();
      this.$emit('no-modal');
      // pop doesn't quite suffice because of race conditions when
      // closing one and opening another
      apos.modal.stack = apos.modal.stack.filter(modal => modal !== this);
      this.focusLastModalFocusedElement();
    },
    bindEventListeners () {
      window.addEventListener('keydown', this.onKeydown);
    },
    removeEventListeners () {
      window.removeEventListener('keydown', this.onKeydown);
    },
    close (e) {
      if (apos.modal.stack[apos.modal.stack.length - 1] !== this) {
        return;
      }
      e.stopPropagation();
      this.$emit('esc');
    },
    trapFocus () {
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

      this.elementsToFocus = [ ...this.$refs.modalEl.querySelectorAll(selector) ]
        .filter(this.isElementVisible);

      this.focusElement(this.focusedElement, this.elementsToFocus[0]);

      function addExcludingAttributes(element) {
        return `${element}:not([tabindex="-1"]):not([disabled]):not([type="hidden"]):not([aria-hidden])`;
      }
    }
  }
};
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
      width: 90%;
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

    &.slide-left-enter,
    &.slide-left-leave-to {
      transform: translateX(100%);
    }

    &.slide-right-enter,
    &.slide-right-leave-to {
      transform: translateX(-100%);
    }

    .apos-modal--overlay & {
      transform: scale(1);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }

    &.fade-enter,
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

    &.slide-enter,
    &.slide-leave-to,
    &.fade-enter,
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
  .apos-modal__controls--primary ::v-deep {
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
