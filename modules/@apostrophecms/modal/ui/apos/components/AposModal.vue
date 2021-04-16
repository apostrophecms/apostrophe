<template>
  <transition
    :name="transitionType"
    @enter="finishEnter"
    @leave="finishExit"
    :duration="250"
  >
    <section
      v-if="modal.active"
      :class="classes"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="id"
      ref="modalEl"
    >
      <transition :name="transitionType">
        <div class="apos-modal__overlay" v-if="modal.showModal" />
      </transition>
      <transition :name="transitionType" @after-leave="$emit('inactive')">
        <div
          v-if="modal.showModal"
          class="apos-modal__inner" data-apos-modal-inner
        >
          <header class="apos-modal__header" v-if="!modal.disableHeader">
            <div class="apos-modal__header__main">
              <div v-if="hasSecondaryControls" class="apos-modal__controls--secondary">
                <slot name="secondaryControls" />
              </div>
              <h2 :id="id" class="apos-modal__heading">
                <span v-if="modal.a11yTitle" class="apos-sr-only">
                  {{ modal.a11yTitle }}
                </span>
                {{ modalTitle }}
              </h2>
              <div class="apos-modal__controls--primary" v-if="hasPrimaryControls">
                <slot name="primaryControls" />
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
export default {
  name: 'AposModal',
  props: {
    modal: {
      type: Object,
      required: true
    },
    modalTitle: {
      type: String,
      default: ''
    }
  },
  emits: [ 'inactive', 'esc', 'show-modal', 'no-modal' ],
  computed: {
    id() {
      const rand = (Math.floor(Math.random() * Math.floor(10000)));
      // replace everything not A-Za-z0-9_ with _
      const title = this.modalTitle.replace(/\W/g, '_');
      return `${title}-${rand}`;
    },
    transitionType: function () {
      if (this.modal.type === 'slide') {
        return 'slide';
      } else {
        return 'fade';
      }
    },
    modalReady () {
      return this.modal.active;
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
        classes.push('apos-modal--full-height');
      }
      return classes.join(' ');
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
    modalReady (newVal) {
      this.$nextTick(() => {
        if (newVal && this.modal.trapFocus && this.$refs.modalEl) {
          this.trapFocus();
        }
      });
    }
  },
  methods: {
    esc (e) {
      if (apos.modal.stack[apos.modal.stack.length - 1] !== this) {
        return;
      }
      if (e.keyCode === 27) {
        e.stopPropagation();
        this.$emit('esc');
      }
    },
    finishEnter () {
      this.$emit('show-modal');
      this.bindEventListeners();
      apos.modal.stack = apos.modal.stack || [];
      apos.modal.stack.push(this);
    },
    finishExit () {
      this.removeEventListeners();
      this.$emit('no-modal');
      // pop doesn't quite suffice because of race conditions when
      // closing one and opening another
      apos.modal.stack = apos.modal.stack.filter(modal => modal !== this);
    },
    bindEventListeners () {
      window.addEventListener('keydown', this.esc);
    },
    removeEventListeners () {
      window.removeEventListener('keydown', this.esc);
    },
    trapFocus () {
      // Adapted from https://uxdesign.cc/how-to-trap-focus-inside-modal-to-make-it-ada-compliant-6a50f9a70700
      // All the elements inside modal which you want to make focusable.
      const focusableElements = [
        'button',
        '[href]',
        'input',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"]'
      ];
      const focusableString = focusableElements.join(', ');
      const modalEl = this.$refs.modalEl;
      const focusables = modalEl.querySelectorAll(focusableString);
      const firstFocusableElement = focusables[0];
      const lastFocusableElement = focusables[focusables.length - 1];

      modalEl.addEventListener('keydown', cycleFocusables);

      firstFocusableElement.focus();

      function cycleFocusables (e) {
        const isTabPressed = e.key === 'Tab' || e.code === 'Tab';
        if (!isTabPressed) {
          return;
        }

        if (e.shiftKey) {
          // If shift key pressed for shift + tab combination
          if (document.activeElement === firstFocusableElement) {
            // Add focus for the last focusable element
            lastFocusableElement.focus();
            e.preventDefault();
          }
        } else {
          // If tab key is pressed
          if (document.activeElement === lastFocusableElement) {
            // Add focus for the first focusable element
            firstFocusableElement.focus();
            e.preventDefault();
          }
        }
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
    top: $spacing-double;
    right: $spacing-double;
    bottom: $spacing-double;
    left: $spacing-double;
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: calc(100vh - #{$spacing-double * 2});
    border-radius: var(--a-border-radius);
    background-color: var(--a-background-primary);
    border: 1px solid var(--a-base-9);
    color: var(--a-text-primary);

    .apos-modal--slide & {
      position: fixed;
      transition: transform 0.15s ease;
      top: 0;
      right: 0;
      bottom: 0;
      left: auto;
      transform: translateX(0);
      width: 90%;
      border-radius: 0;

      @media screen and (min-width: 800px) {
        max-width: 540px;
      }
    }

    &.slide-enter,
    &.slide-leave-to {
      transform: translateX(100%);
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

  .apos-modal__controls--primary,
  .apos-modal__controls--secondary {
    display: flex;
    align-items: center;
  }

  .apos-modal__controls--primary {
    justify-content: flex-end;
    flex-grow: 1;
  }
  .apos-modal__controls--primary /deep/ {
    & > .apos-button__wrapper,
    & > .apos-context-menu {
      margin-left: 7.5px;
    }
  }

  .apos-modal__heading {
    @include type-title;
    margin: 0;
  }

  .apos-modal__controls--secondary {
    margin-right: 20px;
  }

  .apos-modal__main--with-rails {
    grid-template-columns: 20% 1fr minmax(250px, $modal-rail-right-w);
  }

  .apos-modal__main--with-left-rail {
    grid-template-columns: 22% 78%;
  }

  .apos-modal__main--with-right-rail {
    grid-template-columns: 78% $modal-rail-right-w;
  }
</style>
